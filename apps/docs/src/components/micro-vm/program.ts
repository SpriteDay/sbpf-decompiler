import { stringToU8Array, toU32, usizeToLeBytes } from "./dependencies/utils"
import { hashSymbolName } from "./ebpf"
import { Config, EncryptedHostAddressToEbpfVm } from "./vm"

/**
 * Defines a set of sbpfVersion of a program
 */
export const SBPFVersion = {
    // The legacy format
    "V0": 0,
    // SIMD-0166
    "V1": 1,
    // SIMD-0174, SIMD-0173
    "V2": 2,
    // SIMD-0178, SIMD-0189, SIMD-0377
    "V3": 3,
    // SIMD-0177
    "V4": 4,
    // Used for future versions
    "Reserved": 5,
}

export type SBPFVersion = keyof typeof SBPFVersion

export const SBPFFeatures = {
    /**
     * Enable SIMD-0166: SBPF dynamic stack frames
     *
     * Allows usage of `add64 r10, imm`.
     */
    manualStackFrameBump(sbpfVersion: SBPFVersion) {
        return sbpfVersion === "V1" || sbpfVersion === "V2"
    },
    /** ... SIMD-0166 */
    stackFrameGaps(sbpfVersion: SBPFVersion) {
        return sbpfVersion === "V0"
    },

    /** Enable SIMD-0174: SBPF arithmetics improvements */
    enablePqr(sbpfVersion: SBPFVersion) {
        return sbpfVersion === "V2"
    },
    /** SIMD-0174 */
    explicitSignExtensionOfResults(sbpfVersion: SBPFVersion) {
        return sbpfVersion === "V2"
    },
    /** SIMD-0174 */
    swapSubRegImmOperands(sbpfVersion: SBPFVersion) {
        return sbpfVersion === "V2"
    },
    /** SIMD-0174 */
    disableNeg(sbpfVersion: SBPFVersion) {
        return sbpfVersion === "V2"
    },

    /** Enable SIMD-0173: SBPF instruction encoding improvements */
    callxUsesSrcReg(sbpfVersion: SBPFVersion) {
        return sbpfVersion === "V2"
    },
    /** ... SIMD-0173 */
    disableLddw(sbpfVersion: SBPFVersion) {
        return sbpfVersion === "V2"
    },
    /** ... SIMD-0173 */
    disableLe(sbpfVersion: SBPFVersion) {
        return sbpfVersion === "V2"
    },
    /** ... SIMD-0173 */
    moveMemoryInstructionClasses(sbpfVersion: SBPFVersion) {
        return sbpfVersion === "V2"
    },

    /** Enable SIMD-0178: SBPF Static Syscalls */
    staticSyscalls(sbpfVersion: SBPFVersion) {
        return SBPFVersion[sbpfVersion] >= 3
    },
    /** Enable SIMD-0189: SBPF stricter ELF headers */
    enableStricterElfHeaders(sbpfVersion: SBPFVersion) {
        return SBPFVersion[sbpfVersion] >= 3
    },
    /** ... SIMD-0189 */
    enableLowerRodataVaddr(sbpfVersion: SBPFVersion) {
        return SBPFVersion[sbpfVersion] >= 3
    },
    /** ... SIMD-0377*/
    enableJump32(sbpfVersion: SBPFVersion) {
        return SBPFVersion[sbpfVersion] >= 3
    },
    /** ... SIMD-0377 */
    callxUsesDstReg(sbpfVersion: SBPFVersion) {
        return SBPFVersion[sbpfVersion] >= 3
    },
}

/** Holds the function symbols of an Executable */
export interface FunctionRegistry<T> {
    map: Map<number, [Uint8Array, T]>
}

export const FunctionRegistry = {
    default<T>(): FunctionRegistry<T> {
        return {
            map: new Map<number, [Uint8Array, T]>(),
        }
    },

    /** Register a symbol with an explicit key */
    registerFunction<T>(
        functionRegistry: FunctionRegistry<T>,
        { key, name, value }: { key: number; name: string; value: T },
    ) {
        const existingValue = functionRegistry.map.get(key)
        if (!existingValue) {
            functionRegistry.map.set(key, [stringToU8Array(name), value])
        } else {
        }
    },

    /** Used for transitioning from SBPFv0 to SBPFv3 */
    registerFunctionHashedLegacy<T>(
        functionRegistry: FunctionRegistry<T>,
        {
            loader,
            hashSymbolName: hashSymbolNameFlag,
            name,
            value,
        }: {
            loader: BuiltinProgram
            hashSymbolName: boolean
            name: string
            value: T
        },
    ): number {
        const config = loader.config
        let key: number
        if (hashSymbolNameFlag) {
            const hash =
                name === "entrypoint"
                    ? hashSymbolName(stringToU8Array("entrypoint"))
                    : hashSymbolName(usizeToLeBytes(BigInt(Number(value))))
            if (BuiltinProgram.getFunctionRegistry(loader).map.get(hash)) {
                throw new Error("SymbolHashCollision")
            }
            key = hash
        } else {
            key = toU32(Number(value))
        }
        FunctionRegistry.registerFunction(functionRegistry, {
            key,
            name:
                config.enableSymbolAndSectionLabels || name === "entrypoint"
                    ? name
                    : "",
            value,
        })
        return key
    },
}

export type BuiltinFunction = (
    vm: EncryptedHostAddressToEbpfVm,
    a: bigint,
    b: bigint,
    c: bigint,
    d: bigint,
    e: bigint,
) => void

/** Represents the interface to a fixed functionality program */
export interface BuiltinProgram {
    config: Config
    sparseRegistry: FunctionRegistry<[BuiltinFunction, BuiltinFunction]>
}

export const BuiltinProgram = {
    new({ config }: { config: Config }): BuiltinProgram {
        return {
            config,
            sparseRegistry: FunctionRegistry.default(),
        }
    },

    /** Get the function registry depending on the SBPF version */
    getFunctionRegistry(loader: BuiltinProgram) {
        return loader.sparseRegistry
    },
}
