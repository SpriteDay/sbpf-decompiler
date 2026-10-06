"use client"

import { Insn, OpCodes } from "@/components/micro-vm/ebpf"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react"
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
    BaseEdge,
    Controls,
    type Edge,
    type EdgeProps,
    Handle,
    MarkerType,
    type Node,
    type NodeProps,
    Panel,
    Position,
    ReactFlow,
    type XYPosition,
    useNodesState,
    useReactFlow,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { logger } from "@/lib/logger"
import { useTheme } from "next-themes"

const elk = new ELK()

// Elk has a *huge* amount of options to configure. To see everything you can
// tweak check out:
//
// - https://www.eclipse.org/elk/reference/algorithms.html
// - https://www.eclipse.org/elk/reference/options.html
const elkOptions: LayoutOptions = {
    "elk.direction": "DOWN",
    "elk.algorithm": "layered",
    "elk.layered.spacing.nodeNodeBetweenLayers": "50",
    "elk.spacing.nodeNode": "40",
    // Edges are drawn by the routes ELK gives, which go around the nodes
    "elk.edgeRouting": "ORTHOGONAL",
    "elk.layered.feedbackEdges": "true",
    "elk.spacing.edgeNode": "20",
    "elk.spacing.edgeEdge": "15",
    "elk.layered.spacing.edgeNodeBetweenLayers": "20",
    "elk.layered.spacing.edgeEdgeBetweenLayers": "15",
}

const NodeWidth = 240
// Height of the node card without instructions (header, footer and paddings)
// and of a single instruction row, to tell ELK how much space a node takes.
const NodeBaseHeight = 76
const NodeRowHeight = 16

const PendingEdgeColor = "#6366f1"
const LinkedEdgeColor = "var(--color-foreground)"

type CfgFlowNode = Node<{ height: number }, "cfgNode">
type CfgFlowEdge = Edge<{ points: Array<XYPosition> }, "cfgEdge">

// React Flow and ELK have their own node/edge shapes, so the graph is
// translated to ELK for the layout and only node positions and edge routes
// are taken back.
const getLayoutedElements = async ({
    cfgNodes,
}: {
    cfgNodes: SortedMap<CfgNode>
}): Promise<{
    nodes: Array<CfgFlowNode>
    edgeRoutes: Map<string, Array<XYPosition>>
}> => {
    const entries = [...cfgNodes.inner]
    const graph: ElkNode = {
        id: "root",
        layoutOptions: elkOptions,
        children: entries.map(([pc, cfgNode]) => ({
            id: String(pc),
            width: NodeWidth,
            height:
                NodeBaseHeight +
                NodeRowHeight *
                    (cfgNode.instructions[1] - cfgNode.instructions[0]),
        })),
        edges: entries.flatMap(([pc, cfgNode]) =>
            cfgNode.destinations
                .filter((destination) => cfgNodes.inner.has(destination))
                .map((destination) => ({
                    id: `${pc}-${destination}`,
                    sources: [String(pc)],
                    targets: [String(destination)],
                })),
        ),
    }

    const layoutedGraph = await elk.layout(graph)
    return {
        nodes: (layoutedGraph.children ?? []).map((node) => ({
            id: node.id,
            type: "cfgNode",
            data: { height: node.height ?? 0 },
            position: { x: node.x ?? 0, y: node.y ?? 0 },
        })),
        edgeRoutes: new Map(
            (layoutedGraph.edges ?? []).flatMap((edge) => {
                const section = edge.sections?.[0]
                if (!section) return []
                return [
                    [
                        edge.id,
                        [
                            section.startPoint,
                            ...(section.bendPoints ?? []),
                            section.endPoint,
                        ],
                    ],
                ]
            }),
        ),
    }
}

const EdgeCornerRadius = 6

