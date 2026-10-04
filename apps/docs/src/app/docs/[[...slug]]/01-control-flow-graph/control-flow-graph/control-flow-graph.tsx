"use client"

import { Insn, InsnRaw, OpCodes } from "@/components/micro-vm/ebpf"
import { Analysis } from "@/components/micro-vm/static-analysis"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import React, { useEffect, useState } from "react"
import { Executable } from "@/components/micro-vm/elf"
import {
    BuiltinProgram,
    FunctionRegistry,
    SBPFVersion,
} from "@/components/micro-vm/program"
import { Config } from "@/components/micro-vm/vm"
import { FormattingStyle } from "../../components/utils"
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { LeadersAndEdgesStage } from "./components/1-leaders-and-edges-stage"
import { FormattingSelector } from "./components/formatting-selector"
import { FilteringStage } from "./components/2-filtering-stage"
import { BlockBoundariesStage } from "./components/3-block-boundaries-stage"

// biome-ignore format: keep all instructions in one line
const Slots: Array<Insn> = [
    // factorial(4)
    // entrypoint:
    { ptr: 0n, opc: OpCodes.LD_DW_IMM, dst: 1n, src: 0n, off: 0n, imm: 0xffff_ffffn },
    { ptr: 1n, opc: 0x00n, dst: 0n, src: 0n, off: 0n, imm: 0xffff_ffffn },
    { ptr: 2n, opc: OpCodes.MOV64_IMM, dst: 7n, src: 0n, off: 0n, imm: 4n },
    { ptr: 3n, opc: OpCodes.JGT64_IMM, dst: 7n, src: 0n, off: 9n, imm: 20n }, // 21! overflows u64
    { ptr: 4n, opc: OpCodes.MOV64_IMM, dst: 6n, src: 0n, off: 0n, imm: 1n },
    { ptr: 5n, opc: OpCodes.JEQ64_IMM, dst: 7n, src: 0n, off: 6n, imm: 0n },
    { ptr: 6n, opc: OpCodes.MOV64_REG, dst: 2n, src: 7n, off: 0n, imm: 0n },
    { ptr: 7n, opc: OpCodes.CALL_IMM, dst: 0n, src: 1n, off: 0n, imm: 5n }, // calling mul()
    { ptr: 8n, opc: OpCodes.MOV64_REG, dst: 6n, src: 0n, off: 0n, imm: 0n },
    { ptr: 9n, opc: OpCodes.SUB64_IMM, dst: 7n, src: 0n, off: 0n, imm: 1n },
    { ptr: 10n, opc: OpCodes.JA, dst: 0n, src: 0n, off: -7n, imm: 0n },
    { ptr: 11n, opc: OpCodes.MOV64_REG, dst: 0n, src: 6n, off: 0n, imm: 0n },
    { ptr: 12n, opc: OpCodes.EXIT, dst: 0n, src: 0n, off: 0n, imm: 0x00n },
    // mul:
    { ptr: 13n, opc: OpCodes.MOV64_IMM, dst: 0n, src: 0n, off: 0n, imm: 0n },
    { ptr: 14n, opc: OpCodes.JEQ64_IMM, dst: 2n, src: 0n, off: 3n, imm: 0n },
    { ptr: 15n, opc: OpCodes.ADD64_REG, dst: 0n, src: 1n, off: 0n, imm: 0n },
    { ptr: 16n, opc: OpCodes.SUB64_IMM, dst: 2n, src: 0n, off: 0n, imm: 1n },
    { ptr: 17n, opc: OpCodes.JA, dst: 0n, src: 0n, off: -4n, imm: 0n },
    { ptr: 18n, opc: OpCodes.EXIT, dst: 0n, src: 0n, off: 0n, imm: 0x00n },
]

const Version: SBPFVersion = "V3"

const functionRegistry = FunctionRegistry.default<bigint>()
FunctionRegistry.registerFunction(functionRegistry, {
    key: 0n,
    name: "entrypoint",
    value: 0n,
})
FunctionRegistry.registerFunction(functionRegistry, {
    key: 14n,
    name: "mul",
    value: 14n,
})

const StagesMap = {
    "1. Leaders & Edges": LeadersAndEdgesStage,
    "2. Filtering": FilteringStage,
    "3. Basic Blocks": BlockBoundariesStage,
} as const satisfies Record<
    string,
    (props: {
        slots: Array<InsnRaw>
        functionRegistry: FunctionRegistry<bigint>
        sbpfVersion: SBPFVersion
        formatStyle: FormattingStyle
        setFormatStyle: React.ComponentProps<
            typeof FormattingSelector
        >["setFormatStyle"]
        leftBlock: HTMLElement
        rightBlock: HTMLElement
    }) => React.ReactNode
>

type Stage = keyof typeof StagesMap

export function ControlFlowGraph() {
    // Layout related
    const [stage, setStage] = useState<Stage>("1. Leaders & Edges")
    const [leftBlock, setLeftBlock] = useState<HTMLElement | null>(null)
    const [rightBlock, setRightBlock] = useState<HTMLElement | null>(null)
    const ActiveStage = StagesMap[stage]

    const [formatStyle, setFormatStyle] = useState<FormattingStyle>("NASM")

    // Debug static analysis implementation
    useEffect(() => {
        const config = Config.default()
        config.enableRegisterTracing = true

        const loader = BuiltinProgram.new({ config })

        const executable: Executable = {
            slots: Slots,
            sbpfVersion: Version,
            functionRegistry,
            loader,
        }
        const _analysis = Analysis.fromExecutable({ executable })
    }, [])
    return (
        <Card>
            <CardHeader>
                <CardTitle>Static Analysis Debug</CardTitle>
                <CardDescription>
                    Use selector to pick and inspect the stage of building a CFG
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col justify-center gap-2">
                <div className="w-full flex justify-center">
                    <ToggleGroup
                        variant="outline"
                        value={[stage]}
                        onValueChange={(value) => setStage(value[0] as Stage)}
                    >
                        {Object.keys(StagesMap).map((key) => {
                            return (
                                <ToggleGroupItem key={key} value={key}>
                                    {key}
                                </ToggleGroupItem>
                            )
                        })}
                    </ToggleGroup>
                </div>
                <ResizablePanelGroup
                    orientation="horizontal"
                    className="relative rounded-lg border"
                >
                    <ResizablePanel defaultSize="55%">
                        <div ref={setLeftBlock} className="h-full" />
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize="45%">
                        <div ref={setRightBlock} className="h-full" />
                    </ResizablePanel>
                </ResizablePanelGroup>
                {leftBlock && rightBlock && (
                    <ActiveStage
                        slots={Slots}
                        functionRegistry={functionRegistry}
                        sbpfVersion={Version}
                        formatStyle={formatStyle}
                        setFormatStyle={setFormatStyle}
                        leftBlock={leftBlock}
                        rightBlock={rightBlock}
                    />
                )}
            </CardContent>
        </Card>
    )
}
