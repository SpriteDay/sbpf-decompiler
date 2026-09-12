import { SortedMap, u8ArrayToString } from "./dependencies/utils"
import { Insn } from "./ebpf"
import { Executable } from "./elf"

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
    functions: SortedMap<bigint, [number, string]>
    /** Nodes of the control-flow graph */
    cfgNodes: SortedMap<number, CfgNode>
    /** CfgNode where the execution starts */
    entrypoint: number
    /** Virtual CfgNode that reaches all functions */
    superRoot: number
}

export const Analysis = {
    /** Analyze an executable statically */
    fromExecutable({ executable }: { executable: Executable }): Analysis {
        const functions: Analysis["functions"] = SortedMap.new()
        for (const [key, [functionName, pc]] of Executable.getFunctionRegistry(
            executable,
        ).map) {
            functions.set(pc, [key, u8ArrayToString(functionName)])
        }
    },
}
