import { Insn } from "./ebpf"
import { FunctionRegistry, SBPFVersion } from "./program"

export interface Executable {
    /** Required SBPF capabilities */
    sbpfVersion: SBPFVersion
    instructions: Array<Insn>
    /** Call resolution map (hash, pc, name) */
    functionRegistry: FunctionRegistry<bigint>
}

export const Executable = {
    getFunctionRegistry(executable: Executable) {
        return executable.functionRegistry
    },
}
