import { InsnRaw } from "@/components/micro-vm/ebpf"
import React, { useState } from "react"
import { WideSlider } from "@/components/custom/wide-slider"
import { FunctionRegistry } from "@/components/micro-vm/program"
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { createPortal } from "react-dom"
import { u8ArrayToString } from "@/components/micro-vm/dependencies/utils"
import { FormattingSelector } from "./formatting-selector"
import { formatInstruction, FormattingStyle } from "../../../components/utils"

export function LeadersAndEdgesStage({
    slots,
    functionRegistry,
    formatStyle,
    setFormatStyle,
    leftBlock,
    rightBlock,
}: {
    slots: Array<InsnRaw>
    functionRegistry: FunctionRegistry<bigint>
    formatStyle: FormattingStyle
    setFormatStyle: React.ComponentProps<
        typeof FormattingSelector
    >["setFormatStyle"]
    leftBlock: HTMLElement
    rightBlock: HTMLElement
}) {
    const [currentPc, setCurrentPc] = useState(0)
    return (
        <>
            {createPortal(
                <div
                    key={0}
                    className="relative flex justify-center p-2 flex-col gap-1 "
                >
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
                                        "font-semibold font-mono rounded-sm pe-1 ps-4",
                                        index === currentPc &&
                                            "bg-foreground text-background",
                                        index === currentPc - 1 &&
                                            "bg-amber-950/10 dark:bg-amber-200/20",
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
                        <div className="flex justify-center p-2 flex-col gap-1"></div>
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel
                        defaultSize="30%"
                        className="flex justify-center items-center"
                    >
                        <div className="flex w-full flex-col items-center  gap-4 p-3">
                            <Label>
                                Current PC:
                                <span className="font-bold tabular-nums font-mono">
                                    {currentPc}
                                </span>
                            </Label>
                            <WideSlider
                                value={[currentPc]}
                                onValueChange={(value) => {
                                    setCurrentPc(value as number)
                                }}
                                min={0}
                                max={slots.length - 1}
                                step={1}
                                className="mx-auto w-full max-w-lg"
                            />
                            <div className="w-full flex justify-center items-center gap-4">
                                <Button
                                    className="w-[10ch]"
                                    disabled={currentPc === 0}
                                    onClick={() => setCurrentPc(currentPc - 1)}
                                >
                                    Previous
                                </Button>
                                <Button
                                    className="w-[10ch]"
                                    disabled={currentPc === slots.length - 1}
                                    onClick={() => setCurrentPc(currentPc + 1)}
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
