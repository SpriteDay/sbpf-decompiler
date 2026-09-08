import { Insn, OpCodes } from "@/components/micro-vm/ebpf"

export type FomrattingStyle = "NASM" | "LLVM"

export function formatInstruction(insn: Insn, style?: FomrattingStyle): string {
    const styleWithFallback = style || "NASM"
    const { opc, dst, src, off, imm } = insn
    let formatted = {
        "LLVM": "uknown operation",
        "NASM": "uknown operation",
    }
    switch (opc) {
        case OpCodes.LD_8B_REG: {
            formatted = {
                "LLVM": `${dst} = (${src} + ${off}) as u64`,
                "NASM": `ldxdw ${dst}, [${src}+${off}]`,
            }
            break
        }
        case OpCodes.MOV64_IMM: {
            formatted = {
                "LLVM": `${dst} = ${imm}`,
                "NASM": `mov64 ${dst}, ${imm}`,
            }
            break
        }
        case OpCodes.MOV64_REG: {
            formatted = {
                "LLVM": `${dst} = ${src}`,
                "NASM": `mov64 ${dst}, ${src}`,
            }
            break
        }
        case OpCodes.ADD64_IMM: {
            formatted = {
                "LLVM": `${dst} += ${imm}`,
                "NASM": `add64 ${dst}, ${imm}`,
            }
            break
        }
        case OpCodes.SUB64_IMM: {
            formatted = {
                "LLVM": `${dst} -= ${imm}`,
                "NASM": `sub64, ${dst}, ${imm}`,
            }
            break
        }
        case OpCodes.JA: {
            formatted = { "LLVM": `PC += ${off}`, "NASM": `ja +${off}` }
            break
        }
        case OpCodes.JEQ64_IMM: {
            formatted = {
                "LLVM": `PC += ${off} if ${dst} == ${imm}`,
                "NASM": `jeq64 ${dst}, ${imm}, +${off}`,
            }
            break
        }
        case OpCodes.JGT64_IMM: {
            formatted = {
                "LLVM": `PC += ${off} if ${dst} > ${imm}`,
                "NASM": `jgt64 ${dst}, ${imm}, +${off}`,
            }
            break
        }
        case OpCodes.EXIT: {
            formatted = { "LLVM": `return r0`, "NASM": `exit` }
            break
        }
        default:
            return "Unknown opcode"
    }
    return formatted[styleWithFallback]
}
