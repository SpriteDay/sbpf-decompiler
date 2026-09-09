"use client"
import { Insn } from "@/components/micro-vm/ebpf"
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"
import { cn } from "@/lib/utils"
import { useMemo, useState } from "react"
import { FomrattingStyle, formatInstruction } from "./utils"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export function ExecutionInspector({
    instructions,
    currentStep,
    registerTrace,
}: {
    instructions: Array<Insn>
    currentStep: number
    registerTrace: Array<BigUint64Array>
}) {
    const [formatStyle, setFormatStyle] = useState<FomrattingStyle>("NASM")

    const currentRegistersState = useMemo(() => {
        return registerTrace[currentStep]
    }, [registerTrace, currentStep])

    const currentPc = currentRegistersState[11]
    const prevPc = currentStep <= 0 ? -1 : registerTrace[currentStep - 1][11]

    const changedRegisters: Array<number> = useMemo(() => {
        const result: Array<number> = []
        if (currentStep === 0) {
            return result
        }
        const prevRegistersState = registerTrace[currentStep - 1]
        currentRegistersState.forEach((reg, index) => {
            if (reg !== prevRegistersState[index]) {
                result.push(index)
            }
        })
        return result
    }, [registerTrace, currentRegistersState, currentStep])

    return (
        <ResizablePanelGroup
            orientation="horizontal"
            className="relative rounded-lg border"
        >
            <div className="absolute top-2 right-2 z-10">
                <ToggleGroup
                    variant="outline"
                    value={[formatStyle]}
                    onValueChange={(value) =>
                        setFormatStyle(value[0] as FomrattingStyle)
                    }
                >
                    <ToggleGroupItem value="NASM" aria-label="Toggle all">
                        NASM
                    </ToggleGroupItem>
                    <ToggleGroupItem value="LLVM" aria-label="Toggle missed">
                        LLVM
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>
            <ResizablePanel defaultSize="50%">
                <div className="flex justify-center p-2 flex-col gap-1 ">
                    {instructions.map((instruction, index) => {
                        return (
                            <span
                                key={index}
                                className={cn(
                                    "font-semibold font-mono rounded-sm px-1",
                                    BigInt(index) === currentPc &&
                                        "bg-foreground text-background",
                                    BigInt(index) === prevPc &&
                                        "bg-amber-200/20",
                                )}
                            >
                                {index}:{" "}
                                {formatInstruction(instruction, formatStyle)}
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
                            {index === 11
                                ? `pc: ${reg}`
                                : `r${index}: 0x${reg.toString(16)}`}
                        </span>
                    ))}
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
    )
}
