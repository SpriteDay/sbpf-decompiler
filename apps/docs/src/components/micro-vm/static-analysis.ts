import { SortedMap, u8ArrayToString } from "./dependencies/utils"
import { augmentLddwUnchecked, getInsnUnchecked, Insn, OpCodes } from "./ebpf"
import { Executable } from "./elf"
import { SBPFFeatures, SBPFVersion } from "./program"

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
}

export const CfgNode = {
    default(): CfgNode {
        return {
            label: "",
            sources: [],
            destinations: [],
            instructions: [0, 0],
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
            superRoot: insnPtr,
        }
        Analysis.splitIntoBasicBlocks(result, {
            flattenCallGraph: false,
            sbpfVersion,
        })
        return result
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
            cfgEdge[1] = cfgEdge[1].filter((destinations) => {
                return self.cfgNodes.inner.has(destinations)
            })
        }

        self.functions.inner = new Map(
            self.functions.inner.entries().filter(([functionStart, _]) => {
                return self.cfgNodes.inner.has(functionStart)
            }),
        )

        //
        let instructionIndex = 0
        let cfgEdgeIterCounter = 0
        self.cfgNodes.inner
            .entries()
            .forEach(([cfgNodeStart, cfgNode], index) => {
                const cfgNodeEnd =
                    index + 1 < Array.from(self.cfgNodes.inner).length
                        ? // Next basic block start - 1, if there is a next block
                          Array.from(self.cfgNodes.inner.entries())[
                              index + 1
                          ][0] - 1n
                        : // Or just the last instruction in the program
                          self.instructions[self.instructions.length - 1].ptr
                // Writing down down the start of the CFG node
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
                // we copy edge's destinations from the edge to the current CFG node
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
                    }

                    // Record a fall-through PC if we are not in the function
                    // (if we are in the function, the boundaries end at EXIT and we don't continue)
                } else if (index + 1 < Array.from(self.cfgNodes.inner).length) {
                    const nextCfgNode = Array.from(self.cfgNodes.inner)[
                        index + 1
                    ]
                    if (!self.functions.inner.get(cfgNodeStart)) {
                        cfgNode.destinations.push(nextCfgNode[0])
                    }
                }
            })
    },
}
