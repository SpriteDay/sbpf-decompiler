import { SortedMap, u8ArrayToString } from "./dependencies/utils"
import { augmentLddwUnchecked, getInsnUnchecked, Insn, OpCodes } from "./ebpf"
import { Executable } from "./elf"
import { SBPFFeatures, SBPFVersion } from "./program"

/** A node of the control-flow graph */
export interface CfgNode {
    /** Human readable name */
    label: string
    /** Predesessors which can jump to the start of this basic block */
    sources: Array<number>
    /** Successors which the end of this basic block can jump to */
    destinations: Array<number>
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
        SortedMap.insert(self.cfgNodes, { key: 0n, value: CfgNode.default() })
        for (const pc of self.functions.inner.keys()) {
            if (!self.cfgNodes.inner.get(pc)) {
                SortedMap.insert(self.cfgNodes, {
                    key: pc,
                    value: CfgNode.default(),
                })
            }
        }
        const cfgEdges = SortedMap.new<Array<bigint>>()
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
                    if (entry) {
                        targetPc = entry[1]
                    }
                    if (SBPFFeatures.staticSyscalls(sbpfVersion)) {
                        targetPc = key
                    }
                    if (typeof targetPc !== "undefined") {
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
                        const destinations = flattenCallGraph
                            ? [insn.ptr + 1n, self.superRoot]
                            : [insn.ptr + 1n]
                        SortedMap.insert(cfgEdges, {
                            key: insn.ptr,
                            value: [insn.opc, destinations],
                        })
                    }
                    break
                }
                case OpCodes.EXIT: {
                    if (!self.cfgNodes.inner.get(insn.ptr + 1n)) {
                        SortedMap.insert(self.cfgNodes, {
                            key: insn.ptr + 1n,
                            value: CfgNode.default(),
                        })
                    }
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
                        value: [insn.ptr + 1n, targetPc],
                    })
                    break
                }
            }
        }
    },
}
