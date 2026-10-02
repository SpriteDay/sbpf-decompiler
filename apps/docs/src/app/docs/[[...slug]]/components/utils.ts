import { InsnRaw, OpCodes } from "@/components/micro-vm/ebpf"

export type FomrattingStyle = "NASM" | "LLVM"

export function formatInstruction({
    prog,
    pc,
    style,
    augmentLddw = false,
}: {
    prog: Array<InsnRaw>
    pc: bigint
    style?: FomrattingStyle
    augmentLddw?: boolean
}): string {
    const styleWithFallback = style || "NASM"
    const { opc, dst, src, off, imm } = prog[Number(pc)]
    let formatted = {
        "LLVM": "uknown operation",
        "NASM": "uknown operation",
    }
    switch (opc) {
        case OpCodes.LD_DW_IMM: {
            const slot = prog[Number(pc)]
            const moreSignificantHalf = prog[Number(pc) + 1].imm
            let resultImm = imm
            if (augmentLddw) {
                resultImm = BigInt.asIntN(
                    64,
                    (BigInt.asUintN(64, slot.imm) & 0xffff_ffffn) |
                        (BigInt.asUintN(64, moreSignificantHalf) << 32n),
                )
            }
            formatted = {
                "LLVM": `r${dst} = 0x${resultImm.toString(16)}`,
                "NASM": `lddw r${dst}, 0x${resultImm.toString(16)}`,
            }
            break
        }
        case 0x00n: {
            if (!augmentLddw) {
                formatted = {
                    "LLVM": `0x00 0x${imm.toString(16)}`,
                    "NASM": `0x00 0x${imm.toString(16)}`,
                }
            } else {
                return "<Unknown opcode>"
            }
            break
        }
        case OpCodes.LD_8B_REG: {
            formatted = {
                "LLVM": `r${dst} = (r${src} + ${off}) as u64`,
                "NASM": `ldxdw r${dst}, [r${src}+${off}]`,
            }
            break
        }
        case OpCodes.MOV64_IMM: {
            formatted = {
                "LLVM": `r${dst} = ${imm}`,
                "NASM": `mov64 r${dst}, ${imm}`,
            }
            break
        }
        case OpCodes.MOV64_REG: {
            formatted = {
                "LLVM": `r${dst} = r${src}`,
                "NASM": `mov64 r${dst}, r${src}`,
            }
            break
        }
        case OpCodes.ADD64_IMM: {
            formatted = {
                "LLVM": `r${dst} += ${imm}`,
                "NASM": `add64 r${dst}, ${imm}`,
            }
            break
        }
        case OpCodes.ADD64_REG: {
            formatted = {
                "LLVM": `r${dst} += r${src}`,
                "NASM": `add64 r${dst}, r${src}`,
            }
            break
        }
        case OpCodes.SUB64_IMM: {
            formatted = {
                "LLVM": `r${dst} -= ${imm}`,
                "NASM": `sub64, r${dst}, ${imm}`,
            }
            break
        }
        case OpCodes.JA: {
            formatted = { "LLVM": `PC += ${off}`, "NASM": `ja +${off}` }
            break
        }
        case OpCodes.JEQ64_IMM: {
            formatted = {
                "LLVM": `PC += ${off} if r${dst} == ${imm}`,
                "NASM": `jeq64 r${dst}, ${imm}, +${off}`,
            }
            break
        }
        case OpCodes.JGT64_IMM: {
            formatted = {
                "LLVM": `PC += ${off} if r${dst} > ${imm}`,
                "NASM": `jgt64 r${dst}, ${imm}, +${off}`,
            }
            break
        }
        case OpCodes.CALL_IMM: {
            formatted = {
                "LLVM": `call 0x${imm.toString(16).padStart(32, "0")}`,
                "NASM": `call 0x${imm.toString(16).padStart(32, "0")}`,
            }
            break
        }
        case OpCodes.CALL_REG: {
            formatted = {
                "LLVM": `call r${dst}`,
                "NASM": `call r${dst}`,
            }
            break
        }
        case OpCodes.EXIT: {
            formatted = { "LLVM": `return r0`, "NASM": `exit` }
            break
        }
        default:
            return "<Unknown opcode>"
    }
    return formatted[styleWithFallback]
}
