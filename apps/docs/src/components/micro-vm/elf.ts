import { InsnRaw } from "./ebpf"
import { FunctionRegistry, SBPFVersion } from "./program"

export interface Executable {
    /** Required SBPF capabilities */
    sbpfVersion: SBPFVersion
    slots: Array<InsnRaw>
    /** Call resolution map (hash, pc, name) */
    functionRegistry: FunctionRegistry<bigint>
}

export const Executable = {
    getFunctionRegistry(executable: Executable) {
        return executable.functionRegistry
    },
}
