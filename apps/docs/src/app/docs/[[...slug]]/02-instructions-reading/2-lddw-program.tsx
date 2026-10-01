"use client"

import { InsnRaw, OpCodes } from "@/components/micro-vm/ebpf"
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

const Slots: Array<InsnRaw> = [
    { opc: OpCodes.MOV64_IMM, dst: 1n, src: 0n, off: 0n, imm: 5n },
    { opc: OpCodes.LD_DW_IMM, dst: 2n, src: 0n, off: 0n, imm: 0x55667788n },
    { opc: 0x00n, dst: 0n, src: 0n, off: 0n, imm: 0x11223344n },
    { opc: OpCodes.ADD64_REG, dst: 1n, src: 2n, off: 0n, imm: 0n },
    { opc: OpCodes.EXIT, dst: 0n, src: 0n, off: 0n, imm: 0n },
]

export function LddwProgram() {
    const [currentStep, setCurrentStep] = useState(0)
    const { registerTrace } = useMemo(() => {
        return runV3InstructionsWithTracing({ slots: Slots })
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
                    slots={Slots}
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
