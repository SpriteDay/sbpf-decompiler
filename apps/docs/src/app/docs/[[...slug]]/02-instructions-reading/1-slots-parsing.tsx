"use client"

import { insnRaw } from "@/components/micro-vm/assembler"
import { InsnRaw, OpCodes } from "@/components/micro-vm/ebpf"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { uint8ArrToHex } from "@/lib/utils"

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
            <CardHeader>
                <CardTitle>
                    Example of how slots get parsed into intructions
                </CardTitle>
                <CardDescription></CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center py-2">
                <div className="flex flex-col gap-2 px-2">
                    {Slots.map(({ opc, dst, src, off, imm }, index) => (
                        <span key={index} className="font-mono">
                            <span className="opacity-50">{index + 1}:</span>{" "}
                            {uint8ArrToHex(
                                insnRaw(opc, dst, src, off, imm),
                                " ",
                            )}
                        </span>
                    ))}
                </div>
            </CardContent>
            <CardFooter className="flex-col items-start gap-4 text-sm"></CardFooter>
        </Card>
    )
}
