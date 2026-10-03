"use client"

import { InsnRaw, OpCodes } from "@/components/micro-vm/ebpf"
import { Analysis } from "@/components/micro-vm/static-analysis"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { useEffect, useRef, useState } from "react"
import { WideSlider } from "@/components/custom/wide-slider"
import { Executable } from "@/components/micro-vm/elf"
import { BuiltinProgram, FunctionRegistry } from "@/components/micro-vm/program"
import { Config } from "@/components/micro-vm/vm"
import { FomrattingStyle, formatInstruction } from "../components/utils"
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

const Slots: Array<InsnRaw> = [
    { opc: OpCodes.MOV64_IMM, dst: 1n, src: 0n, off: 0n, imm: 0x01n },
    { opc: OpCodes.JEQ64_IMM, dst: 1n, src: 0n, off: 1n, imm: 0x01n },
    { opc: OpCodes.LD_DW_IMM, dst: 1n, src: 0n, off: 0n, imm: 0x55667788n },
    { opc: 0x00n, dst: 0n, src: 0n, off: 0n, imm: 0x11223344n },
    { opc: OpCodes.ADD64_REG, dst: 1n, src: 2n, off: 0n, imm: 0x00n },
    { opc: OpCodes.EXIT, dst: 0n, src: 0n, off: 0n, imm: 0x00n },
]

const StagesMap = {
    "Leaders & Edges": RecordingLeadersAndEdgesStage,
    "Filtering": FilteringStage,
    "Basic Blocks": DefiningBlockBoundariesStage,
} as const satisfies Record<
    string,
    (props: {
        slots: Array<InsnRaw>
        formatStyle: FomrattingStyle
    }) => React.ReactNode[]
>

type Stage = keyof typeof StagesMap

export function ControlFlowGraph() {
    const [stage, setStage] = useState<Stage>("Leaders & Edges")
    const [formatStyle, setFormatStyle] = useState<FomrattingStyle>("NASM")

    // Debug static analysis implementation
    useEffect(() => {
        const config = Config.default()
        config.enableRegisterTracing = true
        const loader = BuiltinProgram.new({ config })

        const executable: Executable = {
            slots: Slots,
            sbpfVersion: "V3",
            functionRegistry: FunctionRegistry.default(),
            loader,
        }
        const _analysis = Analysis.fromExecutable({ executable })
    }, [])
    return (
        <Card>
            <CardHeader>
                <CardTitle>Static Analysis Debug</CardTitle>
                <CardDescription></CardDescription>
            </CardHeader>
            <CardContent className="relative flex justify-center py-2">
                <div className="absolute top-2 right-2 z-10 opacity-90">
                    <ToggleGroup
                        variant="outline"
                        value={[stage]}
                        onValueChange={(value) => setStage(value[0] as Stage)}
                    >
                        <ToggleGroupItem value="Leaders & Edges">
                            Leaders & Edges
                        </ToggleGroupItem>
                        <ToggleGroupItem value="Filtering">
                            Filtering
                        </ToggleGroupItem>
                        <ToggleGroupItem value="Basic Blocks">
                            Basic Blocks
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>
                <div className="w-full flex justify-center">
                    <ToggleGroup
                        variant="outline"
                        value={[formatStyle]}
                        onValueChange={(value) =>
                            setFormatStyle(value[0] as FomrattingStyle)
                        }
                    >
                        <ToggleGroupItem value="NASM">NASM</ToggleGroupItem>
                        <ToggleGroupItem value="LLVM">LLVM</ToggleGroupItem>
                    </ToggleGroup>
                </div>
                <ResizablePanelGroup
                    orientation="horizontal"
                    className="relative rounded-lg border"
                >
                    <ResizablePanel defaultSize="50%">
                        {StagesMap[stage]({ slots: Slots, formatStyle })[0]}
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize="50%">
                        {StagesMap[stage]({ slots: Slots, formatStyle })[1]}
                    </ResizablePanel>
                </ResizablePanelGroup>
            </CardContent>
        </Card>
    )
}

function RecordingLeadersAndEdgesStage({
    slots,
    formatStyle,
}: {
    slots: Array<InsnRaw>
    formatStyle: FomrattingStyle
}) {
    const [currentPc, setCurrentPc] = useState(0)
    const prevPc = useRef(-1)
    const updateCurrentPc = (newPc: number) => {
        setCurrentPc((prev) => {
            prevPc.current = prev
            return newPc
        })
    }
    return [
        <div key={0} className="flex justify-center p-2 flex-col gap-1 ">
            {/* eslint-disable-next-line react-hooks/refs */}
            {Slots.map((_, index) => {
                return (
                    <span
                        key={index}
                        className={cn(
                            "font-semibold font-mono rounded-sm px-1",
                            index === currentPc &&
                                "bg-foreground text-background",
                            index === prevPc.current &&
                                "bg-amber-950/10 dark:bg-amber-200/20",
                        )}
                    >
                        {index}:{" "}
                        {formatInstruction({
                            prog: Slots,
                            pc: BigInt(index),
                            style: formatStyle,
                        })}
                    </span>
                )
            })}
        </div>,
        <ResizablePanelGroup key={1} orientation="vertical">
            <ResizablePanel defaultSize="75%">
                <div className="flex justify-center p-2 flex-col gap-1"></div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="25%">
                <div className="flex w-full flex-col items-center gap-4">
                    <Label>
                        Current PC:
                        <span className="font-bold tabular-nums font-mono">
                            {currentPc}
                        </span>
                    </Label>
                    <WideSlider
                        value={[currentPc]}
                        onValueChange={(value) => {
                            updateCurrentPc(value as number)
                        }}
                        min={0}
                        max={slots.length}
                        step={1}
                        className="mx-auto w-full max-w-lg"
                    />
                    <div className="w-full flex justify-center items-center gap-4">
                        <Button
                            className="w-[10ch]"
                            disabled={currentPc === 0}
                            onClick={() => updateCurrentPc(currentPc - 1)}
                        >
                            Previous
                        </Button>
                        <Button
                            className="w-[10ch]"
                            disabled={currentPc === slots.length - 1}
                            onClick={() => updateCurrentPc(currentPc + 1)}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>,
    ]
}

function FilteringStage({
    slots,
    formatStyle,
}: {
    slots: Array<InsnRaw>
    formatStyle: FomrattingStyle
}) {
    return [null, null]
}

function DefiningBlockBoundariesStage({
    slots,
    formatStyle,
}: {
    slots: Array<InsnRaw>
    formatStyle: FomrattingStyle
}) {
    return [null, null]
}
