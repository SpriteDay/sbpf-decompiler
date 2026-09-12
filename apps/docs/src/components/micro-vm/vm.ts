import { FRAME_PTR_REG, MM_STACK_START } from "./ebpf"
import { Executable } from "./elf"
import { Interpreter } from "./interpreter"
import { MemoryMapping } from "./memory-mapping"
import { BuiltinProgram } from "./program"

export const defaults = {
    DEFAULT_STACK_FRAME_SIZE: 4_096n,
    getStackFrameSize(): bigint {
        return defaults.DEFAULT_STACK_FRAME_SIZE
    },
}

/** VM configuration settings */
export interface Config {
    /** Maximum call depth */
    maxCallDepth: number
    /** Size of a stack frame in bytes, must match the size specified in the LLVM BPF backend */
    stackFrameSize: bigint
    /** Enable instruction tracing */
    enableRegisterTracing: boolean
    /** Enable dynamic string allocation for labels */
    enableSymbolAndSectionLabels: boolean
}

export const Config = {
    default(): Config {
        return {
            maxCallDepth: 64,
            stackFrameSize: defaults.getStackFrameSize(),
            enableRegisterTracing: false,
            enableSymbolAndSectionLabels: false,
        }
    },
}

/** Runtime context */
export interface ContextObject {
    activeMapping: MemoryMapping
}

/** Statistics of token branches (from a record trace) */
export interface DynamicAnalysis {
    edgeCounterMax: number
    edges: Record<number, Record<number, number>>
}

export const DynamicAnalysis = {
    /** Accumulates a trace */
    new({
        registerTrace,
    }: {
        registerTrace: Array<BigInt64Array>
    }): DynamicAnalysis {
        const result: DynamicAnalysis = {
            edgeCounterMax: 0,
            edges: {},
        }
        return result
    },
}

/** A call frame used for function calls inside the Interpreter */
export interface CallFrame {
    /** The caller saved registers */
    callerSavedRegisters: BigUint64Array
    /** The callers frame pointer */
    framePointer: bigint
    /** The targetPc of the exit instrction which returns back to the caller */
    targetPc: bigint
}

/**
 * A virtual machine to run eBPF programs.
 */
export interface EbpfVm {
    /**
     * The current call depth.
     *
     * Incremented on calls and discriminated on exits. It's used to enforce
     * config.maxCallDepth and to know when to terminate execution.
     */
    callDepth: number
    /** Registers inlined */
    registers: BigUint64Array
    /** Program result inlined */
    programResult: bigint
    /** MemoryMapping inlined */
    memoryMapping: MemoryMapping
    /** Loader built-in program */
    loader: BuiltinProgram
    /** Collector for the instrcution trace */
    registerTrace: Array<BigUint64Array>
}

export const EbpfVm = {
    /** Creates a new virtual machine instance */
    new({
        loader,
        contextObject,
    }: {
        loader: BuiltinProgram
        contextObject: ContextObject
    }): EbpfVm {
        const registers = new BigUint64Array(12).fill(0n)
        registers[FRAME_PTR_REG] = BigInt.asUintN(
            64,
            MM_STACK_START + loader.config.stackFrameSize,
        )
        return {
            callDepth: 0,
            registers,
            programResult: 0n,
            memoryMapping: contextObject.activeMapping,
            loader,
            registerTrace: [],
        }
    },

    /**
     * Execute the program
     */
    executeProgram(
        vm: EbpfVm,
        {
            executable,
            callFrames,
        }: { executable: Executable; callFrames: Array<CallFrame> },
    ): number {
        const program_result = 0
        const interpreter = Interpreter.new({
            vm,
            executable,
            callFrames,
            registers: vm.registers,
        })
        runInterpreter(interpreter)
        return program_result
    },
}

function runInterpreter(interpreter: Interpreter) {
    while (Interpreter.step(interpreter)) {}
}

/** Encrypted address to the `EbpfVM` object. */
export interface EncryptedHostAddressToEbpfVm {
    0: bigint
    1: ContextObject
}
