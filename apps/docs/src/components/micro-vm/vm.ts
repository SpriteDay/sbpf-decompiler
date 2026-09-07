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
    stackFrameSize: bigint
}

export const Config = {
    default(): Config {
        return {
            stackFrameSize: defaults.getStackFrameSize(),
        }
    },
}

/** Runtime context */
export interface ContextObject {
    activeMapping: MemoryMapping
}

/**
 * A virtual machine to run eBPF programs.
 */
export interface EbpfVm {
    /** Registers inlined */
    registers: BigUint64Array
    /** MemoryMapping inlined */
    memoryMapping: MemoryMapping
    /** Loader built-in program */
    loader: BuiltinProgram
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
            registers,
            memoryMapping: contextObject.activeMapping,
            loader,
        }
    },

    /**
     * Execute the program
     */
    executeProgram(
        vm: EbpfVm,
        { executable }: { executable: Executable },
    ): number {
        const program_result = 0
        const interpreter = Interpreter.new({
            vm,
            executable,
            registers: vm.registers,
        })
        runInterpreter(interpreter)
        return program_result
    },
}

function runInterpreter(interpreter: Interpreter) {
    while (Interpreter.step(interpreter)) {}
}
