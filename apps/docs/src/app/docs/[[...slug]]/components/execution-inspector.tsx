"use client"
import { Insn } from "@/components/micro-vm/ebpf"
import { runV3InstructionsWithTracing } from "@/components/micro-vm/v3-harness"
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"
import { cn } from "@/lib/utils"
import { useMemo } from "react"
import { formatInstruction } from "./utils"

export function ExecutionInspector({
    program,
    currentInstruction,
}: {
    program: Array<Insn>
    currentInstruction: number
}) {
    const programResult = useMemo(() => {
        return runV3InstructionsWithTracing({ instructions: program })
    }, [program])

    const currentRegistersState = useMemo(() => {
        return programResult.registerTrace[currentInstruction]
    }, [programResult, currentInstruction])

    const changedRegisters: Array<number> = useMemo(() => {
        const result: Array<number> = []
        if (currentInstruction === 0) {
            return result
        }
        const prevRegistersState =
            programResult.registerTrace[currentInstruction - 1]
        currentRegistersState.forEach((reg, index) => {
            if (reg !== prevRegistersState[index]) {
                result.push(index)
            }
        })
        return result
    }, [programResult.registerTrace, currentRegistersState, currentInstruction])

    return (
        <ResizablePanelGroup
            orientation="horizontal"
            className=" rounded-lg border"
        >
            <ResizablePanel defaultSize="50%">
                <div className="flex justify-center p-2 flex-col gap-1">
                    {program.map((instruction, index) => {
                        return (
                            <span
                                key={index}
                                className={cn(
                                    "font-semibold font-mono rounded-sm px-1",
                                    index === currentInstruction &&
                                        "bg-foreground text-background",
                                    index === currentInstruction - 1 &&
                                        "bg-amber-200/20",
                                )}
                            >
                                {index + 1}: {formatInstruction(instruction)}
                            </span>
                        )
                    })}
                </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="50%">
                <div className="flex flex-col gap-1 p-2">
                    {Array.from(currentRegistersState, (reg, index) => (
                        <span
                            key={index}
                            className={cn(
                                "font-mono",
                                changedRegisters.includes(index) &&
                                    "bg-amber-200/20 font-semibold",
                            )}
                        >
                            r{index}: 0x{reg.toString(16)}
                        </span>
                    ))}
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
    )
}
