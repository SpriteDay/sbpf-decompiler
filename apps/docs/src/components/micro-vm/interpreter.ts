import { logger } from "@/lib/logger"
import {
    augmentLddwUnchecked,
    FIRST_SCRATCH_REGISTER,
    FRAME_PTR_REG,
    getInsnUnchecked,
    OpCodes,
    SCRATCH_REGS,
} from "./ebpf"
import { Executable } from "./elf"
import { ExecutionOverrun } from "./error"
import { MemoryMapping } from "./memory-mapping"
import { BuiltinFunction, BuiltinProgram, SBPFFeatures } from "./program"
import { CallFrame, Config, EbpfVm } from "./vm"

/** State of interpreter */
export interface Interpreter {
    vm: EbpfVm
    executable: Executable
    callFrames: Array<CallFrame>

    /** General purpose registers and pc */
    reg: BigUint64Array
}

export const Interpreter = {
    /** Creates a new interpreter state */
    new({
        vm,
        executable,
        registers,
        callFrames,
    }: {
        vm: EbpfVm
        executable: Executable
        registers: BigUint64Array
        callFrames: Array<CallFrame>
    }): Interpreter {
        return {
            vm,
            executable,
            callFrames,
            reg: registers,
        }
    },

    pushFrame(self: Interpreter, { config }: { config: Config }): boolean {
        const frame = self.callFrames[self.vm.callDepth]
        frame.callerSavedRegisters = self.reg.slice(
            FIRST_SCRATCH_REGISTER,
            FIRST_SCRATCH_REGISTER + SCRATCH_REGS,
        )
        frame.framePointer = self.reg[FRAME_PTR_REG]
        frame.targetPc = self.reg[11] + 1n

        self.vm.callDepth += 1
        if (self.vm.callDepth === config.maxCallDepth) {
            self.vm.programResult = -1n
            logger.error("CallDepthExceeded")
            return false
        }

        if (!SBPFFeatures.manualStackFrameBump(self.executable.sbpfVersion)) {
            // With fixed frames we start the new frame at the next fixed offset
            const numFrames =
                SBPFFeatures.stackFrameGaps(self.executable.sbpfVersion) &&
                config.enableStackFrameGaps
                    ? 2
                    : 1
            const stackFrameSize = config.stackFrameSize * BigInt(numFrames)
            self.reg[FRAME_PTR_REG] = BigInt.asUintN(
                64,
                self.reg[FRAME_PTR_REG] + stackFrameSize,
            )
        }

        return true
    },

    /**
     * Advances the interpreter state by one instruction
     *
     * Returns false if the program terminated or threw an error
     */
    step(self: Interpreter): boolean {
        const config = self.vm.loader.config

        if (self.reg[11] >= self.executable.slots.length) {
            throw new ExecutionOverrun()
        }
        let nextPc = self.reg[11] + 1n

        const insn = getInsnUnchecked({
            slot: self.executable.slots[Number(self.reg[11])],
            pc: self.reg[11],
        })

        const dst = Number(insn.dst)
        const src = Number(insn.src)

        if (config.enableRegisterTracing) {
            self.vm.registerTrace.push(new BigUint64Array(self.reg))
        }

        switch (insn.opc) {
            case OpCodes.LD_DW_IMM: {
                if (!SBPFFeatures.disableLddw(self.executable.sbpfVersion)) {
                    augmentLddwUnchecked({
                        prog: self.executable.slots,
                        insn,
                    })
                    self.reg[dst] = BigInt.asUintN(64, insn.imm)
                    self.reg[11] += 1n
                    nextPc += 1n
                }
                break
            }

            // BPF_LDX class
            case OpCodes.LD_B_REG: {
                const vmAddr = BigInt.asUintN(
                    64,
                    BigInt.asIntN(64, self.reg[src]) + insn.off,
                )
                self.reg[dst] = MemoryMapping.load(self.vm.memoryMapping, {
                    vmAddr,
                    size: 1,
                })
                break
            }

            // BPF_ALU32_LOAD class
            case OpCodes.LD_8B_REG: {
                if (
                    SBPFFeatures.moveMemoryInstructionClasses(
                        self.executable.sbpfVersion,
                    )
                ) {
                    // Wrapping additioon
                    const vmAddr = BigInt.asUintN(64, self.reg[src] + insn.off)
                    self.reg[dst] = MemoryMapping.load(self.vm.memoryMapping, {
                        vmAddr,
                        size: 8,
                    })
                }
                break
            }

            // BPF_ALU64_STORE class
            case OpCodes.ADD64_IMM: {
                self.reg[dst] = BigInt.asUintN(64, self.reg[dst] + insn.imm)
                break
            }
            case OpCodes.ADD64_REG: {
                self.reg[dst] = BigInt.asUintN(
                    64,
                    self.reg[dst] + self.reg[src],
                )
                break
            }
            case OpCodes.SUB64_IMM: {
                self.reg[dst] = BigInt.asUintN(64, self.reg[dst] - insn.imm)
                break
            }
            case OpCodes.MOV64_IMM: {
                self.reg[dst] = BigInt.asUintN(64, insn.imm)
                break
            }
            case OpCodes.MOV64_REG: {
                self.reg[dst] = self.reg[src]
                break
            }

            // BPF_PQR class
            case OpCodes.LMUL64_IMM: {
                if (SBPFFeatures.enablePqr(self.executable.sbpfVersion)) {
                    let newVal = self.reg[dst] * insn.imm
                    if (newVal > BigInt.asUintN(64, -1n)) {
                        newVal -= BigInt.asUintN(64, -1n)
                    }
                    self.reg[dst] = newVal
                }
                break
            }

            // BPF_JMP64 class
            case OpCodes.JA: {
                nextPc = BigInt.asUintN(64, nextPc + insn.off)
                break
            }
            case OpCodes.JEQ64_IMM: {
                if (self.reg[dst] === BigInt.asUintN(64, insn.imm)) {
                    nextPc = BigInt.asUintN(64, nextPc + insn.off)
                }
                break
            }
            case OpCodes.JGT64_IMM: {
                if (self.reg[dst] > BigInt.asUintN(64, insn.imm)) {
                    nextPc = BigInt.asUintN(64, nextPc + insn.off)
                }
                break
            }

            case OpCodes.CALL_REG: {
                let targetPc: bigint
                if (SBPFFeatures.callxUsesSrcReg(self.executable.sbpfVersion)) {
                    targetPc = self.reg[src]
                } else if (
                    SBPFFeatures.callxUsesDstReg(self.executable.sbpfVersion)
                ) {
                    targetPc = self.reg[dst]
                } else {
                    targetPc = self.reg[Number(insn.imm)]
                }
                if (!Interpreter.pushFrame(self, { config })) {
                    return false
                }
                if (targetPc < self.executable.slots.length) {
                    nextPc = targetPc
                } else {
                    throw new Error("CallOutsideTextSegment")
                }
                break
            }

            case OpCodes.CALL_IMM: {
                let resolved = false

                // External syscall
                if (SBPFFeatures.staticSyscalls(self.executable.sbpfVersion)) {
                    if (insn.src === 0n) {
                        const callback = BuiltinProgram.getFunctionRegistry(
                            self.executable.loader,
                        ).inner.get(BigInt.asUintN(32, insn.imm))?.[1]?.[0]
                        if (callback) {
                            try {
                                Interpreter.dispatchSyscall(self, {
                                    function_: callback,
                                })
                            } catch (e) {
                                logger.error(e)
                                return false
                            }
                            resolved = true
                        }
                    } else {
                        const targetPc = BigInt.asIntN(64, nextPc + insn.imm)
                        if (
                            targetPc < self.executable.slots.length &&
                            insn.src === 1n
                        ) {
                            if (!Interpreter.pushFrame(self, { config })) {
                                return false
                            }
                            nextPc = BigInt.asUintN(64, targetPc)
                            resolved = true
                        }
                    }
                } else {
                    // Try external callback
                    const callback = BuiltinProgram.getFunctionRegistry(
                        self.executable.loader,
                    ).inner.get(BigInt.asUintN(32, insn.imm))?.[1]?.[0]
                    if (callback) {
                        try {
                            Interpreter.dispatchSyscall(self, {
                                function_: callback,
                            })
                        } catch (e) {
                            logger.error(e)
                            return false
                        }
                        resolved = true
                    }
                    // Try internal function
                    const entry = self.executable.functionRegistry.inner.get(
                        insn.imm,
                    )
                    if (entry) {
                        const [_, targetPc] = entry
                        if (!Interpreter.pushFrame(self, { config })) {
                            return false
                        }
                        if (
                            targetPc < self.executable.slots.length &&
                            insn.src === 1n
                        ) {
                            if (!Interpreter.pushFrame(self, { config })) {
                                return false
                            }
                            nextPc = BigInt.asUintN(64, targetPc)
                            resolved = true
                        }
                        resolved = true
                    }
                    if (!resolved) {
                        self.vm.registers[11] = self.reg[11]
                        self.vm.programResult = -1n
                        logger.error("Unsupported instruction")
                        return false
                    }
                }
                break
            }

            case OpCodes.EXIT: {
                if (self.vm.callDepth === 0) {
                    self.vm.programResult = self.reg[0]
                    return false
                }
                self.vm.callDepth -= 1
                const frame = self.callFrames[self.vm.callDepth]
                self.reg[FRAME_PTR_REG] = frame.framePointer
                self.reg.set(frame.callerSavedRegisters, FIRST_SCRATCH_REGISTER)
                nextPc = frame.targetPc
                break
            }

            default: {
                throw new Error(`Unsupported instruction: ${insn.opc}`)
            }
        }

        self.reg[11] = nextPc
        return true
    },

    dispatchSyscall(
        self: Interpreter,
        { function_ }: { function_: BuiltinFunction },
    ) {
        self.vm.dueInsnCount =
            self.vm.previousInstructionMeter - self.vm.dueInsnCount
        self.vm.registers.set(self.reg.subarray(0, 6), 0)
        EbpfVm.invokeFunction(self.vm, { function_ })
        self.vm.dueInsnCount = 0n
        return self.vm.programResult
    },
}