/** SVG path going through the points with rounded corners */
function getRoundedPath(points: Array<XYPosition>) {
    return points
        .map((point, index) => {
            const previous = points[index - 1]
            const next = points[index + 1]
            if (!previous) return `M ${point.x} ${point.y}`
            if (!next) return `L ${point.x} ${point.y}`
            // Corner starts and ends a radius away from the bend point
            const towards = (other: XYPosition) => {
                const distance = Math.hypot(
                    other.x - point.x,
                    other.y - point.y,
                )
                const ratio =
                    distance === 0
                        ? 0
                        : Math.min(EdgeCornerRadius, distance / 2) / distance
                return {
                    x: point.x + (other.x - point.x) * ratio,
                    y: point.y + (other.y - point.y) * ratio,
                }
            }
            const start = towards(previous)
            const end = towards(next)
            return `L ${start.x} ${start.y} Q ${point.x} ${point.y} ${end.x} ${end.y}`
        })
        .join(" ")
}

function CfgEdgeRoute({ data, markerEnd, style }: EdgeProps<CfgFlowEdge>) {
    if (!data) return null
    return (
        <BaseEdge
            path={getRoundedPath(data.points)}
            markerEnd={markerEnd}
            style={style}
        />
    )
}

const edgeTypes = { cfgEdge: CfgEdgeRoute }

type CfgNodeView = {
    index: number
    cfgNode: CfgNode
    label?: string
    isActive: boolean
    /** Whether the destinations pass already went through this node */
    hasDestinations: boolean
}

// Positions of the graph nodes are static, their content is taken from here,
// so stepping doesn't re-create React Flow nodes
const CfgNodeViewsContext = createContext<Map<string, CfgNodeView>>(new Map())

function CfgNodeCard({ id, data }: NodeProps<CfgFlowNode>) {
    const view = useContext(CfgNodeViewsContext).get(id)
    if (!view) return null
    const { index, cfgNode, label, isActive, hasDestinations } = view
    const [start, end] = cfgNode.instructions
    const pcs = Array.from(
        { length: Math.max(end - start, 0) },
        (_, offset) => start + offset,
    )

    return (
        <div
            // The size is the same as ELK got, so the edge routes end at the borders
            style={{ width: NodeWidth, height: data.height }}
            className={cn(
                "flex flex-col rounded-md border bg-background font-mono text-xs transition-colors duration-100",
                pcs.length === 0
                    ? "border-dashed text-foreground/50"
                    : "border-red-600/50 dark:border-red-400/50",
                isActive && "ring-2 ring-red-950 dark:ring-red-700",
            )}
        >
            <Handle
                type="target"
                position={Position.Top}
                isConnectable={false}
                className="opacity-0"
            />
            <div
                className={cn(
                    "flex justify-between gap-2 border-b border-inherit px-2 py-1 font-semibold",
                    isActive
                        ? "bg-red-950 dark:bg-red-700 text-background dark:text-foreground"
                        : "bg-red-800/15 dark:bg-red-500/15",
                )}
            >
                <span className="truncate">
                    #{index + 1}
                    {label && ` ${label}`}
                </span>
                <span>pc {id}</span>
            </div>
            <div className="flex grow flex-col px-2 py-1">
                {pcs.length === 0 ? (
                    <span>{"<Empty>"}</span>
                ) : (
                    pcs.map((pc) => (
                        <span key={pc} className="truncate">
                            {pc}:{" "}
                            {formatInstruction({
                                prog: Slots,
                                pc: BigInt(pc),
                                style: "LLVM",
                            })}
                        </span>
                    ))
                )}
            </div>
            <div className="flex flex-col border-t border-inherit px-2 py-1">
                <span className="truncate">
                    sources: [{cfgNode.sources.join(", ")}]
                </span>
                <span className="truncate">
                    destinations:{" "}
                    {hasDestinations
                        ? `[${cfgNode.destinations.join(", ")}]`
                        : "?"}
                </span>
            </div>
            <Handle
                type="source"
                position={Position.Bottom}
                isConnectable={false}
                className="opacity-0"
            />
        </div>
    )
}

const nodeTypes = { cfgNode: CfgNodeCard }

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

