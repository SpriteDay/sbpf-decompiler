import {
    SortedMap,
    stringToU8Array,
    u8ArrayToString,
} from "./dependencies/utils"
import {
    augmentLddwUnchecked,
    getInsnUnchecked,
    hashSymbolName,
    Insn,
    OpCodes,
} from "./ebpf"
import { Executable } from "./elf"
import { SBPFFeatures, SBPFVersion } from "./program"

/** Used for topological sort */
export interface TopologicalIndex {
    /** Strongly connected component ID (https://en.wikipedia.org/wiki/Strongly_connected_component) */
    sccId: number
    /** Discovery order inside a strongly connected component (https://en.wikipedia.org/wiki/Depth-first_search) */
    discovery: number
}

export const TopologicalIndex = {
    default(): TopologicalIndex {
        return {
            sccId: Infinity,
            discovery: Infinity,
        }
    },

    cmp(self: TopologicalIndex, other: TopologicalIndex): number {
        let result = Number(self.sccId - other.sccId)
        if (result === 0) {
            result = Number(self.discovery - other.discovery)
        }
        return result
    },
}

/** A node of the control-flow graph */
export interface CfgNode {
    /** Human readable name */
    label: string
    /** Predesessors which can jump to the start of this basic block */
    sources: Array<bigint>
    /** Successors which the end of this basic block can jump to */
    destinations: Array<bigint>
    /** Range of the instructions belonging to this basic block */
    instructions: [number, number]
    /** Topological index */
    topoIndex: TopologicalIndex
}

export const CfgNode = {
    default(): CfgNode {
        return {
            label: "",
            sources: [],
            destinations: [],
            instructions: [0, 0],
            topoIndex: TopologicalIndex.default(),
        }
    },
}

/** Result of the executable analysis */
export interface Analysis {
    /** The program which is analyzed */
    executable: Executable
    /** Plain list of instructions as they occur in the executable */
    instructions: Array<Insn>
    /** Functions in the executable */
    functions: SortedMap<[bigint, string]>
    /** Nodes of the control-flow graph */
    cfgNodes: SortedMap<CfgNode>
    /** Topological order of cfgNodes */
    topologicalOrder: Array<bigint>
    /** Virtual CfgNode that reaches all functions */
    superRoot: bigint
}

