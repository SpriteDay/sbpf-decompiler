import { FIRST_SCRATCH_REGISTER, FRAME_PTR_REG, OpCodes } from "./ebpf"
import { Executable } from "./elf"
import { ExecutionOverrun } from "./error"
import { MemoryMapping } from "./memory-mapping"
import { SBPFFeatures } from "./program"
import { CallFrame, EbpfVm } from "./vm"

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

    /**
     * Advances the interpreter state by one instruction
     *
     * Returns false if the program terminated or threw an error
     */
    step(interpreter: Interpreter): boolean {
        if (interpreter.reg[11] >= interpreter.executable.instructions.length) {
            throw new ExecutionOverrun()
        }
        let nextPc = interpreter.reg[11] + 1n
        const insn =
            interpreter.executable.instructions[Number(interpreter.reg[11])]
        const dst = Number(insn.dst)
        const src = Number(insn.src)

        switch (insn.opc) {
            // BPF_ALU32_LOAD class
            case OpCodes.LD_8B_REG: {
                if (
                    SBPFFeatures.moveMemoryInstructionClasses(
                        interpreter.executable.sbpfVersion,
                    )
                ) {
                    // Wrapping additioon
                    const vmAddr = BigInt.asUintN(
                        64,
                        interpreter.reg[src] + insn.off,
                    )
                    interpreter.reg[dst] = MemoryMapping.load(
                        interpreter.vm.memoryMapping,
                        { vmAddr, size: 8 },
                    )
                }
                break
            }

            // BPF_ALU64_STORE class
            case OpCodes.ADD64_IMM: {
                interpreter.reg[dst] = BigInt.asUintN(
                    64,
                    interpreter.reg[dst] + insn.imm,
                )
            }
            case OpCodes.SUB64_IMM: {
                interpreter.reg[dst] = BigInt.asUintN(
                    64,
                    interpreter.reg[dst] - insn.imm,
                )
            }
            case OpCodes.MOV64_IMM: {
                interpreter.reg[dst] = BigInt.asUintN(64, insn.imm)
                break
            }
            case OpCodes.MOV64_REG: {
                interpreter.reg[dst] = interpreter.reg[src]
                break
            }

            // BPF_JMP64 class
            case OpCodes.JA: {
                nextPc = BigInt.asUintN(64, nextPc + insn.off)
            }
            case OpCodes.JEQ64_IMM: {
                if (interpreter.reg[dst] === BigInt.asUintN(64, insn.imm)) {
                    nextPc = BigInt.asUintN(64, nextPc + insn.off)
                }
            }
            case OpCodes.JGT64_IMM: {
                if (interpreter.reg[dst] > BigInt.asUintN(64, insn.imm)) {
                    nextPc = BigInt.asUintN(64, nextPc + insn.off)
                }
            }

            case OpCodes.EXIT: {
                if (interpreter.vm.callDepth === 0) {
                    interpreter.vm.programResult = interpreter.reg[0]
                    return false
                }
                interpreter.vm.callDepth -= 1
                const frame = interpreter.callFrames[interpreter.vm.callDepth]
                interpreter.reg[FRAME_PTR_REG] = frame.framePointer
                interpreter.reg.set(
                    frame.callerSavedRegisters,
                    FIRST_SCRATCH_REGISTER,
                )
                nextPc = frame.targetPc
            }

            default: {
                throw new Error(`Unsupported instruction: ${insn.opc}`)
            }
        }

        interpreter.reg[11] = nextPc
        return true
    },
}
