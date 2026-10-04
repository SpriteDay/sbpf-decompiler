import {
    SortedMap,
    u8ArrayToString,
} from "@/components/micro-vm/dependencies/utils"
import { InsnRaw, OpCodes } from "@/components/micro-vm/ebpf"
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
