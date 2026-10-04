import { InsnRaw, OpCodes } from "@/components/micro-vm/ebpf"
import React, { useMemo, useState } from "react"
import { WideSlider } from "@/components/custom/wide-slider"
import {
    FunctionRegistry,
    SBPFFeatures,
    SBPFVersion,
} from "@/components/micro-vm/program"
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { createPortal } from "react-dom"
import {
    SortedMap,
    u8ArrayToString,
} from "@/components/micro-vm/dependencies/utils"
import { FormattingSelector } from "./formatting-selector"
import { formatInstruction, FormattingStyle } from "../../../components/utils"
import { CfgNode } from "@/components/micro-vm/static-analysis"
import { Badge } from "@/components/ui/badge"

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
        const leadersAcc: ReturnType<typeof recordLeadersAndEdges>["leaders"] =
            SortedMap.new()
        const edgesAcc: ReturnType<typeof recordLeadersAndEdges>["edges"] =
            SortedMap.new()
        let lastChanges: ReturnType<typeof recordLeadersAndEdges>["changes"] = {
            edges: [],
            leaders: [],
        }
        for (let pc = 0; pc <= currentPc; pc++) {
            const { leaders, edges, changes } = recordLeadersAndEdges({
                slots,
                pc: BigInt(pc),
                functionRegistry,
                sbpfVersion,
            })
            leaders.inner.forEach((val, key) => {
                SortedMap.insert(leadersAcc, { key, value: val })
            })
            edges.inner.forEach((val, key) => {
                SortedMap.insert(edgesAcc, { key, value: val })
            })
            lastChanges = changes
        }
        return {
            leaders: leadersAcc,
            edges: edgesAcc,
            changes: lastChanges,
        }
    }, [currentPc, slots, functionRegistry, sbpfVersion])
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
                                                    <span key={pc}>
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
                                                    <span key={pc}>
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

function recordLeadersAndEdges({
    slots,
    pc,
    functionRegistry,
    sbpfVersion,
}: {
    slots: Array<InsnRaw>
    pc: bigint
    functionRegistry: FunctionRegistry<bigint>
    sbpfVersion: SBPFVersion
}): {
    leaders: SortedMap<CfgNode>
    edges: SortedMap<{
        opc: bigint
        destinations: Array<bigint>
    }>
    changes: {
        leaders: Array<{ pc: bigint; reason: string }>
        edges: Array<{
            pc: bigint
            reason: string
            destinations: Array<bigint>
        }>
    }
} {
    const leaders = SortedMap.new<CfgNode>()
    const edges = SortedMap.new<{
        opc: bigint
        destinations: Array<bigint>
    }>()
    const changes: {
        leaders: Array<{ pc: bigint; reason: string }>
        edges: Array<{
            pc: bigint
            reason: string
            destinations: Array<bigint>
        }>
    } = {
        leaders: [],
        edges: [],
    }

    if (pc === 0n) {
        SortedMap.insert(leaders, { key: pc, value: CfgNode.default() })
        changes.leaders.push({
            pc,
            reason: "instruction 0 is always a leader",
        })
    }

    const registryEntry = functionRegistry.map.inner.get(pc)
    if (registryEntry) {
        if (!leaders.inner.get(pc)) {
            SortedMap.insert(leaders, { key: pc, value: CfgNode.default() })
            changes.leaders.push({
                pc,
                reason: `found registry function with the label "${u8ArrayToString(registryEntry[0])}"`,
            })
        }
    }

    const insn = slots[Number(pc)]
    switch (insn.opc) {
        case OpCodes.CALL_IMM: {
            const callImmTargetPc = SBPFFeatures.calculateCallImmTargetPc(
                sbpfVersion,
                {
                    pc,
                    imm: insn.imm,
                },
            )
            let targetPc: bigint | undefined = undefined
            // In case a function was found in the registr and it's not V3+ syscall
            if (
                registryEntry &&
                !(SBPFFeatures.staticSyscalls(sbpfVersion) && insn.src === 0n)
            ) {
                targetPc = registryEntry[1]
            }
            if (SBPFFeatures.staticSyscalls(sbpfVersion)) {
                // According to SIMD-0178 src === 1 is for internal callsm and src === 0 for static syscalls
                // Since static syscall does not alter the execution, we only add pc if it's an internal call
                if (insn.src === 1n) {
                    targetPc = callImmTargetPc
                }
            }
            if (typeof targetPc !== "undefined") {
                // Mark start of a basic block at the fall-through PC
                if (!leaders.inner.get(pc + 1n)) {
                    SortedMap.insert(leaders, {
                        key: pc + 1n,
                        value: CfgNode.default(),
                    })
                    changes.leaders.push({
                        pc: pc + 1n,
                        reason: "start of a basic block at the fall-through PC",
                    })
                }
                // Mark start of a basic block at the callee PC
                if (!leaders.inner.get(targetPc)) {
                    SortedMap.insert(leaders, {
                        key: targetPc,
                        value: CfgNode.default(),
                    })
                    changes.leaders.push({
                        pc: targetPc,
                        reason: "start of a basic block at the callee PC",
                    })
                }
                // Only recording local function destinations
                const destinations = [pc + 1n]

                SortedMap.insert(edges, {
                    key: pc,
                    value: { opc: insn.opc, destinations },
                })
                changes.edges.push({
                    pc,
                    reason: "calls end basic blocks",
                    destinations,
                })
            }
            break
        }
        case OpCodes.CALL_REG: {
            if (!leaders.inner.get(pc + 1n)) {
                SortedMap.insert(leaders, {
                    key: pc + 1n,
                    value: CfgNode.default(),
                })
                changes.leaders.push({
                    pc,
                    reason: "start of a basic block at the fall-through PC",
                })
            }

            const destinations = [pc + 1n]
            changes.edges.push({
                pc,
                reason: "calls end basic blocks",
                destinations,
            })
            break
        }
        case OpCodes.EXIT: {
            if (leaders.inner.get(pc + 1n)) {
                SortedMap.insert(leaders, {
                    key: pc + 1n,
                    value: CfgNode.default(),
                })
                changes.leaders.push({
                    pc,
                    reason: "instruction after exit starts new block",
                })
            }
            changes.edges.push({
                pc,
                reason: "exit ends basic block",
                destinations: [],
            })
            break
        }
        case OpCodes.JA:
        case OpCodes.JEQ64_IMM:
        case OpCodes.JGT64_IMM: {
            const targetPc = BigInt.asUintN(
                64,
                BigInt.asIntN(64, pc) + 1n + BigInt.asIntN(64, insn.off),
            )
            if (!leaders.inner.get(pc + 1n)) {
                SortedMap.insert(leaders, {
                    key: pc + 1n,
                    value: CfgNode.default(),
                })
                changes.leaders.push({
                    pc: pc + 1n,
                    reason: "fall-through of jump marks start of basic block",
                })
            }
            if (!leaders.inner.get(targetPc)) {
                SortedMap.insert(leaders, {
                    key: targetPc,
                    value: CfgNode.default(),
                })
                changes.leaders.push({
                    pc: targetPc,
                    reason: "target of jump marks start of a basic block",
                })
            }
            const destinations =
                insn.opc === OpCodes.JA ? [targetPc] : [pc + 1n, targetPc]
            SortedMap.insert(edges, {
                key: pc,
                value: {
                    opc: insn.opc,
                    destinations,
                },
            })
            changes.edges.push({
                pc,
                reason: "jumps mark the end of a basic block",
                destinations,
            })
            break
        }
    }

    return {
        leaders,
        edges,
        changes,
    }
}
