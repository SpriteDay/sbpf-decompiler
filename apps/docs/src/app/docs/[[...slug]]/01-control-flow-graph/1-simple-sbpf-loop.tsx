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
import { useCallback, useMemo, useState } from "react"
import { Label } from "@/components/ui/label"
import { WideSlider } from "@/components/custom/wide-slider"
import { Button } from "@/components/ui/button"
import { runV3InstructionsWithTracing } from "@/components/micro-vm/v3-harness"

const Program: Array<Insn> = [
    { ptr: 0x00n, opc: OpCodes.MOV64_IMM, dst: 1n, src: 0n, off: 0n, imm: 0n },
    { ptr: 0x00n, opc: OpCodes.MOV64_IMM, dst: 2n, src: 0n, off: 0n, imm: 3n },
    // biome-ignore format: Keeping all of the instructions in one line
    { ptr: 0x00n, opc: OpCodes.JEQ64_IMM, dst: 2n, src: 0n, off: 6n, imm: 0n },
    // biome-ignore format: Keeping all of the instructions in one line
    { ptr: 0x00n, opc: OpCodes.JGT64_IMM, dst: 2n, src: 0n, off: 2n, imm: 10n },
    { ptr: 0x00n, opc: OpCodes.ADD64_REG, dst: 1n, src: 2n, off: 0n, imm: 0n },
    { ptr: 0x00n, opc: OpCodes.JA, dst: 0n, src: 0n, off: 1n, imm: 0n },
    { ptr: 0x00n, opc: OpCodes.ADD64_IMM, dst: 1n, src: 0n, off: 0n, imm: 10n },
    { ptr: 0x00n, opc: OpCodes.SUB64_IMM, dst: 2n, src: 0n, off: 0n, imm: 1n },
    { ptr: 0x00n, opc: OpCodes.JA, dst: 0n, src: 0n, off: -7n, imm: 0n },
    { ptr: 0x00n, opc: OpCodes.MOV64_REG, dst: 0n, src: 1n, off: 0n, imm: 0n },
    { ptr: 0x00n, opc: OpCodes.EXIT, dst: 0n, src: 0n, off: 0n, imm: 0n },
]

export function SimpleSbpfLoop() {
    const [currentStep, setCurrentStep] = useState(0)
    const { registerTrace } = useMemo(() => {
        return runV3InstructionsWithTracing({ instructions: Program })
    }, [])
    const updateCurrentStep = useCallback(
        (newValue: number) => {
            if (newValue > registerTrace.length - 1 || newValue < 0) {
                return
            }
            setCurrentStep(newValue)
        },
        [registerTrace],
    )
    return (
        <Card>
            <CardHeader>
                <CardTitle>Example of a simple SBPF loop program</CardTitle>
                <CardDescription>
                    Use slider or buttons to step through execution
                </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center py-2">
                <ExecutionInspector
                    instructions={Program}
                    registerTrace={registerTrace}
                    currentStep={currentStep}
                />
            </CardContent>
            <CardFooter className="flex-col items-start gap-4 text-sm">
                <div className="flex w-full flex-col items-center gap-4 ">
                    <Label>
                        Current step:{" "}
                        <span className="font-bold tabular-nums font-mono">
                            {currentStep + 1}
                        </span>
                    </Label>
                    <WideSlider
                        value={[currentStep]}
                        onValueChange={(value) => {
                            updateCurrentStep(value as number)
                        }}
                        min={0}
                        max={registerTrace.length - 1}
                        step={1}
                        className="mx-auto w-full max-w-lg"
                    />
                    <div className="w-full flex justify-center items-center gap-4">
                        <Button
                            className="w-[10ch]"
                            disabled={currentStep === 0}
                            onClick={() => updateCurrentStep(currentStep - 1)}
                        >
                            Previous
                        </Button>
                        <Button
                            className="w-[10ch]"
                            disabled={currentStep === registerTrace.length - 1}
                            onClick={() => updateCurrentStep(currentStep + 1)}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </CardFooter>
        </Card>
    )
}
