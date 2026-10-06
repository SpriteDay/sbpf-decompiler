"use client"

import { insnRaw } from "@/components/micro-vm/assembler"
import { InsnRaw, OpCodes } from "@/components/micro-vm/ebpf"
import { Card, CardContent } from "@/components/ui/card"
import { byteArrayToHex } from "@/lib/utils"
import { formatInstruction } from "../components/utils"

const Slots: Array<InsnRaw> = [
    { opc: OpCodes.MOV64_IMM, dst: 1n, src: 0n, off: 0n, imm: 5n },
    { opc: OpCodes.LD_DW_IMM, dst: 2n, src: 0n, off: 0n, imm: 0x55667788n },
    { opc: 0x00n, dst: 0n, src: 0n, off: 0n, imm: 0x11223344n },
    { opc: OpCodes.ADD64_REG, dst: 1n, src: 2n, off: 0n, imm: 0n },
    { opc: OpCodes.EXIT, dst: 0n, src: 0n, off: 0n, imm: 0n },
]

export function SlotsParsing() {
    return (
        <Card>
            <CardContent className="flex justify-center py-2">
                <div className="flex flex-col gap-2 px-2">
                    {Slots.map(({ opc, dst, src, off, imm }, index) => (
                        <span key={index} className="font-mono">
                            <span className="opacity-50">{index + 1}:</span>{" "}
                            {byteArrayToHex(
                                insnRaw(opc, dst, src, off, imm),
                                " ",
                            )}
                        </span>
                    ))}
                </div>
                <div className="flex flex-col gap-2 px-2">
                    {Slots.map((_, index) => (
                        <span key={index} className="font-mono">
                            <span className="opacity-70">
                                {formatInstruction({
                                    prog: Slots,
                                    pc: BigInt(index),
                                })}
                            </span>
                        </span>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
