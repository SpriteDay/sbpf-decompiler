import { OpCodes } from "./ebpf"
import { Executable } from "./elf"
import { ExecutionOverrun } from "./error"
import { MemoryMapping } from "./memory-mapping"
import { SBPFFeatures } from "./program"
import { EbpfVm } from "./vm"

/** State of interpreter */
export interface Interpreter {
    vm: EbpfVm
    reg: BigUint64Array
    executable: Executable
}

export const Interpreter = {
    /** Creates a new interpreter state */
    new({
        vm,
        executable,
        registers,
    }: {
        vm: EbpfVm
        executable: Executable
        registers: BigUint64Array
    }): Interpreter {
        return {
            vm,
            executable,
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
        const nextPc = interpreter.reg[11] + 1n
        const insn =
            interpreter.executable.instructions[Number(interpreter.reg[11])]
        const dst = insn.dst
        const src = insn.src

        switch (insn.opc) {
            case OpCodes.LD_8B_REG: {
                if (
                    SBPFFeatures.moveMemoryInstructionClasses(
                        interpreter.executable.sbpfVersion,
                    )
                ) {
                    // Wrapping additioon
                    const vmAddr = BigInt.asIntN(
                        64,
                        interpreter.reg[Number(src)] + insn.off,
                    )
                    interpreter.reg[Number(dst)] = MemoryMapping.load(
                        interpreter.vm.memoryMapping,
                        { vmAddr, size: 8 },
                    )
                }
                break
            }
        }

        interpreter.reg[11] = nextPc
        return true
    },
}