export function GraphVisualization({
    flattenCallGraph = false,
}: {
    flattenCallGraph?: boolean
}) {
    const [currentStep, setCurrentStep] = useState(0)
    const {
        cfgNodes,
        cfgEdges,
        destinationsCfgNodeIndex,
        linkingCfgNodeIndex,
        instructionIndex,
        lastEvent,
        linkingStep,
    } = useMemo(() => {
        const {
            cfgNodes: cfgNodesWithDestinations,
            cfgEdges,
            instructionIndex,
            cfgNodeIndex: destinationsCfgNodeIndex,
            lastEvent,
        } = getFilteredCfgNodesWithDestinations({
            slots: Slots,
            sbpfVersion: Version,
            functionRegistry,
            maxStep: currentStep,
            flattenCallGraph,
        })
        let cfgNodes = cfgNodesWithDestinations
        // Steps left after instructions and destinations pass go to the sources linking pass
        const linkingStep =
            currentStep - instructionIndex - destinationsCfgNodeIndex
        let linkingCfgNodeIndex: number | undefined = undefined
        if (linkingStep > 0) {
            const result = linkCfgNodes({
                cfgNodes,
                maxStep: linkingStep,
            })
            cfgNodes = result.cfgNodes
            linkingCfgNodeIndex = linkingStep
        }
        return {
            cfgNodes,
            cfgEdges,
            destinationsCfgNodeIndex,
            linkingCfgNodeIndex,
            instructionIndex,
            lastEvent,
            linkingStep,
        }
    }, [currentStep, flattenCallGraph])

    const isLinking = linkingStep > 0
    const activeCfgNodeIndex = isLinking
        ? linkingStep - 1
        : destinationsCfgNodeIndex

    const maxStep = Slots.length + cfgNodes.inner.size * 2 - 1

    const grouppedSlots = useMemo(() => {
        return groupInstructionsByCfgNodes({ cfgNodes, slots: Slots })
    }, [cfgNodes])

    const [nodes, setNodes, onNodesChange] = useNodesState<CfgFlowNode>([])
    const [edgeRoutes, setEdgeRoutes] = useState(
        new Map<string, Array<XYPosition>>(),
    )
    const { fitView } = useReactFlow()
    // React Flow has to follow the theme of the docs instead of the system one,
    // as it sets its own `dark` class on the canvas
    const { resolvedTheme } = useTheme()
    const colorMode = resolvedTheme === "dark" ? "dark" : "light"

    // The complete graph is layouted once on mount, so the nodes keep their
    // places while stepping.
    useEffect(() => {
        let cancelled = false
        const { cfgNodes } = linkCfgNodes({
            cfgNodes: getFilteredCfgNodesWithDestinations({
                slots: Slots,
                sbpfVersion: Version,
                functionRegistry,
                flattenCallGraph,
            }).cfgNodes,
        })
        getLayoutedElements({ cfgNodes })
            .then(({ nodes: layoutedNodes, edgeRoutes }) => {
                if (cancelled) return
                setNodes(layoutedNodes)
                setEdgeRoutes(edgeRoutes)
            })
            .catch(logger.error)
        return () => {
            cancelled = true
        }
    }, [setNodes, flattenCallGraph])

    // The whole graph is too big to stay readable in the panel, so the
    // viewport follows the node being processed and its destinations.
    const isLayouted = nodes.length > 0
    const focusedPcs = useMemo(() => {
        const entry = [...cfgNodes.inner][activeCfgNodeIndex]
        if (!entry) return ""
        const [pc, { destinations }] = entry
        return [pc, ...destinations].join(",")
    }, [cfgNodes, activeCfgNodeIndex])
    useEffect(() => {
        if (!isLayouted || !focusedPcs) return
        void fitView({
            nodes: focusedPcs.split(",").map((id) => ({ id })),
            maxZoom: 1,
            duration: 300,
        })
    }, [isLayouted, focusedPcs, fitView])

    const cfgNodeViews = useMemo(
        () =>
            new Map<string, CfgNodeView>(
                [...cfgNodes.inner].map(([pc, cfgNode], index) => {
                    const labelU8Arr = functionRegistry.map.inner.get(pc)?.[0]
                    return [
                        String(pc),
                        {
                            index,
                            cfgNode,
                            label: labelU8Arr && u8ArrayToString(labelU8Arr),
                            isActive: index === activeCfgNodeIndex,
                            hasDestinations:
                                isLinking ||
                                index < destinationsCfgNodeIndex ||
                                (index === destinationsCfgNodeIndex &&
                                    !!lastEvent &&
                                    lastEvent.type !== "instruction"),
                        },
                    ]
                }),
            ),
        [
            cfgNodes,
            activeCfgNodeIndex,
            destinationsCfgNodeIndex,
            isLinking,
            lastEvent,
        ],
    )

    // An edge appears once the destinations pass records it at its source node,
    // and becomes solid once the linking pass records it at its target node
    const edges = useMemo(
        () =>
            [...cfgNodes.inner].flatMap(([pc, cfgNode]) =>
                cfgNode.destinations.flatMap(
                    (destination): Array<CfgFlowEdge> => {
                        const id = `${pc}-${destination}`
                        const target = cfgNodes.inner.get(destination)
                        const points = edgeRoutes.get(id)
                        if (!target || !points) return []
                        const isLinked = target.sources.includes(pc)
                        const color = isLinked
                            ? LinkedEdgeColor
                            : PendingEdgeColor
                        return [
                            {
                                id,
                                source: String(pc),
                                target: String(destination),
                                type: "cfgEdge",
                                data: { points },
                                animated: !isLinked,
                                style: {
                                    stroke: color,
                                    strokeWidth: isLinked ? 2 : 1,
                                },
                                markerEnd: {
                                    type: MarkerType.ArrowClosed,
                                    color,
                                },
                            },
                        ]
                    },
                ),
            ),
        [cfgNodes, edgeRoutes],
    )

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
                    orientation="vertical"
                    className="relative h-[90vh]! rounded-lg border"
                >
                    <ResizablePanel defaultSize="50%">
                        <div className="h-full">
                            <CfgNodeViewsContext value={cfgNodeViews}>
                                <ReactFlow
                                    suppressHydrationWarning
                                    nodes={nodes}
                                    edges={edges}
                                    nodeTypes={nodeTypes}
                                    edgeTypes={edgeTypes}
                                    onNodesChange={onNodesChange}
                                    // Edge routes are layouted for the nodes staying in their places
                                    nodesDraggable={false}
                                    nodesConnectable={false}
                                    minZoom={0.2}
                                    colorMode={colorMode}
                                    style={{
                                        background: "transparent",
                                    }}
                                >
                                    <Panel
                                        position="top-left"
                                        className="flex flex-col gap-1 rounded-md border bg-background/90 p-2 text-xs"
                                    >
                                        <span className="font-semibold">
                                            {isLinking
                                                ? "Pass 2: linking sources"
                                                : "Pass 1: instructions and destinations"}
                                        </span>
                                        <span className="flex items-center gap-2">
                                            <span
                                                className="w-6 border-t border-dashed"
                                                style={{
                                                    borderColor:
                                                        PendingEdgeColor,
                                                }}
                                            />
                                            destination recorded
                                        </span>
                                        <span className="flex items-center gap-2">
                                            <span
                                                className="w-6 border-t-2"
                                                style={{
                                                    borderColor:
                                                        LinkedEdgeColor,
                                                }}
                                            />
                                            source linked
                                        </span>
                                    </Panel>
                                    <Controls showInteractive={false} />
                                    <Background />
                                </ReactFlow>
                            </CfgNodeViewsContext>
                        </div>
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize="50%">
                        <ResizablePanelGroup orientation="horizontal">
                            <ResizablePanel
                                defaultSize="50%"
                                className="overflow-y-auto!"
                            >
                                <div className="relative flex justify-center p-2 flex-col gap-1">
                                    {/* <div className="absolute bottom-3 right-3 z-10 opacity-90">
                                            <FormattingSelector
                                                formatStyle={formatStyle}
                                                setFormatStyle={setFormatStyle}
                                            />
                                        </div> */}
                                    {grouppedSlots.map(
                                        (
                                            {
                                                owner,
                                                slots: groupSlots,
                                                startPc,
                                            },
                                            index,
                                        ) => (
                                            <div
                                                className={cn(
                                                    "relative flex flex-col justify-center gap-1 rounded-sm",
                                                    typeof owner !==
                                                        "undefined" &&
                                                        "bg-red-600/10 dark:bg-red-400/10 border border-red-600/50 dark:border-red-400/50",
                                                )}
                                                key={index}
                                            >
                                                {typeof owner === "number" && (
                                                    <span className="absolute top-0.2 right-1 font-semibold text-red-800/80 dark:text-red-400">
                                                        #{index + 1}
                                                    </span>
                                                )}
                                                {groupSlots.map(
                                                    (_, groupPc) => {
                                                        const pc =
                                                            startPc + groupPc
                                                        const labelU8Arr =
                                                            functionRegistry.map.inner.get(
                                                                BigInt(pc),
                                                            )?.[0]
                                                        const isActive =
                                                            instructionIndex ===
                                                            pc
                                                        const isLeader =
                                                            !!cfgNodes.inner.get(
                                                                BigInt(pc),
                                                            )
                                                        const isEdge =
                                                            !!cfgEdges.inner.get(
                                                                BigInt(pc),
                                                            )
                                                        return (
                                                            <React.Fragment
                                                                key={pc}
                                                            >
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
                                                                    {formatInstruction(
                                                                        {
                                                                            prog: Slots,
                                                                            pc: BigInt(
                                                                                pc,
                                                                            ),
                                                                            style: "LLVM",
                                                                        },
                                                                    )}
                                                                </span>
                                                            </React.Fragment>
                                                        )
                                                    },
                                                )}
                                            </div>
                                        ),
                                    )}
                                </div>
                            </ResizablePanel>
                            <ResizableHandle withHandle />
                            <ResizablePanel defaultSize="50%">
                                <ResizablePanelGroup
                                    key={1}
                                    orientation="vertical"
                                >
                                    <ResizablePanel defaultSize="50%">
                                        <div className="flex justify-center p-2 flex-col gap-1">
                                            <p>
                                                Nodes:{" "}
                                                {cfgNodes.inner.size === 0 ? (
                                                    <span className="text-foreground/50">
                                                        {"<Empty>"}
                                                    </span>
                                                ) : (
                                                    Array.from(
                                                        cfgNodes.inner,
                                                    ).map(
                                                        (
                                                            [pc, cfgNode],
                                                            index,
                                                        ) => {
                                                            const isActive =
                                                                index ===
                                                                activeCfgNodeIndex
                                                            const destinationsPassedCfgNode =
                                                                index <=
                                                                destinationsCfgNodeIndex
                                                            const linkingPassedCfgNode =
                                                                typeof linkingCfgNodeIndex ===
                                                                    "number" &&
                                                                index <=
                                                                    linkingCfgNodeIndex
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
                                                                    {linkingPassedCfgNode && (
                                                                        <span>
                                                                            [
                                                                            {cfgNode.sources.join(
                                                                                "|",
                                                                            )}
                                                                            ]
                                                                            {
                                                                                "-> "
                                                                            }
                                                                        </span>
                                                                    )}
                                                                    {pc}
                                                                    {destinationsPassedCfgNode && (
                                                                        <span>
                                                                            {
                                                                                "-> "
                                                                            }
                                                                            [
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
                                    <ResizableHandle withHandle />
                                    <ResizablePanel
                                        defaultSize="50%"
                                        className="flex justify-center items-center"
                                    >
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
                                                    setCurrentStep(
                                                        value as number,
                                                    )
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
                                                    onClick={() =>
                                                        setCurrentStep(
                                                            (prev) => prev - 1,
                                                        )
                                                    }
                                                >
                                                    Previous
                                                </Button>
                                                <Button
                                                    className="w-[10ch]"
                                                    disabled={
                                                        currentStep === maxStep
                                                    }
                                                    onClick={() =>
                                                        setCurrentStep(
                                                            (prev) => prev + 1,
                                                        )
                                                    }
                                                >
                                                    Next
                                                </Button>
                                            </div>
                                        </div>
                                    </ResizablePanel>
                                </ResizablePanelGroup>
                            </ResizablePanel>
                        </ResizablePanelGroup>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </CardContent>
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
    const maxPossibleStep = cfgNodes.inner.size
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
