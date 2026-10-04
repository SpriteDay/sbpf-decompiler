import { InsnRaw } from "@/components/micro-vm/ebpf"
import React, { useMemo, useState } from "react"
import { FunctionRegistry, SBPFVersion } from "@/components/micro-vm/program"
import { formatInstruction, FormattingStyle } from "../../../components/utils"
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"
import { createPortal } from "react-dom"
import { FormattingSelector } from "../components/formatting-selector"
import { accumulateLeadersAndEdges } from "./utils"
import { cn } from "@/lib/utils"
import { u8ArrayToString } from "@/components/micro-vm/dependencies/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { WideSlider } from "@/components/custom/wide-slider"
import { Label } from "@/components/ui/label"

export function FilteringStage({
    slots,
    functionRegistry,
    sbpfVersion,
    formatStyle,
    setFormatStyle,
    leftBlock,
    rightBlock,
}: {
    slots: Array<InsnRaw>
    functionRegistry: FunctionRegistry<bigint>
    sbpfVersion: SBPFVersion
    formatStyle: FormattingStyle
    setFormatStyle: React.ComponentProps<
        typeof FormattingSelector
    >["setFormatStyle"]
    leftBlock: HTMLElement
    rightBlock: HTMLElement
}) {
    const [currentStep, setCurrentStep] = useState(0)
    const { leaders, edges } = useMemo(() => {
        return accumulateLeadersAndEdges({
            slots,
            endPc: BigInt(slots.length - 1),
            functionRegistry,
            sbpfVersion,
        })
    }, [slots, functionRegistry, sbpfVersion])
    const maxStep =
        leaders.inner.size +
        edges.inner.size +
        functionRegistry.map.inner.size -
        1
    return (
        <>
            {createPortal(
                <div className="relative flex justify-center p-2 flex-col gap-1 ">
                    <div className="absolute bottom-3 right-3 z-10 opacity-90">
                        <FormattingSelector
                            formatStyle={formatStyle}
                            setFormatStyle={setFormatStyle}
                        />
                    </div>
                    {slots.map((_, index) => {
                        const labelU8Arr = functionRegistry.map.inner.get(
                            BigInt(index),
                        )?.[0]
                        const isLeader = !!leaders.inner.get(BigInt(index))
                        const isEdge = !!edges.inner.get(BigInt(index))
                        return (
                            <React.Fragment key={index}>
                                {labelU8Arr && (
                                    <span className="font-semibold opacity-60 font-mono rounded-sm px-1">
                                        {u8ArrayToString(labelU8Arr)}:
                                    </span>
                                )}
                                <span
                                    key={index}
                                    className={cn(
                                        "font-semibold font-mono rounded-sm pe-1 ps-4 transition-colors duration-100",
                                        isLeader &&
                                            "bg-red-800/15 dark:bg-red-800/15",
                                        isEdge &&
                                            "bg-indigo-800/15 dark:bg-indigo-800/15",
                                    )}
                                >
                                    {index}:{" "}
                                    {formatInstruction({
                                        prog: slots,
                                        pc: BigInt(index),
                                        style: formatStyle,
                                    })}
                                </span>
                            </React.Fragment>
                        )
                    })}
                </div>,
                leftBlock,
            )}
            {createPortal(
                <ResizablePanelGroup key={1} orientation="vertical">
                    <ResizablePanel defaultSize="70%">
                        <div className="flex justify-center p-2 flex-col gap-1">
                            <p>
                                Leaders:{" "}
                                {leaders.inner.size === 0 ? (
                                    <span className="text-foreground/50">
                                        {"<Empty>"}
                                    </span>
                                ) : (
                                    Array.from(leaders.inner).map(
                                        ([pc, _], index) => {
                                            const isActive =
                                                index === currentStep
                                            return (
                                                <Badge
                                                    className={cn(
                                                        "text-foreground me-1 mb-1",
                                                        isActive
                                                            ? "bg-red-950 dark:bg-red-700 text-background dark:text-foreground"
                                                            : "bg-red-800/15 dark:bg-red-500/15",
                                                    )}
                                                    key={pc}
                                                >
                                                    {pc}
                                                </Badge>
                                            )
                                        },
                                    )
                                )}
                            </p>
                            <p>
                                Edges:{" "}
                                {edges.inner.size === 0 ? (
                                    <span className="text-foreground/50">
                                        {"<Empty>"}
                                    </span>
                                ) : (
                                    Array.from(edges.inner).map(
                                        ([pc, _], index) => {
                                            const isActive =
                                                index + leaders.inner.size ===
                                                currentStep
                                            return (
                                                <Badge
                                                    className={cn(
                                                        "text-foreground me-1 mb-1",
                                                        isActive
                                                            ? "bg-indigo-950 dark:bg-indigo-700 text-background dark:text-foreground"
                                                            : "bg-indigo-800/15 dark:bg-indigo-500/15",
                                                    )}
                                                    key={pc}
                                                >
                                                    {pc}
                                                </Badge>
                                            )
                                        },
                                    )
                                )}
                            </p>
                        </div>
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel
                        defaultSize="30%"
                        className="flex justify-center items-center"
                    >
                        <div className="flex w-full flex-col items-center  gap-4 p-3">
                            <Label>
                                Current PC:
                                <span className="font-bold tabular-nums">
                                    {currentStep}
                                </span>
                            </Label>
                            <WideSlider
                                value={[currentStep]}
                                onValueChange={(value) => {
                                    setCurrentStep(value as number)
                                }}
                                min={0}
                                max={maxStep}
                                step={1}
                                className="mx-auto w-full max-w-lg"
                            />
                            <div className="w-full flex justify-center items-center gap-4">
                                <Button
                                    className="w-[10ch]"
                                    disabled={currentStep <= 0}
                                    onClick={() =>
                                        setCurrentStep((prev) => prev - 1)
                                    }
                                >
                                    Previous
                                </Button>
                                <Button
                                    className="w-[10ch]"
                                    disabled={currentStep === maxStep}
                                    onClick={() =>
                                        setCurrentStep((prev) => prev + 1)
                                    }
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </ResizablePanel>
                </ResizablePanelGroup>,
                rightBlock,
            )}
        </>
    )
}
