import { Insn } from "./ebpf"
import { SBPFVersion } from "./program"

export interface Executable {
    sbpfVersion: SBPFVersion
    instructions: Array<Insn>
}
