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
    instructionIndex: number
    incrementInstructionIndex: () => void
    cfgNodeIndex: number
    cfgEdgeIndex: number
    incrementCfgEdgeIndex: () => void
    cfgNodes: SortedMap<CfgNode>
    cfgEdges: SortedMap<{ pc: bigint; destinations: Array<bigint> }>
    slots: Array<InsnRaw>
    functions: FunctionRegistry<bigint>
}) {
    const cfgNode = Array.from(cfgNodes.inner)[cfgNodeIndex]
    const cfgNodeEnd =
        cfgNodeIndex + 1 < Array.from(cfgNodes.inner).length
            ? // Next basic block start -1, if there is a next block
              Array.from(cfgNodes.inner.entries())[cfgNodeIndex + 1][0] - 1n
            : // Or the last instruction in the program, if there is no next cfg node
              slots.length - 1
}
