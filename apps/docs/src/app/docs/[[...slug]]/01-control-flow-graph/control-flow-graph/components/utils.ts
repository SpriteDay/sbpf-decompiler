import {
    SortedMap,
    u8ArrayToString,
} from "@/components/micro-vm/dependencies/utils"
import { Insn, InsnRaw, OpCodes } from "@/components/micro-vm/ebpf"
import {
    FunctionRegistry,
    SBPFFeatures,
    SBPFVersion,
} from "@/components/micro-vm/program"
import { CfgNode } from "@/components/micro-vm/static-analysis"

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
            const callRegistryEntry =
                functionRegistry.map.inner.get(callImmTargetPc)
            // In case a function was found in the registr and it's not V3+ syscall
            if (
                callRegistryEntry &&
                !(SBPFFeatures.staticSyscalls(sbpfVersion) && insn.src === 0n)
            ) {
                targetPc = callRegistryEntry[1]
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
                    pc: pc + 1n,
                    reason: "start of a basic block at the fall-through PC",
                })
            }

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
            break
        }
        case OpCodes.EXIT: {
            if (!leaders.inner.get(pc + 1n)) {
                SortedMap.insert(leaders, {
                    key: pc + 1n,
                    value: CfgNode.default(),
                })
                changes.leaders.push({
                    pc: pc + 1n,
                    reason: "instruction after exit starts new block",
                })
            }
            SortedMap.insert(edges, {
                key: pc,
                value: { opc: insn.opc, destinations: [] },
            })
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

export function accumulateLeadersAndEdges({
    slots,
    endPc,
    functionRegistry,
    sbpfVersion,
}: {
    slots: Array<InsnRaw>
    endPc: bigint
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
    const leadersAcc: ReturnType<typeof recordLeadersAndEdges>["leaders"] =
        SortedMap.new()
    const edgesAcc: ReturnType<typeof recordLeadersAndEdges>["edges"] =
        SortedMap.new()
    let lastChanges: ReturnType<typeof recordLeadersAndEdges>["changes"] = {
        edges: [],
        leaders: [],
    }
    for (let stepPc = 0; stepPc <= endPc; stepPc++) {
        const { leaders, edges, changes } = recordLeadersAndEdges({
            slots,
            pc: BigInt(stepPc),
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
}

export function getFilteredLeadersAndEdges({
    slots,
    currentStep,
    functionRegistry,
    sbpfVersion,
}: {
    slots: Array<InsnRaw>
    currentStep?: number
    functionRegistry: FunctionRegistry<bigint>
    sbpfVersion: SBPFVersion
}) {
    const { leaders, edges } = accumulateLeadersAndEdges({
        slots,
        endPc: BigInt(slots.length - 1),
        functionRegistry,
        sbpfVersion,
    })

    if (typeof currentStep === "undefined") {
        const maxSafeStep =
            leaders.inner.size +
            edges.inner.size +
            functionRegistry.map.inner.size -
            1
        currentStep = maxSafeStep
    }

    const removed: {
        leaders: Array<{ index: number; pc: bigint; reason: string }>
        edgeDestinations: Array<{
            edgePc: bigint
            destinationPc: bigint
            reason: string
        }>
        functions: Array<{ index: number; pc: bigint; reason: string }>
    } = {
        leaders: [],
        edgeDestinations: [],
        functions: [],
    }

    for (let i = 0; i <= currentStep; i++) {
        let index = i
        if (index < leaders.inner.size) {
            const [leaderPc, _leader] = Array.from(leaders.inner)[index]
            if (!slots.entries().some(([pc, _]) => leaderPc === BigInt(pc))) {
                removed.leaders.push({
                    index,
                    pc: leaderPc,
                    reason: "leader's PC is not in the program",
                })
            }
            continue
        }

        index -= leaders.inner.size
        if (index < edges.inner.size) {
            const [key, edge] = Array.from(edges.inner)[index]
            edge.destinations = edge.destinations.filter((destination) => {
                if (
                    !removed.leaders.some(
                        (removedLeader) => destination === removedLeader.pc,
                    ) &&
                    leaders.inner.has(destination)
                ) {
                    return true
                } else {
                    removed.edgeDestinations.push({
                        edgePc: key,
                        destinationPc: destination,
                        reason: "edge target must be within a program",
                    })
                    return false
                }
            })
            continue
        }

        index -= edges.inner.size
        if (index < functionRegistry.map.inner.size) {
            const [functionStart, _] = Array.from(functionRegistry.map.inner)[
                index
            ]
            if (
                removed.leaders.some(
                    (removedLeader) => functionStart === removedLeader.pc,
                ) ||
                !leaders.inner.has(functionStart)
            ) {
                removed.functions.push({
                    index,
                    pc: functionStart,
                    reason: "function start must be within a program",
                })
            }
        }
    }

    return {
        ...accumulateLeadersAndEdges({
            slots,
            endPc: BigInt(slots.length - 1),
            functionRegistry,
            sbpfVersion,
        }),
        removed,
    }
}

export function defineInstructionsAndDestinations({
    maxStep,
    cfgNodes,
    cfgEdges,
    slots,
    functions,
}: {
    maxStep: number
    cfgNodes: SortedMap<CfgNode>
    cfgEdges: SortedMap<{ opc: bigint; destinations: Array<bigint> }>
    slots: Array<InsnRaw>
    functions: FunctionRegistry<bigint>
}): {
    cfgNodes: SortedMap<CfgNode>
    cfgEdges: SortedMap<{ opc: bigint; destinations: Array<bigint> }>
    instructionIndex: number
    cfgNodeIndex: number
    cfgEdgeIndex: number
    lastEvent:
        | {
              type: "instruction"
              index: number
              cfgNodeIndex: number
          }
        | {
              type: "destinations-edge"
              destinations: Array<bigint>
              sourceEdgePc: bigint
              cfgNodeIndex: number
          }
        | {
              type: "destinations-fall-through"
              destination: bigint
              nextCfgNodeStart: bigint
              cfgNodeIndex: number
          }
        | null
} {
    let currentStep = 0

    let instructionIndex = 0
    let cfgNodeIndex = 0
    let cfgEdgeIndex = 0
    // Each index change decrements step counter, so it is possible to control the loop progress
    let lastEvent: ReturnType<
        typeof defineInstructionsAndDestinations
    >["lastEvent"] = null

    while (currentStep <= maxStep) {
        const entry = Array.from(cfgNodes.inner)[cfgNodeIndex]
        if (!entry) {
            return {
                cfgNodes,
                cfgEdges,
                instructionIndex,
                cfgNodeIndex,
                cfgEdgeIndex,
                lastEvent,
            }
        }
        const [_cfgNodeStart, cfgNode] = entry
        const cfgNodeEnd =
            cfgNodeIndex + 1 < Array.from(cfgNodes.inner).length
                ? // Next basic block start -1, if there is a next block
                  Array.from(cfgNodes.inner.entries())[cfgNodeIndex + 1][0] - 1n
                : // Or the last instruction in the program, if there is no next cfg node
                  slots.length - 1

        cfgNode.instructions[0] = instructionIndex
        while (instructionIndex < slots.length) {
            if (instructionIndex <= cfgNodeEnd) {
                // Update the end instruction index in our CFG node
                cfgNode.instructions[1] = instructionIndex + 1

                lastEvent = {
                    type: "instruction",
                    index: instructionIndex,
                    cfgNodeIndex,
                }

                currentStep++
                if (currentStep > maxStep) {
                    return {
                        cfgNodes,
                        cfgEdges,
                        instructionIndex,
                        cfgNodeIndex,
                        cfgEdgeIndex,
                        lastEvent,
                    }
                }
                instructionIndex++
            } else {
                break
            }
        }

        // If there is a recorded CFG edge within our calculated CFG node boundaries
        // we copy edge's destinations from the edge to the current CFG node and go
        // to the next CFG node
        const nextCfgEdgeEntry = Array.from(cfgEdges.inner)[cfgEdgeIndex]
        if (nextCfgEdgeEntry && nextCfgEdgeEntry[0] <= cfgNodeEnd) {
            cfgNode.destinations = [...nextCfgEdgeEntry[1].destinations]
            lastEvent = {
                type: "destinations-edge",
                cfgNodeIndex,
                sourceEdgePc: nextCfgEdgeEntry[0],
                destinations: nextCfgEdgeEntry[1].destinations,
            }
            cfgEdgeIndex++
        } else if (cfgNodeIndex + 1 < Array.from(cfgNodes.inner).length) {
            const [nextCfgNodeStart, _nextCfgNode] = Array.from(cfgNodes.inner)[
                cfgNodeIndex + 1
            ]
            // If we couldn't a corresponding edge - we check whether
            // the next cfg node is function or no, and if it's not - we specify
            // the fall through destination to it. We keep CFG Nodes split by functions
            // for non flatten call graph
            if (!functions.map.inner.get(nextCfgNodeStart)) {
                cfgNode.destinations.push(nextCfgNodeStart)
                lastEvent = {
                    type: "destinations-fall-through",
                    destination: nextCfgNodeStart,
                    nextCfgNodeStart,
                    cfgNodeIndex,
                }
            }
        }
        currentStep++
        if (currentStep > maxStep) {
            return {
                cfgNodes,
                cfgEdges,
                instructionIndex,
                cfgNodeIndex,
                cfgEdgeIndex,
                lastEvent,
            }
        }
        lastEvent = null
        cfgNodeIndex++
    }

    return {
        cfgNodes,
        cfgEdges,
        instructionIndex,
        cfgNodeIndex,
        cfgEdgeIndex,
        lastEvent,
    }
}

export function getFilteredCfgNodesWithDestinations({
    slots,
    sbpfVersion,
    functionRegistry,
    maxStep,
}: {
    slots: Array<InsnRaw>
    sbpfVersion: SBPFVersion
    functionRegistry: FunctionRegistry<bigint>
    maxStep?: number
}) {
    const {
        leaders,
        edges: cfgEdges,
        removed,
    } = getFilteredLeadersAndEdges({
        slots,
        functionRegistry,
        sbpfVersion,
    })
    const filteredCfgNodes = SortedMap.new<CfgNode>()
    filteredCfgNodes.inner = new Map(
        [...leaders.inner].filter(
            ([pc, _cfgNode]) =>
                !removed.leaders.some(({ pc: removedPc }) => pc === removedPc),
        ),
    )
    const functions = FunctionRegistry.default<bigint>()
    functions.map.inner = new Map(
        [...functionRegistry.map.inner].filter(
            ([pc, _]) =>
                !removed.functions.some(
                    ({ pc: removedPc }) => pc === removedPc,
                ),
        ),
    )
    const maxPossibleStep = filteredCfgNodes.inner.size + slots.length - 1
    maxStep =
        typeof maxStep === "undefined"
            ? maxPossibleStep
            : maxStep > maxPossibleStep
              ? maxPossibleStep
              : maxStep

    return defineInstructionsAndDestinations({
        maxStep,
        cfgNodes: filteredCfgNodes,
        cfgEdges,
        slots,
        functions,
    })
}

export function groupInstructionsByCfgNodes({
    cfgNodes,
    slots,
}: {
    cfgNodes: SortedMap<CfgNode>
    slots: Array<InsnRaw>
}) {
    const ownershipMap = new Map<number, number>()

    Array.from(cfgNodes.inner).forEach(([_, cfgNode], cfgNodeIndex) => {
        for (
            let i = cfgNode.instructions[0];
            i < cfgNode.instructions[1];
            i++
        ) {
            ownershipMap.set(i, cfgNodeIndex)
        }
    })

    const groups: Array<{
        owner: number | undefined
        startPc: number
        slots: Array<InsnRaw>
    }> = []
    let currentGroup: {
        owner: number | undefined
        startPc: number
        slots: Array<InsnRaw>
    } = {
        owner: 0,
        startPc: 0,
        slots: [],
    }
    let lastOwner: number | undefined = undefined

    slots.forEach((slot, pc) => {
        const owner = ownershipMap.get(pc)

        const wasOwnerChanged = owner !== lastOwner
        if (wasOwnerChanged && currentGroup.slots.length > 0) {
            groups.push(currentGroup)
            currentGroup = {
                owner,
                startPc: pc,
                slots: [],
            }
        }

        currentGroup.slots.push(slot)
        lastOwner = owner
    })

    if (currentGroup.slots.length > 0) {
        groups.push(currentGroup)
    }

    return groups
}
