import { InsnRaw } from "@/components/micro-vm/ebpf"
import React, { useState } from "react"
import { FunctionRegistry, SBPFVersion } from "@/components/micro-vm/program"
import { FormattingStyle } from "../../../components/utils"
import { ResizablePanelGroup } from "@/components/ui/resizable"
import { createPortal } from "react-dom"
import { FormattingSelector } from "../components/formatting-selector"
import { CfgNode } from "@/components/micro-vm/static-analysis"
import { SortedMap } from "@/components/micro-vm/dependencies/utils"

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
    const [instructionIndex, setInstructionIndex] = useState(0)
    return (
        <>
            {createPortal(
                <div
                    key={0}
                    className="flex justify-center p-2 flex-col gap-1 "
                ></div>,
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

function instructionsAndDestinationsPass({
    step,
    instructionIndex,
    incrementInstructionIndex,
    cfgNodeIndex,
    cfgEdgeIndex,
    incrementCfgEdgeIndex,
    cfgNodes,
    cfgEdges,
    slots,
    functions,
}: {
    step: number
    instructionIndex: number
    incrementInstructionIndex: () => void
    cfgNodeIndex: number
    cfgEdgeIndex: number
    incrementCfgEdgeIndex: () => void
    cfgNodes: SortedMap<CfgNode>
    cfgEdges: SortedMap<{ pc: bigint; destinations: Array<bigint> }>
    slots: Array<InsnRaw>
    functions: FunctionRegistry<bigint>
}): {
    cfgNodes: SortedMap<CfgNode>
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
    // Each index change decrements step counter, so it is possible to control the loop progress
    let remainingSteps = step
    let lastEvent: ReturnType<
        typeof instructionsAndDestinationsPass
    >["lastEvent"] = null
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
            incrementInstructionIndex()
            instructionIndex++

            // Update the end instruction index in our CFG node
            cfgNode.instructions[1] = instructionIndex

            lastEvent = {
                type: "instruction",
                index: instructionIndex,
                cfgNodeStart,
            }

            remainingSteps -= 1
            if (remainingSteps <= 0) {
                return {
                    cfgNodes,
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

            incrementCfgEdgeIndex()
            cfgEdgeIndex++
            remainingSteps -= 1
            return {
                cfgNodes,
                lastEvent,
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

    return { cfgNodes, lastEvent }
}
