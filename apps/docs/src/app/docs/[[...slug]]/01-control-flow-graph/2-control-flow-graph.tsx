"use client"

import { InsnRaw, OpCodes } from "@/components/micro-vm/ebpf"
import { Executable } from "@/components/micro-vm/elf"
import { FunctionRegistry } from "@/components/micro-vm/program"
import { Analysis } from "@/components/micro-vm/static-analysis"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { useEffect } from "react"

const Slots: Array<InsnRaw> = [
    { opc: OpCodes.LD_DW_IMM, dst: 1n, src: 0n, off: 0n, imm: 0x02n },
    { opc: 0x00n, dst: 0n, src: 0n, off: 0n, imm: 0x01n },
    { opc: OpCodes.MOV64_IMM, dst: 0n, src: 0n, off: 0n, imm: 0x07n },
    { opc: OpCodes.LD_DW_IMM, dst: 2n, src: 0n, off: 0n, imm: 0x05n },
    { opc: 0x00n, dst: 0n, src: 0n, off: 0n, imm: 0x00n },
    { opc: OpCodes.EXIT, dst: 0n, src: 0n, off: 0n, imm: 0x00n },
]

export function ControlFlowGraph() {
    useEffect(() => {
        const executable: Executable = {
            slots: Slots,
            sbpfVersion: "V3",
            functionRegistry: FunctionRegistry.default(),
        }
        const analysis = Analysis.fromExecutable({ executable })
    }, [])
    return (
        <Card>
            <CardHeader>
                <CardTitle></CardTitle>
                <CardDescription></CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center py-2"></CardContent>
            <CardFooter className="flex-col items-start gap-4 text-sm">
                <div className="flex w-full flex-col items-center gap-4 "></div>
            </CardFooter>
        </Card>
    )
}
