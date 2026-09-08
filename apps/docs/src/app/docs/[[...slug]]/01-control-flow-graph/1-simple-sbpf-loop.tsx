"use client"

import { Insn, OpCodes } from "@/components/micro-vm/ebpf"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { ExecutionInspector } from "../components/execution-inspector"
import { useCallback, useState } from "react"
import { Label } from "@/components/ui/label"
import { WideSlider } from "@/components/custom/wide-slider"
import { Button } from "@/components/ui/button"

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
    const [currentInstruction, setCurrentInstruction] = useState(0)
    const updateCurrentInstruction = useCallback((newValue: number) => {
        if (newValue > program.length || newValue <= 0) {
            return
        }
        setCurrentInstruction(newValue)
    }, [])
    return (
        <Card>
            <CardHeader>
                <CardTitle>Example of modulo with 12 hours clock</CardTitle>
                <CardDescription>
                    Use slider to count more hours
                </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center py-2">
                <ExecutionInspector
                    program={program}
                    currentInstruction={currentInstruction}
                />
            </CardContent>
            <CardFooter className="flex-col items-start gap-4 text-sm">
                <div className="flex w-full flex-col items-center gap-4 ">
                    <Label>
                        Current instruction number:{" "}
                        <span className="font-bold tabular-nums font-mono">
                            {currentInstruction}
                        </span>
                    </Label>
                    <WideSlider
                        defaultValue={[0]}
                        onValueChange={(value) => {
                            updateCurrentInstruction(value as number)
                        }}
                        min={0}
                        max={program.length}
                        step={1}
                        className="mx-auto w-full"
                    />
                    <div className="w-full flex justify-center items-center gap-4">
                        <Button
                            disabled={currentInstruction === 0}
                            onClick={() =>
                                updateCurrentInstruction(currentInstruction - 1)
                            }
                        >
                            Previous
                        </Button>
                        <Button
                            disabled={currentInstruction === program.length - 1}
                            onClick={() =>
                                updateCurrentInstruction(currentInstruction + 1)
                            }
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </CardFooter>
        </Card>
    )
}
