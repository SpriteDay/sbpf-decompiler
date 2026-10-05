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
import { CfgNode } from "@/components/micro-vm/static-analysis"
import {
    SortedMap,
    u8ArrayToString,
} from "@/components/micro-vm/dependencies/utils"
import { getFilteredLeadersAndEdges } from "./utils"
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
    const {
        cfgNodes,
        cfgEdges,
        instructionIndex,
        cfgNodeIndex,
        cfgEdgeIndex,
        lastEvent,
    } = useMemo(() => {
        const {
            leaders,
            edges: cfgEdges,
            removed,
        } = getFilteredLeadersAndEdges({
            slots,
            functionRegistry,
            sbpfVersion,
        })
        const cfgNodes = SortedMap.new<CfgNode>()
        cfgNodes.inner = new Map(
            [...leaders.inner].filter(
                ([pc, _cfgNode]) =>
                    !removed.leaders.some(
                        ({ pc: removedPc }) => pc === removedPc,
                    ),
            ),
        )
        const functions = FunctionRegistry.default<bigint>()
        functions.map.inner = new Map(
            [...functionRegistry.map.inner].filter(
                ([pc, _]) =>
                    !removed.functions.some(
                        ({ pc: removedPc }) => pc === removedPc,
                    ),
            ),
        )
        return defineInstructionsAndDestinations({
            maxStep: currentStep,
            cfgNodes,
            cfgEdges,
            slots,
            functions,
        })
    }, [currentStep, sbpfVersion, slots, functionRegistry])

    const maxStep = cfgNodes.inner.size + cfgEdges.inner.size + slots.length - 1

    const grouppedSlots = useMemo(() => {
        const ownershipMap = new Map<number, number>()

        Array.from(cfgNodes.inner).forEach(([_, cfgNode], cfgNodeIndex) => {
            for (
                let i = cfgNode.instructions[0];
                i < cfgNode.instructions[1];
                i++
            ) {
                ownershipMap.set(i, cfgNodeIndex)
            }
        })

        const groups: Array<{
            owner: number | undefined
            startPc: number
            slots: Array<InsnRaw>
        }> = []
        let currentGroup: {
            owner: number | undefined
            startPc: number
            slots: Array<InsnRaw>
        } = {
            owner: 0,
            startPc: 0,
            slots: [],
        }
        let lastOwner: number | undefined = undefined

        slots.forEach((slot, pc) => {
            const owner = ownershipMap.get(pc)

            const wasOwnerChanged = owner !== lastOwner
            if (wasOwnerChanged && currentGroup.slots.length > 0) {
                groups.push(currentGroup)
                currentGroup = {
                    owner,
                    startPc: pc,
                    slots: [],
                }
            }

            currentGroup.slots.push(slot)
            lastOwner = owner
        })

        if (currentGroup.slots.length > 0) {
            groups.push(currentGroup)
        }

        return groups
    }, [slots, cfgNodes])
    return (
        <>
            {createPortal(
                <div className="relative flex justify-center p-2 flex-col gap-1">
                    <div className="absolute bottom-3 right-3 z-10 opacity-90">
                        <FormattingSelector
                            formatStyle={formatStyle}
                            setFormatStyle={setFormatStyle}
                        />
                    </div>
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
                                        {index + 1}
                                    </span>
                                )}
                                {groupSlots.map((_, groupPc) => {
                                    const pc = startPc + groupPc
                                    const labelU8Arr =
                                        functionRegistry.map.inner.get(
                                            BigInt(pc),
                                        )?.[0]
                                    const isActive = instructionIndex === pc
                                    const isLeader = !!cfgNodes.inner.get(
                                        BigInt(pc),
                                    )
                                    const isEdge = !!cfgEdges.inner.get(
                                        BigInt(pc),
                                    )
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
                                {cfgNodes.inner.size === 0 ? (
                                    <span className="text-foreground/50">
                                        {"<Empty>"}
                                    </span>
                                ) : (
                                    Array.from(cfgNodes.inner).map(
                                        ([pc, _], index) => {
                                            const isActive =
                                                index === cfgNodeIndex
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
                                {cfgEdges.inner.size === 0 ? (
                                    <span className="text-foreground/50">
                                        {"<Empty>"}
                                    </span>
                                ) : (
                                    Array.from(cfgEdges.inner).map(
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
                                {functionRegistry.map.inner.size === 0 ? (
                                    <span className="text-foreground/50">
                                        {"<Empty>"}
                                    </span>
                                ) : (
                                    Array.from(functionRegistry.map.inner).map(
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

function defineInstructionsAndDestinations({
    maxStep,
    cfgNodes,
    cfgEdges,
    slots,
    functions,
}: {
    maxStep: number
    cfgNodes: SortedMap<CfgNode>
    cfgEdges: SortedMap<{ opc: bigint; destinations: Array<bigint> }>
    slots: Array<InsnRaw>
    functions: FunctionRegistry<bigint>
}): {
    cfgNodes: SortedMap<CfgNode>
    cfgEdges: SortedMap<{ opc: bigint; destinations: Array<bigint> }>
    instructionIndex: number
    cfgNodeIndex: number
    cfgEdgeIndex: number
    lastEvent:
        | {
              type: "instruction"
              index: number
              cfgNodeIndex: number
          }
        | {
              type: "destinations-edge"
              destinations: Array<bigint>
              sourceEdgePc: bigint
              cfgNodeIndex: number
          }
        | {
              type: "destinations-fall-through"
              destination: bigint
              nextCfgNodeStart: bigint
              cfgNodeIndex: number
          }
        | null
} {
    let currentStep = 0

    let instructionIndex = 0
    let cfgNodeIndex = 0
    let cfgEdgeIndex = 0
    // Each index change decrements step counter, so it is possible to control the loop progress
    let lastEvent: ReturnType<
        typeof defineInstructionsAndDestinations
    >["lastEvent"] = null

    while (currentStep <= maxStep) {
        const entry = Array.from(cfgNodes.inner)[cfgNodeIndex]
        if (!entry) {
            return {
                cfgNodes,
                cfgEdges,
                instructionIndex,
                cfgNodeIndex,
                cfgEdgeIndex,
                lastEvent,
            }
        }
        const [_cfgNodeStart, cfgNode] = entry
        const cfgNodeEnd =
            cfgNodeIndex + 1 < Array.from(cfgNodes.inner).length
                ? // Next basic block start -1, if there is a next block
                  Array.from(cfgNodes.inner.entries())[cfgNodeIndex + 1][0] - 1n
                : // Or the last instruction in the program, if there is no next cfg node
                  slots.length - 1

        cfgNode.instructions[0] = instructionIndex
        while (instructionIndex < slots.length) {
            if (instructionIndex <= cfgNodeEnd) {
                // Update the end instruction index in our CFG node
                cfgNode.instructions[1] = instructionIndex + 1

                lastEvent = {
                    type: "instruction",
                    index: instructionIndex,
                    cfgNodeIndex,
                }

                currentStep++
                if (currentStep > maxStep) {
                    return {
                        cfgNodes,
                        cfgEdges,
                        instructionIndex,
                        cfgNodeIndex,
                        cfgEdgeIndex,
                        lastEvent,
                    }
                }
                instructionIndex++
            } else {
                break
            }
        }

        // If there is a recorded CFG edge within our calculated CFG node boundaries
        // we copy edge's destinations from the edge to the current CFG node and go
        // to the next CFG node
        if (cfgEdgeIndex < Array.from(cfgEdges.inner.entries()).length) {
            const [nextCfgEdgePc, nextCfgEdge] = Array.from(cfgEdges.inner)[
                cfgEdgeIndex
            ]
            if (nextCfgEdgePc <= cfgNodeEnd) {
                cfgNode.destinations = [...nextCfgEdge.destinations]
                lastEvent = {
                    type: "destinations-edge",
                    cfgNodeIndex,
                    sourceEdgePc: nextCfgEdgePc,
                    destinations: nextCfgEdge.destinations,
                }

                currentStep++
                if (currentStep > maxStep) {
                    return {
                        cfgNodes,
                        cfgEdges,
                        instructionIndex,
                        cfgNodeIndex,
                        cfgEdgeIndex,
                        lastEvent,
                    }
                }
                cfgEdgeIndex++
            }
        }

        if (cfgNodeIndex + 1 < Array.from(cfgNodes.inner).length) {
            const [nextCfgNodeStart, _nextCfgNode] = Array.from(cfgNodes.inner)[
                cfgEdgeIndex + 1
            ]
            // If we couldn't a corresponding edge - we check whether
            // the next cfg node is function or no, and if it's not - we specify
            // the fall through destination to it. We keep CFG Nodes split by functions
            // for non flatten call graph
            if (functions.map.inner.get(nextCfgNodeStart)) {
                cfgNode.destinations.push(nextCfgNodeStart)
                lastEvent = {
                    type: "destinations-fall-through",
                    destination: nextCfgNodeStart,
                    nextCfgNodeStart,
                    cfgNodeIndex,
                }
            }
        }
        currentStep++
        if (currentStep > maxStep) {
            return {
                cfgNodes,
                cfgEdges,
                instructionIndex,
                cfgNodeIndex,
                cfgEdgeIndex,
                lastEvent,
            }
        }
        cfgNodeIndex++
    }

    return {
        cfgNodes,
        cfgEdges,
        instructionIndex,
        cfgNodeIndex,
        cfgEdgeIndex,
        lastEvent,
    }
}
