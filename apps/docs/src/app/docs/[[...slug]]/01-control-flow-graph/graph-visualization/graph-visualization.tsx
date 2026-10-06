"use client"

import { Insn, OpCodes } from "@/components/micro-vm/ebpf"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Label } from "@/components/ui/label"
import { WideSlider } from "@/components/custom/wide-slider"
import { Button } from "@/components/ui/button"
import {
    getFilteredCfgNodesWithDestinations,
    groupInstructionsByCfgNodes,
} from "../control-flow-graph/components/utils"
import { FunctionRegistry, SBPFVersion } from "@/components/micro-vm/program"
import { CfgNode } from "@/components/micro-vm/static-analysis"
import {
    SortedMap,
    u8ArrayToString,
} from "@/components/micro-vm/dependencies/utils"
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"
import { cn } from "@/lib/utils"
import { formatInstruction } from "../../components/utils"
import { Badge } from "@/components/ui/badge"
import ELK, { ElkNode, LayoutOptions } from "elkjs/lib/elk.bundled.js"
import {
    Background,
    type Connection,
    type Edge,
    type Node,
    Position,
    ReactFlow,
    addEdge,
    useNodesState,
    useEdgesState,
    useReactFlow,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { logger } from "@/lib/logger"

const position = { x: 0, y: 0 }

const initialNodes: Array<Node> = [
    {
        id: "1",
        type: "input",
        data: { label: "input" },
        position,
    },
    {
        id: "2",
        data: { label: "node 2" },
        position,
    },
    {
        id: "2a",
        data: { label: "node 2a" },
        position,
    },
    {
        id: "2b",
        data: { label: "node 2b" },
        position,
    },
    {
        id: "2c",
        data: { label: "node 2c" },
        position,
    },
    {
        id: "2d",
        data: { label: "node 2d" },
        position,
    },
    {
        id: "3",
        data: { label: "node 3" },
        position,
    },
    {
        id: "4",
        data: { label: "node 4" },
        position,
    },
    {
        id: "5",
        data: { label: "node 5" },
        position,
    },
    {
        id: "6",
        type: "output",
        data: { label: "output" },
        position,
    },
    { id: "7", type: "output", data: { label: "output" }, position },
]

const initialEdges: Array<Edge> = [
    { id: "e12", source: "1", target: "2", type: "smoothstep" },
    { id: "e13", source: "1", target: "3", type: "smoothstep" },
    { id: "e22a", source: "2", target: "2a", type: "smoothstep" },
    { id: "e22b", source: "2", target: "2b", type: "smoothstep" },
    { id: "e22c", source: "2", target: "2c", type: "smoothstep" },
    { id: "e2c2d", source: "2c", target: "2d", type: "smoothstep" },
    { id: "e45", source: "4", target: "5", type: "smoothstep" },
    { id: "e56", source: "5", target: "6", type: "smoothstep" },
    { id: "e57", source: "5", target: "7", type: "smoothstep" },
]

const elk = new ELK()

// Elk has a *huge* amount of options to configure. To see everything you can
// tweak check out:
//
// - https://www.eclipse.org/elk/reference/algorithms.html
// - https://www.eclipse.org/elk/reference/options.html
const elkOptions: LayoutOptions = {
    "elk.direction": "DOWN",
    "elk.algorithm": "layered",
    "elk.layered.spacing.nodeNodeBetweenLayers": "100",
    "elk.spacing.nodeNode": "80",
}

const NodeWidth = 150
const NodeHeight = 50

// React Flow and ELK have their own node/edge shapes, so the graph is
// translated to ELK for the layout and only positions are taken back.
const getLayoutedElements = async ({
    nodes,
    edges,
    options = elkOptions,
}: {
    nodes: Array<Node>
    edges: Array<Edge>
    options?: LayoutOptions
}): Promise<{ nodes: Array<Node>; edges: Array<Edge> }> => {
    const isHorizontal = options["elk.direction"] === "RIGHT"
    const graph: ElkNode = {
        id: "root",
        layoutOptions: options,
        children: nodes.map((node) => ({
            id: node.id,
            // Hardcode a width and height for elk to use when layouting.
            width: NodeWidth,
            height: NodeHeight,
        })),
        edges: edges.map((edge) => ({
            id: edge.id,
            sources: [edge.source],
            targets: [edge.target],
        })),
    }

    const layoutedGraph = await elk.layout(graph)
    const positions = new Map(
        layoutedGraph.children?.map((node) => [
            node.id,
            { x: node.x ?? 0, y: node.y ?? 0 },
        ]),
    )

    return {
        nodes: nodes.map((node) => ({
            ...node,
            // Adjust the target and source handle positions based on the layout
            // direction.
            targetPosition: isHorizontal ? Position.Left : Position.Top,
            sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
            position: positions.get(node.id) ?? node.position,
        })),
        edges,
    }
}

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
    { ptr: 6n, opc: OpCodes.MOV64_REG, dst: 1n, src: 6n, off: 0n, imm: 0n },
    { ptr: 7n, opc: OpCodes.MOV64_REG, dst: 2n, src: 7n, off: 0n, imm: 0n },
    { ptr: 8n, opc: OpCodes.CALL_IMM, dst: 0n, src: 1n, off: 0n, imm: 5n }, // calling mul()
    { ptr: 9n, opc: OpCodes.MOV64_REG, dst: 6n, src: 0n, off: 0n, imm: 0n },
    { ptr: 10n, opc: OpCodes.SUB64_IMM, dst: 7n, src: 0n, off: 0n, imm: 1n },
    { ptr: 11n, opc: OpCodes.JA, dst: 0n, src: 0n, off: -7n, imm: 0n },
    { ptr: 12n, opc: OpCodes.MOV64_REG, dst: 0n, src: 6n, off: 0n, imm: 0n },
    { ptr: 13n, opc: OpCodes.EXIT, dst: 0n, src: 0n, off: 0n, imm: 0x00n },
    // mul:
    { ptr: 14n, opc: OpCodes.MOV64_IMM, dst: 0n, src: 0n, off: 0n, imm: 0n },
    { ptr: 15n, opc: OpCodes.JEQ64_IMM, dst: 2n, src: 0n, off: 3n, imm: 0n },
    { ptr: 16n, opc: OpCodes.ADD64_REG, dst: 0n, src: 1n, off: 0n, imm: 0n },
    { ptr: 17n, opc: OpCodes.SUB64_IMM, dst: 2n, src: 0n, off: 0n, imm: 1n },
    { ptr: 18n, opc: OpCodes.JA, dst: 0n, src: 0n, off: -4n, imm: 0n },
    { ptr: 19n, opc: OpCodes.EXIT, dst: 0n, src: 0n, off: 0n, imm: 0x00n },
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

export function GraphVisualization() {
    const [currentStep, setCurrentStep] = useState(0)
    const { cfgNodes, cfgEdges, destinationsCfgNodeIndex, instructionIndex } =
        useMemo(() => {
            let localCurrentStep = currentStep
            const {
                cfgNodes: cfgNodesWithDestinations,
                cfgEdges,
                instructionIndex,
                cfgNodeIndex: destinationsCfgNodeIndex,
            } = getFilteredCfgNodesWithDestinations({
                slots: Slots,
                sbpfVersion: Version,
                functionRegistry,
                maxStep: localCurrentStep,
            })
            let cfgNodes = cfgNodesWithDestinations
            localCurrentStep =
                localCurrentStep - instructionIndex - destinationsCfgNodeIndex
            if (localCurrentStep > 0) {
                const result = linkCfgNodes({
                    cfgNodes,
                    maxStep: localCurrentStep,
                })
                cfgNodes = result.cfgNodes
            }
            return {
                cfgNodes,
                cfgEdges,
                destinationsCfgNodeIndex,
                instructionIndex,
            }
        }, [currentStep])

    const maxStep = Slots.length + cfgNodes.inner.size * 2 - 1

    const grouppedSlots = useMemo(() => {
        return groupInstructionsByCfgNodes({ cfgNodes, slots: Slots })
    }, [cfgNodes])

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
    const { fitView } = useReactFlow()

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    )

    // Calculate the initial layout on mount.
    useEffect(() => {
        let cancelled = false
        getLayoutedElements({ nodes: initialNodes, edges: initialEdges })
            .then(({ nodes: layoutedNodes, edges: layoutedEdges }) => {
                if (cancelled) return
                setNodes(layoutedNodes)
                setEdges(layoutedEdges)
                void fitView()
            })
            .catch(logger.error)
        return () => {
            cancelled = true
        }
    }, [setNodes, setEdges, fitView])

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    Visualization of Control-Flow Graph getting build
                </CardTitle>
                <CardDescription>
                    Use slider or buttons to step through parsing
                </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center py-2">
                <ResizablePanelGroup
                    orientation="horizontal"
                    className="relative rounded-lg border"
                >
                    <ResizablePanel defaultSize="50%">
                        <div className="relative flex justify-center p-2 flex-col gap-1">
                            {/* <div className="absolute bottom-3 right-3 z-10 opacity-90">
                                            <FormattingSelector
                                                formatStyle={formatStyle}
                                                setFormatStyle={setFormatStyle}
                                            />
                                        </div> */}
                            {grouppedSlots.map(
                                (
                                    { owner, slots: groupSlots, startPc },
                                    index,
                                ) => (
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
                                                #{index + 1}
                                            </span>
                                        )}
                                        {groupSlots.map((_, groupPc) => {
                                            const pc = startPc + groupPc
                                            const labelU8Arr =
                                                functionRegistry.map.inner.get(
                                                    BigInt(pc),
                                                )?.[0]
                                            const isActive =
                                                instructionIndex === pc
                                            const isLeader =
                                                !!cfgNodes.inner.get(BigInt(pc))
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
                                                            prog: Slots,
                                                            pc: BigInt(pc),
                                                            style: "LLVM",
                                                        })}
                                                    </span>
                                                </React.Fragment>
                                            )
                                        })}
                                    </div>
                                ),
                            )}
                        </div>
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize="50%">
                        <ResizablePanelGroup key={1} orientation="vertical">
                            <ResizablePanel defaultSize="70%">
                                <ReactFlow
                                    suppressHydrationWarning
                                    nodes={nodes}
                                    edges={edges}
                                    onConnect={onConnect}
                                    onNodesChange={onNodesChange}
                                    onEdgesChange={onEdgesChange}
                                    fitView
                                >
                                    <Background />
                                </ReactFlow>
                            </ResizablePanel>
                            <ResizableHandle withHandle />
                            <ResizablePanel
                                defaultSize="30%"
                                className="flex justify-center items-center"
                            >
                                <div className="flex justify-center p-2 flex-col gap-1">
                                    <p>
                                        Leaders:{" "}
                                        {cfgNodes.inner.size === 0 ? (
                                            <span className="text-foreground/50">
                                                {"<Empty>"}
                                            </span>
                                        ) : (
                                            Array.from(cfgNodes.inner).map(
                                                ([pc, cfgNode], index) => {
                                                    const isActive =
                                                        index ===
                                                        destinationsCfgNodeIndex
                                                    const destinationsPassedCfgNode =
                                                        index <=
                                                        destinationsCfgNodeIndex
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
                                                            {destinationsPassedCfgNode && (
                                                                <span>
                                                                    {"-> "}[
                                                                    {cfgNode.destinations.join(
                                                                        "|",
                                                                    )}
                                                                    ]
                                                                </span>
                                                            )}
                                                        </Badge>
                                                    )
                                                },
                                            )
                                        )}
                                    </p>
                                </div>
                            </ResizablePanel>
                        </ResizablePanelGroup>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </CardContent>
            <CardFooter className="flex-col items-start gap-4 text-sm">
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
                            onClick={() => setCurrentStep((prev) => prev - 1)}
                        >
                            Previous
                        </Button>
                        <Button
                            className="w-[10ch]"
                            disabled={currentStep === maxStep}
                            onClick={() => setCurrentStep((prev) => prev + 1)}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </CardFooter>
        </Card>
    )
}

function linkCfgNodes({
    cfgNodes,
    maxStep,
}: {
    cfgNodes: SortedMap<CfgNode>
    maxStep?: number
}) {
    const maxPossibleStep = cfgNodes.inner.size - 1
    maxStep =
        typeof maxStep === "undefined" || maxStep > maxPossibleStep
            ? maxPossibleStep
            : maxStep
    const linkedCfgNodes = SortedMap.new<CfgNode>()
    linkedCfgNodes.inner = new Map([...cfgNodes.inner])

    for (let i = 0; i < maxStep; i++) {
        const [source, { destinations }] = [...linkedCfgNodes.inner][i]
        for (const destination of destinations) {
            linkedCfgNodes.inner.get(destination)?.sources.push(source)
        }
    }

    return { cfgNodes: linkedCfgNodes }
}
