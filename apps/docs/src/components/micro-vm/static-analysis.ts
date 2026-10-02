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
        self.cfgNodes.inner.set(0n, CfgNode.default())
        for (const pc of self.functions.inner.keys()) {
            const entry = self.cfgNodes.inner.get(pc)
            if (!entry) {
                self.cfgNodes.inner.set(pc, CfgNode.default())
            }
        }
        const cfgEdges = SortedMap.new()
        self.instructions
    },
}
