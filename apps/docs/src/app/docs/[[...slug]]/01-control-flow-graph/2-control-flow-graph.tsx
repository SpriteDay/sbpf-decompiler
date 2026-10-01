"use client"

import { InsnRaw, OpCodes } from "@/components/micro-vm/ebpf"
import { Analysis } from "@/components/micro-vm/static-analysis"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ExecutionInspector } from "../components/execution-inspector"
import { runV3InstructionsWithTracing } from "@/components/micro-vm/v3-harness"
import { WideSlider } from "@/components/custom/wide-slider"

const Slots: Array<InsnRaw> = [
    { opc: OpCodes.LD_DW_IMM, dst: 1n, src: 0n, off: 0n, imm: 0x02n },
    { opc: 0x00n, dst: 0n, src: 0n, off: 0n, imm: 0x01n },
    { opc: OpCodes.MOV64_IMM, dst: 0n, src: 0n, off: 0n, imm: 0x07n },
    { opc: OpCodes.LD_DW_IMM, dst: 2n, src: 0n, off: 0n, imm: 0x05n },
    { opc: 0x00n, dst: 0n, src: 0n, off: 0n, imm: 0x00n },
    { opc: OpCodes.ADD64_REG, dst: 0n, src: 2n, off: 0n, imm: 0x00n },
    { opc: OpCodes.EXIT, dst: 0n, src: 0n, off: 0n, imm: 0x00n },
]

export function ControlFlowGraph() {
    const [currentStep, setCurrentStep] = useState(0)
    const { registerTrace, executable } = useMemo(() => {
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
    useEffect(() => {
        const analysis = Analysis.fromExecutable({ executable })
    }, [executable])
    return (
        <Card>
            <CardHeader>
                <CardTitle>Static Analysis Debug</CardTitle>
                <CardDescription></CardDescription>
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
                </div>
            </CardFooter>
        </Card>
    )
}
