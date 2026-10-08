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
import { u8ArrayToString } from "@/components/micro-vm/dependencies/utils"
import {
    getFilteredCfgNodesWithDestinations,
    groupInstructionsByCfgNodes,
} from "./utils"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { WideSlider } from "@/components/custom/wide-slider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function BlockBoundariesStage({
    slots,
    functionRegistry,
    sbpfVersion,
    formatStyle,
    setFormatStyle: _,
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

    const {
        cfgNodes,
        cfgEdges,
        instructionIndex,
        cfgNodeIndex,
        cfgEdgeIndex,
        lastEvent,
    } = useMemo(() => {
        return getFilteredCfgNodesWithDestinations({
            slots,
            sbpfVersion,
            functionRegistry,
            maxStep: currentStep,
        })
    }, [currentStep, sbpfVersion, slots, functionRegistry])

    const maxStep = cfgNodes.size + slots.length - 1

    const grouppedSlots = useMemo(() => {
        return groupInstructionsByCfgNodes({ cfgNodes, slots })
    }, [slots, cfgNodes])
    return (
        <>
            {createPortal(
                <div className="relative flex justify-center p-2 flex-col gap-1">
                    {/* <div className="absolute bottom-3 right-3 z-10 opacity-90">
                        <FormattingSelector
                            formatStyle={formatStyle}
                            setFormatStyle={setFormatStyle}
                        />
                    </div> */}
                    {grouppedSlots.map(
                        ({ owner, slots: groupSlots, startPc }, index) => (
                            <div
                                className={cn(
                                    "relative flex flex-col justify-center gap-1 rounded-sm",
                                    typeof owner !== "undefined" &&
                                        "bg-red-600/10 dark:bg-red-400/10 border border-red-600/50 dark:border-red-400/50",
                                )}
                                key={index}
                            >
                                {typeof owner === "number" && (
                                    <span className="absolute top-0.2 right-1 font-semibold text-red-800/80 dark:text-red-400">
                                        #{index + 1}
                                    </span>
                                )}
                                {groupSlots.map((_, groupPc) => {
                                    const pc = startPc + groupPc
                                    const labelU8Arr =
                                        functionRegistry.inner.get(
                                            BigInt(pc),
                                        )?.[0]
                                    const isActive = instructionIndex === pc
                                    const isLeader = !!cfgNodes.get(BigInt(pc))
                                    const isEdge = !!cfgEdges.get(BigInt(pc))
                                    return (
                                        <React.Fragment key={pc}>
                                            {labelU8Arr && (
                                                <span className="font-semibold opacity-60 font-mono rounded-sm px-1">
                                                    {u8ArrayToString(
                                                        labelU8Arr,
                                                    )}
                                                    :
                                                </span>
                                            )}
                                            <span
                                                key={pc}
                                                className={cn(
                                                    "font-semibold font-mono rounded-sm pe-1 ps-4 transition-colors duration-100",
                                                    isActive &&
                                                        "bg-foreground text-background",
                                                    isLeader &&
                                                        (isActive
                                                            ? "bg-red-950 dark:bg-red-700 text-background dark:text-foreground"
                                                            : "bg-red-800/15 dark:bg-red-800/15"),
                                                    isEdge &&
                                                        (isActive
                                                            ? "bg-indigo-950 dark:bg-indigo-700 text-background dark:text-foreground"
                                                            : "bg-indigo-800/15 dark:bg-indigo-800/15"),
                                                    isLeader &&
                                                        isEdge &&
                                                        (isActive
                                                            ? "bg-linear-to-r from-red-950 dark:from-red-700 to-indigo-950 dark:to-indigo-700 text-background dark:text-foreground"
                                                            : "bg-linear-to-r from-red-800/15 dark:from-red-800/15 to-indigo-800/15 dark:to-indigo-800/15"),
                                                )}
                                            >
                                                {pc}:{" "}
                                                {formatInstruction({
                                                    prog: slots,
                                                    pc: BigInt(pc),
                                                    style: formatStyle,
                                                })}
                                            </span>
                                        </React.Fragment>
                                    )
                                })}
                            </div>
                        ),
                    )}
                </div>,
                leftBlock,
            )}
            {createPortal(
                <ResizablePanelGroup key={1} orientation="vertical">
                    <ResizablePanel defaultSize="70%">
                        <div className="flex justify-center p-2 flex-col gap-1">
                            <p>
                                Leaders:{" "}
                                {cfgNodes.size === 0 ? (
                                    <span className="text-foreground/50">
                                        {"<Empty>"}
                                    </span>
                                ) : (
                                    Array.from(cfgNodes).map(
                                        ([pc, cfgNode], index) => {
                                            const isActive =
                                                index === cfgNodeIndex
                                            const passedCfgNode =
                                                index <= cfgNodeIndex
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
                                                    {passedCfgNode && (
                                                        <span>
                                                            {"-> "}[
                                                            {cfgNode.destinations.join(
                                                                "|",
                                                            )}
                                                            ]
                                                        </span>
                                                    )}
                                                </Badge>
                                            )
                                        },
                                    )
                                )}
                            </p>
                            <p>
                                Edges:{" "}
                                {cfgEdges.size === 0 ? (
                                    <span className="text-foreground/50">
                                        {"<Empty>"}
                                    </span>
                                ) : (
                                    Array.from(cfgEdges).map(
                                        ([pc, _], index) => {
                                            const isActive =
                                                index === cfgEdgeIndex
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
                            <p>
                                Functions:{" "}
                                {functionRegistry.inner.size === 0 ? (
                                    <span className="text-foreground/50">
                                        {"<Empty>"}
                                    </span>
                                ) : (
                                    Array.from(functionRegistry.inner).map(
                                        ([key, [nameU8, _]]) => {
                                            const label =
                                                u8ArrayToString(nameU8)
                                            return (
                                                <Badge
                                                    className={cn(
                                                        "text-foreground me-1 mb-1",
                                                        "bg-green-800/15 dark:bg-green-500/15",
                                                    )}
                                                    key={key}
                                                >
                                                    {label}
                                                </Badge>
                                            )
                                        },
                                    )
                                )}
                            </p>
                            <div>
                                <span>Events:</span>
                                {!lastEvent ? (
                                    <span className="text-foreground/50">
                                        {" <Empty>"}
                                    </span>
                                ) : (
                                    <div className="flex flex-col gap-1">
                                        {lastEvent.type === "instruction" && (
                                            <span>
                                                <span className="text-red-950 dark:text-red-400 font-semibold">
                                                    - Instruction at PC{" "}
                                                    {lastEvent.index} was added
                                                    to CFG #
                                                    {lastEvent.cfgNodeIndex + 1}
                                                </span>
                                            </span>
                                        )}
                                        {lastEvent.type ===
                                            "destinations-edge" && (
                                            <span>
                                                <span className="text-indigo-950 dark:text-indigo-400 font-semibold">
                                                    - Destinations from edge{" "}
                                                    {lastEvent.sourceEdgePc} was
                                                    added to CFG #
                                                    {lastEvent.cfgNodeIndex + 1}
                                                </span>
                                            </span>
                                        )}
                                        {lastEvent.type ===
                                            "destinations-fall-through" && (
                                            <span>
                                                <span className="text-indigo-950 dark:text-indigo-400 font-semibold">
                                                    - Fall-through destination
                                                    PC {lastEvent.destination}{" "}
                                                    was added to CFG #
                                                    {lastEvent.cfgNodeIndex + 1}
                                                </span>
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel
                        defaultSize="30%"
                        className="flex justify-center items-center"
                    >
                        <div className="flex w-full flex-col items-center  gap-4 p-3">
                            <Label>
                                Current step:
                                <span className="font-bold tabular-nums">
                                    {currentStep + 1}
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
