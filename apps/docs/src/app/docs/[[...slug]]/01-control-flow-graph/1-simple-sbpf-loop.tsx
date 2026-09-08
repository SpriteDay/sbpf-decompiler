import { Insn, OpCodes } from "@/components/micro-vm/ebpf"
import { ExecutionInspector } from "../components/execution-inspector"

const program: Array<Insn> = [
    { ptr: 0x00n, opc: OpCodes.MOV64_IMM, dst: 1n, src: 0n, off: 0n, imm: 0n },
    // biome-ignore format: Keeping all of the instructions in one line
    { ptr: 0x00n, opc: OpCodes.LD_8B_REG, dst: 2n, src: 10n, off: -8n, imm: 0n },
    { ptr: 0x00n, opc: OpCodes.JEQ64_IMM, dst: 2n, src: 0n, off: 4n, imm: 0n },
    { ptr: 0x00n, opc: OpCodes.ADD64_IMM, dst: 1n, src: 0n, off: 0n, imm: 1n },
    // biome-ignore format: Keeping all of the instructions in one line
    { ptr: 0x00n, opc: OpCodes.JGT64_IMM, dst: 2n, src: 0n, off: 2n, imm: 100n },
    { ptr: 0x00n, opc: OpCodes.SUB64_IMM, dst: 2n, src: 0n, off: 0n, imm: 1n },
    { ptr: 0x00n, opc: OpCodes.JA, dst: 0n, src: 0n, off: -5n, imm: 0n },
    { ptr: 0x00n, opc: OpCodes.MOV64_REG, dst: 0n, src: 1n, off: 0n, imm: 0n },
    { ptr: 0x00n, opc: OpCodes.EXIT, dst: 0n, src: 0n, off: 0n, imm: 0n },
]

export function SimpleSbpfLoop() {
    return <ExecutionInspector program={program} />
}
