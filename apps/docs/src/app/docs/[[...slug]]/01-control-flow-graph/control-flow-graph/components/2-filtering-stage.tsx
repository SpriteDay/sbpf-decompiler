import { InsnRaw } from "@/components/micro-vm/ebpf"
import React from "react"
import { FunctionRegistry, SBPFVersion } from "@/components/micro-vm/program"
import { FormattingStyle } from "../../../components/utils"
import { ResizablePanelGroup } from "@/components/ui/resizable"
import { createPortal } from "react-dom"
import { FormattingSelector } from "../components/formatting-selector"

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
