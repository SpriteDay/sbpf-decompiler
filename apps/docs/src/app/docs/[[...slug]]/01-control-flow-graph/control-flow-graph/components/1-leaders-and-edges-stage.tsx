import { InsnRaw } from "@/components/micro-vm/ebpf"
import React, { useMemo, useState } from "react"
import { WideSlider } from "@/components/custom/wide-slider"
import { FunctionRegistry, SBPFVersion } from "@/components/micro-vm/program"
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
import { Badge } from "@/components/ui/badge"
import { accumulateLeadersAndEdges } from "./utils"

export function LeadersAndEdgesStage({
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
    const [currentPc, setCurrentPc] = useState(0)
    const { leaders, edges, changes } = useMemo(() => {
        return accumulateLeadersAndEdges({
            slots,
            endPc: BigInt(currentPc),
            functionRegistry,
            sbpfVersion,
        })
    }, [currentPc, slots, functionRegistry, sbpfVersion])
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
                        const isFreshLeader = changes.leaders.some(
                            (val) => val.pc === BigInt(index),
                        )

                        const isEdge = !!edges.inner.get(BigInt(index))
                        const isFreshEdge = changes.edges.some(
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
                                        index === currentPc - 1 &&
                                            "bg-amber-950/10 dark:bg-amber-200/5",
                                        {
                                            "bg-foreground text-background":
                                                index === currentPc,
                                        },
                                        isLeader &&
                                            (index === currentPc
                                                ? "bg-red-950 dark:bg-red-700 text-background dark:text-foreground"
                                                : isFreshLeader
                                                  ? "bg-red-800/40 dark:bg-red-800/40"
                                                  : "bg-red-800/15 dark:bg-red-800/15"),
                                        isEdge &&
                                            (index === currentPc
                                                ? "bg-indigo-950 dark:bg-indigo-700 text-background dark:text-foreground"
                                                : isFreshEdge
                                                  ? "bg-indigo-800/40 dark:bg-indigo-700/40"
                                                  : "bg-indigo-800/15 dark:bg-indigo-800/15"),
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
                                    Array.from(leaders.inner).map(([pc, _]) => {
                                        const isFreshLeader =
                                            changes.leaders.some(
                                                (val) => val.pc === BigInt(pc),
                                            )
                                        return (
                                            <Badge
                                                className={cn(
                                                    "text-foreground me-1 mb-1",
                                                    pc === BigInt(currentPc)
                                                        ? "bg-red-950 dark:bg-red-700 text-background dark:text-foreground"
                                                        : isFreshLeader
                                                          ? "bg-red-800/40 dark:bg-red-400/50"
                                                          : "bg-red-800/15 dark:bg-red-500/15",
                                                )}
                                                key={pc}
                                            >
                                                {pc}
                                            </Badge>
                                        )
                                    })
                                )}
                            </p>
                            <p>
                                Edges:{" "}
                                {edges.inner.size === 0 ? (
                                    <span className="text-foreground/50">
                                        {"<Empty>"}
                                    </span>
                                ) : (
                                    Array.from(edges.inner).map(([pc, _]) => {
                                        const isFreshEdge = changes.edges.some(
                                            (val) => val.pc === BigInt(pc),
                                        )
                                        return (
                                            <Badge
                                                className={cn(
                                                    "text-foreground me-1 mb-1",
                                                    pc === BigInt(currentPc)
                                                        ? "bg-indigo-950 dark:bg-indigo-700 text-background dark:text-foreground"
                                                        : isFreshEdge
                                                          ? "bg-indigo-800/40 dark:bg-indigo-400/50"
                                                          : "bg-indigo-800/15 dark:bg-indigo-500/15",
                                                )}
                                                key={pc}
                                            >
                                                {pc}
                                            </Badge>
                                        )
                                    })
                                )}
                            </p>
                            <div>
                                <span>Events:</span>
                                {changes.leaders.length === 0 &&
                                changes.edges.length === 0 ? (
                                    <span className="text-foreground/50">
                                        {" <Empty>"}
                                    </span>
                                ) : (
                                    <div className="flex flex-col gap-1">
                                        {Array.from(changes.leaders).map(
                                            ({ pc, reason }) => {
                                                return (
                                                    <span key={`leader-${pc}`}>
                                                        <span className="text-red-950 dark:text-red-400 font-semibold">
                                                            - PC {pc} became a
                                                            leader
                                                        </span>
                                                        : {reason}
                                                    </span>
                                                )
                                            },
                                        )}
                                        {Array.from(changes.edges).map(
                                            ({ pc, reason }) => {
                                                return (
                                                    <span key={`edge-${pc}`}>
                                                        <span className="text-indigo-950 dark:text-indigo-400 font-semibold">
                                                            - PC {pc} became an
                                                            edge
                                                        </span>
                                                        : {reason}
                                                    </span>
                                                )
                                            },
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
                                Current PC:
                                <span className="font-bold tabular-nums">
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
