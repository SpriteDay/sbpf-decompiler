import {
    Insn,
    MM_HEAP_START,
    MM_INPUT_START,
    MM_RODATA_START,
    MM_STACK_START,
    SCRATCH_REGS,
} from "./ebpf"
import { Executable } from "./elf"
import { HostBuffer, MemoryMapping, MemoryRegion } from "./memory-mapping"
import { BuiltinProgram } from "./program"
import { CallFrame, Config, ContextObject, EbpfVm } from "./vm"

export function runV3InstructionsWithTracing({
    instructions,
}: {
    instructions: Array<Insn>
}) {
    const mem = new Uint8Array()

    const executable: Executable = {
        instructions,
        sbpfVersion: "V3",
    }
    const rodata = new Uint8Array()
    const config = Config.default()
    config.enableRegisterTracing = true
    const loader = BuiltinProgram.new({ config })
    const sbpfVersion = executable.sbpfVersion

    const stack = new Uint8Array(
        loader.config.maxCallDepth * Number(loader.config.stackFrameSize),
    ).fill(0)
    const heap = new Uint8Array()

    const regions: Array<MemoryRegion> = [
        MemoryRegion.new({
            host: HostBuffer.new({ value: rodata, kind: "Immutable" }),
            vmAddr: MM_RODATA_START,
        }),
        MemoryRegion.new({
            host: HostBuffer.new({ value: stack, kind: "Mutable" }),
            vmAddr: MM_STACK_START,
        }),
        MemoryRegion.new({
            host: HostBuffer.new({ value: heap, kind: "Mutable" }),
            vmAddr: MM_HEAP_START,
        }),
        MemoryRegion.new({
            host: HostBuffer.new({ value: mem, kind: "Mutable" }),
            vmAddr: MM_INPUT_START,
        }),
    ]

    const contextObject: ContextObject = {
        activeMapping: MemoryMapping.new({
            config: loader.config,
            regions,
            sbpfVersion,
        }),
    }

    const vm = EbpfVm.new({ loader, contextObject })

    const callFrames = new Array<CallFrame>(loader.config.maxCallDepth)
    callFrames.map(() => {
        const defaultCallFrame: CallFrame = {
            callerSavedRegisters: new BigUint64Array(SCRATCH_REGS).fill(0n),
            framePointer: 0n,
            targetPc: 0n,
        }
        return defaultCallFrame
    })
    const programResult = EbpfVm.executeProgram(vm, { executable, callFrames })
    return { programResult, registerTrace: vm.registerTrace }
}
