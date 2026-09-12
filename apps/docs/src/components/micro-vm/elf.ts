import { Insn } from "./ebpf"
import { SBPFVersion } from "./program"

export interface Executable {
    /** Required SBPF capabilities */
    sbpfVersion: SBPFVersion
    instructions: Array<Insn>
}

export const Executable = {
    getFunctionRegistry(executable: Executable) {},
}