export const Analysis = {
    /** Analyze an executable statically */
    fromExecutable({ executable }: { executable: Executable }): Analysis {
        const slots = executable.slots
        const sbpfVersion = executable.sbpfVersion
        const functions = SortedMap.new<[bigint, string]>()
        executable.functionRegistry.map.inner
            .entries()
            .forEach(([key, [functionName, pc]]) => {
                SortedMap.insert(functions, {
                    key: pc,
                    value: [key, u8ArrayToString(functionName)],
                })
            })

        const instructions: Array<Insn> = []
        let insnPtr = 0n
        while (insnPtr < slots.length) {
            const insn = getInsnUnchecked({
                slot: slots[Number(insnPtr)],
                pc: insnPtr,
            })
            if (
                !SBPFFeatures.disableLddw(sbpfVersion) &&
                insn.opc === OpCodes.LD_DW_IMM
            ) {
                insnPtr += 1n
                if (insnPtr >= slots.length) {
                    break
                }
                augmentLddwUnchecked({ prog: slots, insn })
            }
            instructions.push(insn)
            insnPtr += 1n
        }
        const result: Analysis = {
            executable,
            instructions,
            functions,
            cfgNodes: SortedMap.new(),
            topologicalOrder: [],
            superRoot: insnPtr,
        }
        Analysis.splitIntoBasicBlocks(result, {
            flattenCallGraph: false,
            sbpfVersion,
        })
        Analysis.controlFlowGraphTarjan(result)
        return result
    },

    linkCfgEdges(
        self: Analysis,
        {
            cfgEdges,
            bothDirections,
        }: {
            cfgEdges: Array<{ 0: bigint; 1: Array<bigint> }>
            bothDirections: boolean
        },
    ) {
        for (const { 0: source, 1: destinations } of cfgEdges) {
            // Put destinations into the source if both directions flag is true
            if (bothDirections) {
                const cfgNode = self.cfgNodes.inner.get(source)
                if (cfgNode) {
                    cfgNode.destinations = destinations
                }
            }
            for (const destination of destinations) {
                self.cfgNodes.inner.get(destination)?.sources.push(source)
            }
        }
    },

    /**
     * Splits the sequence of instructions into basic blocks
     *
     * Also links the control-flow graph edges between the basic blocks
     **/
    splitIntoBasicBlocks(
        self: Analysis,
        {
            flattenCallGraph = false,
            sbpfVersion,
        }: { flattenCallGraph?: boolean; sbpfVersion: SBPFVersion },
    ) {
        // Starting CFG node at PC: 0
        SortedMap.insert(self.cfgNodes, { key: 0n, value: CfgNode.default() })
        // Loop through the functions to create CFG node for each of them - labeled functions
        // are considered basic block leaders
        for (const pc of self.functions.inner.keys()) {
            if (!self.cfgNodes.inner.get(pc)) {
                SortedMap.insert(self.cfgNodes, {
                    key: pc,
                    value: CfgNode.default(),
                })
            }
        }
        // Edges = "ends" of the basic blocks, we store PC and array of potential destinations
        const cfgEdges = SortedMap.new<{ 0: bigint; 1: Array<bigint> }>()
        for (const insn of self.instructions) {
            const targetPc = BigInt.asUintN(
                64,
                BigInt.asIntN(64, insn.ptr) + 1n + BigInt.asIntN(64, insn.off),
            )
            switch (insn.opc) {
                case OpCodes.CALL_IMM: {
                    const key = SBPFFeatures.calculateCallImmTargetPc(
                        sbpfVersion,
                        { pc: insn.ptr, imm: insn.imm },
                    )
                    const entry =
                        self.executable.functionRegistry.map.inner.get(key)
                    let targetPc: bigint | undefined = undefined
                    if (
                        entry &&
                        !(
                            SBPFFeatures.staticSyscalls(sbpfVersion) &&
                            insn.src === 0n
                        )
                    ) {
                        // In case function was found in registry and it's not V3+ syscall
                        targetPc = entry[1]
                    }
                    if (SBPFFeatures.staticSyscalls(sbpfVersion)) {
                        // According to SIMD-0178 src === 1 is for internal calls, and src === 0 is for static syscalls
                        // Since static syscall does not alter the execution we only add pc if it's an internal call
                        if (insn.src === 1n) {
                            targetPc = key
                        }
                    }
                    if (typeof targetPc !== "undefined") {
                        // Mark start of a basic block at the fall-through PC
                        if (!self.cfgNodes.inner.get(insn.ptr + 1n)) {
                            SortedMap.insert(self.cfgNodes, {
                                key: insn.ptr + 1n,
                                value: CfgNode.default(),
                            })
                        }
                        // Mark start of a basic block at the callee PC
                        if (!self.cfgNodes.inner.get(targetPc)) {
                            SortedMap.insert(self.cfgNodes, {
                                key: targetPc,
                                value: CfgNode.default(),
                            })
                        }
                        // Flatten call graph flag means we make one big CFG for the whole program,
                        // disabled flag means we make CFG per each function
                        const destinations = flattenCallGraph
                            ? [insn.ptr + 1n, targetPc]
                            : [insn.ptr + 1n]

                        SortedMap.insert(cfgEdges, {
                            key: insn.ptr,
                            value: [insn.opc, destinations],
                        })
                    }

                    break
                }
                case OpCodes.CALL_REG: {
                    // Abnormal CFG edge
                    if (!self.cfgNodes.inner.get(insn.ptr + 1n)) {
                        SortedMap.insert(self.cfgNodes, {
                            key: insn.ptr + 1n,
                            value: CfgNode.default(),
                        })
                    }
                    // Because callee of CALL_REG is undefined at static analysis time,
                    // we mark potential callee to be anywhere in the program for
                    // flatten call graph case, that's why we insert here a super root
                    const destinations = flattenCallGraph
                        ? [insn.ptr + 1n, self.superRoot]
                        : [insn.ptr + 1n]
                    SortedMap.insert(cfgEdges, {
                        key: insn.ptr,
                        value: [insn.opc, destinations],
                    })
                    break
                }
                case OpCodes.EXIT: {
                    if (!self.cfgNodes.inner.get(insn.ptr + 1n)) {
                        SortedMap.insert(self.cfgNodes, {
                            key: insn.ptr + 1n,
                            value: CfgNode.default(),
                        })
                    }
                    // No destinations for EXIT opcode
                    SortedMap.insert(cfgEdges, {
                        key: insn.ptr,
                        value: [insn.opc, []],
                    })
                    break
                }
                case OpCodes.JA: {
                    if (!self.cfgNodes.inner.get(insn.ptr + 1n)) {
                        SortedMap.insert(self.cfgNodes, {
                            key: insn.ptr + 1n,
                            value: CfgNode.default(),
                        })
                    }
                    if (!self.cfgNodes.inner.get(targetPc)) {
                        SortedMap.insert(self.cfgNodes, {
                            key: targetPc,
                            value: CfgNode.default(),
                        })
                    }
                    SortedMap.insert(cfgEdges, {
                        key: insn.ptr,
                        value: [insn.opc, [targetPc]],
                    })
                    break
                }
                case OpCodes.JEQ64_IMM:
                case OpCodes.JGT64_IMM: {
                    if (!self.cfgNodes.inner.get(insn.ptr + 1n)) {
                        SortedMap.insert(self.cfgNodes, {
                            key: insn.ptr + 1n,
                            value: CfgNode.default(),
                        })
                    }
                    if (!self.cfgNodes.inner.get(targetPc)) {
                        SortedMap.insert(self.cfgNodes, {
                            key: targetPc,
                            value: CfgNode.default(),
                        })
                    }
                    SortedMap.insert(cfgEdges, {
                        key: insn.ptr,
                        value: [insn.opc, [insn.ptr + 1n, targetPc]],
                    })
                    break
                }
            }
        }

        // Filtering cfg nodes, cfg edges and functions
        self.cfgNodes.inner = new Map(
            self.cfgNodes.inner.entries().filter(([cfgNodeStart, _cfgNode]) => {
                return self.instructions.find((insn) => {
                    return insn.ptr === cfgNodeStart
                })
            }),
        )

        for (const [_key, cfgEdge] of cfgEdges.inner) {
            cfgEdge[1] = cfgEdge[1].filter((destination) => {
                return self.cfgNodes.inner.has(destination)
            })
        }

        self.functions.inner = new Map(
            self.functions.inner.entries().filter(([functionStart, _]) => {
                return self.cfgNodes.inner.has(functionStart)
            }),
        )

        // Defining instruction range and destinations for each CFG node
        let instructionIndex = 0
        let cfgEdgeIterCounter = 0
        self.cfgNodes.inner
            .entries()
            .forEach(([_cfgNodeStart, cfgNode], index) => {
                const cfgNodeEnd =
                    index + 1 < Array.from(self.cfgNodes.inner).length
                        ? // Next basic block start - 1, if there is a next block
                          Array.from(self.cfgNodes.inner.entries())[
                              index + 1
                          ][0] - 1n
                        : // Or just the last instruction in the program
                          self.instructions[self.instructions.length - 1].ptr

                // Defining the range of instructions included in this CFG node
                cfgNode.instructions[0] = instructionIndex
                while (instructionIndex < self.instructions.length) {
                    if (self.instructions[instructionIndex].ptr <= cfgNodeEnd) {
                        instructionIndex += 1
                        // Update the end instruction index in our CFG node
                        cfgNode.instructions[1] = instructionIndex
                    } else {
                        break
                    }
                }

                // If there is a recorded CFG edge within our calculated CFG node boundaries,
                // we copy edge's destinations from the edge to the current CFG node and continue the loop
                if (
                    cfgEdgeIterCounter <
                    Array.from(cfgEdges.inner.entries()).length
                ) {
                    const nextCfgEdge = Array.from(cfgEdges.inner.entries())[
                        cfgEdgeIterCounter
                    ]
                    if (nextCfgEdge[0] <= cfgNodeEnd) {
                        cfgNode.destinations = [...nextCfgEdge[1][1]]
                        cfgEdgeIterCounter++
                        return
                    }
                }
                // If there was no CFG edge within our CFG node bounadries, then if the next cfg start is
                // not a function (we keep CFG nodes split by function boundaries), we record fall-through
                // destination to the next block
                if (index + 1 < Array.from(self.cfgNodes.inner).length) {
                    const nextCfgNode = Array.from(self.cfgNodes.inner)[
                        index + 1
                    ]
                    // If the next block is not a known function - we also record a fall-through to it
                    // The check for function is not enforced by runtime - it's something we do to simplify
                    // function detection at the Tarjan step
                    if (!self.functions.inner.get(nextCfgNode[0])) {
                        cfgNode.destinations.push(nextCfgNode[0])
                    }
                }
            })

        // Record every node that have some other node as destination, as a source of this node
        Analysis.linkCfgEdges(self, {
            cfgEdges: [...self.cfgNodes.inner].map(([source, cfgNode]) => ({
                0: source,
                1: [...cfgNode.destinations],
            })),
            bothDirections: false,
        })

        if (flattenCallGraph) {
            let destinations: Array<bigint> = []
            const cfgEdges: Array<{ 0: bigint; 1: Array<bigint> }> = []
            for (const { 0: source, 1: cfgNode } of self.cfgNodes.inner) {
                if (self.functions.inner.has(source)) {
                    destinations = cfgNode.sources.map(
                        (destination) =>
                            self.instructions[
                                self.cfgNodes.inner.get(destination)!
                                    .instructions[1]
                            ].ptr,
                    )
                }
                if (
                    cfgNode.destinations.length === 0 &&
                    self.instructions[cfgNode.instructions[1] - 1].opc ===
                        OpCodes.EXIT
                ) {
                    cfgEdges.push({ 0: source, 1: [...destinations] })
                }
            }
            Analysis.linkCfgEdges(self, { cfgEdges, bothDirections: true })
        }
    },

    /**
     * Finds the strongly connected components
     *
     * Generates a topological order as by-product
     *
     * https://en.wikipedia.org/wiki/Tarjan%27s_strongly_connected_components_algorithm
     */
    controlFlowGraphTarjan(self: Analysis) {
        if (self.cfgNodes.inner.size === 0) {
            return
        }
        interface NodeState {
            cfgNode: bigint
            discovery: number
            lowlink: number
            sccId: number
            isOnSccStack: boolean
        }

        // Convert each CFG node into Tarjan-ready node state
        const nodes = [...self.cfgNodes.inner].map(([key, cfgNode], v) => {
            cfgNode.topoIndex.sccId = v
            const result: NodeState = {
                cfgNode: key,
                discovery: Infinity,
                lowlink: Infinity,
                sccId: Infinity,
                isOnSccStack: false,
            }
            return result
        })

        let sccId = 0
        const sccStack: Array<number> = []
        let discovered = 0
        let nextV = 1
        const recursionStack: Array<[number, number]> = [[0, 0]]
        dfs: while (recursionStack.length > 0) {
            const [v, edgeIndex] = recursionStack.pop()!
            const node = nodes[v]
            if (edgeIndex === 0) {
                node.discovery = discovered
                node.lowlink = discovered
                node.isOnSccStack = true
                sccStack.push(v)
                discovered += 1
            }
            const cfgNode = self.cfgNodes.inner.get(node.cfgNode)!
            for (const [j, destination] of [
                ...cfgNode.destinations.entries(),
            ].slice(edgeIndex, cfgNode.destinations.length)) {
                const w = self.cfgNodes.inner.get(destination)!.topoIndex.sccId
                // Initial state node checl
                if (nodes[w].discovery === Infinity) {
                    recursionStack.push([v, j + 1])
                    recursionStack.push([w, 0])
                    continue dfs
                } else if (nodes[w].isOnSccStack) {
                    // Assigning min low link value - refer to Tarjan's algorithm
                    nodes[v].lowlink = Math.min(
                        nodes[v].lowlink,
                        nodes[w].discovery,
                    )
                }
            }
            // Finding SCCs
            if (nodes[v].discovery === nodes[v].lowlink) {
                let indexInScc = 0
                // Assigning index inside of SCC
                while (sccStack.length > 0) {
                    const w = sccStack.pop()!
                    const node = nodes[w]
                    node.isOnSccStack = false
                    node.sccId = sccId
                    node.discovery = indexInScc
                    indexInScc += 1
                    if (w === v) {
                        break
                    }
                }
                sccId += 1
            }
            if (recursionStack.length > 0) {
                const [w, _] = recursionStack.at(-1)!
                nodes[w].lowlink = Math.min(nodes[w].lowlink, nodes[v].lowlink)
            } else {
                while (true) {
                    // If exhausted
                    if (nextV === nodes.length) {
                        break dfs
                    }
                    if (nodes[nextV].discovery === Infinity) {
                        break
                    }
                    nextV += 1
                }
                recursionStack.push([nextV, 0])
                nextV += 1
            }
        }
        for (const node of nodes) {
            const cfgNode = self.cfgNodes.inner.get(node.cfgNode)!
            cfgNode.topoIndex = {
                sccId: node.sccId,
                discovery: node.discovery,
            }
        }
        const topologicalOrder = [...self.cfgNodes.inner.keys()]
        topologicalOrder.sort((a, b) => {
            return TopologicalIndex.cmp(
                self.cfgNodes.inner.get(b)!.topoIndex,
                self.cfgNodes.inner.get(a)!.topoIndex,
            )
        })
        self.topologicalOrder = topologicalOrder
        const superRoot: CfgNode = {
            ...CfgNode.default(),
            instructions: [self.instructions.length, self.instructions.length],
        }
        let firstNode = self.topologicalOrder[0]
        let hasExternalSource = false
        for (const [index, v] of self.topologicalOrder.entries()) {
            const cfgNode = self.cfgNodes.inner.get(v)
            hasExternalSource =
                hasExternalSource ||
                !!cfgNode?.sources.some((source) => {
                    return (
                        self.cfgNodes.inner.get(source)?.topoIndex.sccId !==
                        cfgNode.topoIndex.sccId
                    )
                })
            const nextV = self.topologicalOrder[index + 1]
            if (
                typeof nextV === "undefined" ||
                (typeof nextV !== "undefined" &&
                    self.cfgNodes.inner.get(nextV)?.topoIndex.sccId !==
                        cfgNode?.topoIndex.sccId)
            ) {
                if (!hasExternalSource && firstNode !== self.superRoot) {
                    superRoot.destinations.push(firstNode)
                }
                firstNode = self.topologicalOrder[index + 1]
                hasExternalSource = false
            }
        }
        // Populating function registry with found functions
        for (const v of superRoot.destinations) {
            const cfgNode = self.cfgNodes.inner.get(v)
            cfgNode?.sources.push(self.superRoot)
            const entry = self.functions.inner.get(v)
            if (!entry) {
                const name = `function_${v}`
                const hash = hashSymbolName(stringToU8Array(name))
                SortedMap.insert(self.functions, {
                    key: v,
                    value: [BigInt(hash), name],
                })
            }
        }
        SortedMap.insert(self.cfgNodes, {
            key: self.superRoot,
            value: superRoot,
        })
    },
}
