import { InsnRaw } from "./ebpf"
import { BuiltinProgram, FunctionRegistry, SBPFVersion } from "./program"

export interface Executable {
    /** Required SBPF capabilities */
    sbpfVersion: SBPFVersion
    slots: Array<InsnRaw>
    /** Call resolution map (hash, pc, name) */
    functionRegistry: FunctionRegistry<bigint>
    /** Loader built-in program */
    loader: BuiltinProgram
}

export const Executable = {
    getFunctionRegistry(self: Executable) {
        return self.functionRegistry
    },
}
