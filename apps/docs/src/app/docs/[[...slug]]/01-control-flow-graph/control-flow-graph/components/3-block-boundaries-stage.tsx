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
    events: {
        instructions: Array<{ index: number; cfgEdgeId: bigint }>
    }
} {
    // Each index change decrements step counter, so it is possible to control the loop progress
    let remainingSteps = step
    const events: {
        instructions: Array<{ index: number; cfgEdgeId: bigint }>
    } = {
        instructions: [],
    }
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

            events.instructions.push({
                index: instructionIndex,
                cfgEdgeId: cfgNodeStart,
            })

            remainingSteps -= 1
            if (remainingSteps <= 0) {
                return {
                    cfgNodes,
                    events,
                }
            }
        } else {
            break
        }
    }

    return { cfgNodes, events }
}
