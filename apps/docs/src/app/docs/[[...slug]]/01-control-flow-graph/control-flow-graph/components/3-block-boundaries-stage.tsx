import { InsnRaw } from "@/components/micro-vm/ebpf"
import React, { useMemo, useState } from "react"
import { FunctionRegistry, SBPFVersion } from "@/components/micro-vm/program"
import { FormattingStyle } from "../../../components/utils"
import { ResizablePanelGroup } from "@/components/ui/resizable"
import { createPortal } from "react-dom"
import { FormattingSelector } from "../components/formatting-selector"
import { CfgNode } from "@/components/micro-vm/static-analysis"
import { SortedMap } from "@/components/micro-vm/dependencies/utils"
import { getFilteredLeadersAndEdges } from "./utils"

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
    const { cfgNodes, instructionIndex, cfgEdgeIndex, cfgNodeIndex } =
        useMemo(() => {
            const {
                leaders,
                edges: cfgEdges,
                removed,
            } = getFilteredLeadersAndEdges({
                slots,
                currentStep,
                functionRegistry,
                sbpfVersion,
            })
            const cfgNodes = SortedMap.new<CfgNode>()
            cfgNodes.inner = new Map(
                [...leaders.inner].filter(([pc, _cfgNode]) =>
                    removed.leaders.some(
                        ({ pc: removedPc }) => pc === removedPc,
                    ),
                ),
            )
            const functions = FunctionRegistry.default<bigint>()
            functions.map.inner = new Map(
                [...functionRegistry.map.inner].filter(([pc, _]) =>
                    removed.functions.some(
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
            slots: Array<InsnRaw>
        }> = []
        let currentGroup: Array<InsnRaw> = []
        let lastOwner: number | undefined = undefined

        slots.forEach((slot, pc) => {
            const owner = ownershipMap.get(pc)

            const wasOwnerChanged = owner !== lastOwner
            if (wasOwnerChanged && currentGroup.length > 0) {
                groups.push({ owner, slots: currentGroup })
                currentGroup = []
            }

            currentGroup.push(slot)
            lastOwner = owner
        })

        if (currentGroup.length > 0) {
            groups.push({ owner: lastOwner, slots: currentGroup })
        }

        return groups
    }, [slots, cfgNodes])
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
                        const isRemoved =
                            isLeader &&
                            removed.leaders.some(
                                (val) => val.pc === BigInt(index),
                            )
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
                                            !isRemoved &&
                                            "bg-red-800/15 dark:bg-red-800/15",
                                        isEdge &&
                                            "bg-indigo-800/15 dark:bg-indigo-800/15",
                                        isLeader &&
                                            isEdge &&
                                            "bg-linear-to-r from-red-800/15 dark:from-red-800/15 to-indigo-800/15 dark:to-indigo-800/15",
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
                <ResizablePanelGroup
                    key={1}
                    orientation="vertical"
                ></ResizablePanelGroup>,
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
    instructionIndex: number
    cfgNodeIndex: number
    cfgEdgeIndex: number
    lastEvent:
        | {
              type: "instruction"
              index: number
              cfgNodeStart: bigint
          }
        | {
              type: "destinations-edge"
              destinations: Array<bigint>
              sourceEdgePc: bigint
              cfgNodeStart: bigint
          }
        | {
              type: "destinations-fall-through"
              destination: bigint
              nextCfgNodeStart: bigint
              cfgNodeStart: bigint
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
        const [cfgNodeStart, cfgNode] = Array.from(cfgNodes.inner)[cfgNodeIndex]
        const cfgNodeEnd =
            cfgNodeIndex + 1 < Array.from(cfgNodes.inner).length
                ? // Next basic block start -1, if there is a next block
                  Array.from(cfgNodes.inner.entries())[cfgNodeIndex + 1][0] - 1n
                : // Or the last instruction in the program, if there is no next cfg node
                  slots.length - 1

        cfgNode.instructions[0] = instructionIndex
        while (instructionIndex < slots.length) {
            if (instructionIndex <= cfgNodeEnd) {
                instructionIndex++

                // Update the end instruction index in our CFG node
                cfgNode.instructions[1] = instructionIndex

                lastEvent = {
                    type: "instruction",
                    index: instructionIndex,
                    cfgNodeStart,
                }

                currentStep++
                if (currentStep > maxStep) {
                    return {
                        cfgNodes,
                        instructionIndex,
                        cfgNodeIndex,
                        cfgEdgeIndex,
                        lastEvent,
                    }
                }
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
                    cfgNodeStart,
                    sourceEdgePc: nextCfgEdgePc,
                    destinations: nextCfgEdge.destinations,
                }

                cfgEdgeIndex++
                currentStep++
                if (currentStep > maxStep) {
                    return {
                        cfgNodes,
                        instructionIndex,
                        cfgNodeIndex,
                        cfgEdgeIndex,
                        lastEvent,
                    }
                }
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
                    cfgNodeStart,
                }
            }
        }
        currentStep++
        if (currentStep > maxStep) {
            return {
                cfgNodes,
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
        instructionIndex,
        cfgNodeIndex,
        cfgEdgeIndex,
        lastEvent,
    }
}
