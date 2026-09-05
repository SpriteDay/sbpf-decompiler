import { VIRTUAL_ADDRESS_BITS } from "./ebpf"
import { AccessViolation } from "./error"
import { SBPFVersion } from "./program"
import { Config } from "./vm"

export type AccessType = "Load" | "Store"

/** Either mutable or immutable slice, returned by MemoryRegion.hostBuffer */
export type HostBuffer = {
    value: Uint8Array
    kind: "Mutable" | "Immutable"
    dataView: DataView
}

export const HostBuffer = {
    new({
        value,
        kind,
    }: {
        value: Uint8Array
        kind: HostBuffer["kind"]
    }): HostBuffer {
        return {
            value,
            kind,
            dataView: new DataView(
                value.buffer,
                value.byteOffset,
                value.byteLength,
            ),
        }
    },
    get(hostBuffer: HostBuffer, { range }: { range: [bigint, bigint] }) {
        if (range[1] > hostBuffer.value.length) {
            return null
        }
        const newLen = range[1] - range[0]
        return { dataView: hostBuffer.dataView, off: newLen }
    },
}

/** Memory region for bounds checking and address translation */
export interface MemoryRegion {
    host: HostBuffer
    /** start virtual address */
    vmAddr: bigint
}

export const MemoryRegion = {
    vmToHostBuffer(
        memoryRegion: MemoryRegion,
        { vmAddr, len }: { vmAddr: bigint; len: bigint },
    ) {
        if (vmAddr < memoryRegion.vmAddr) {
            return null
        }

        const beginOffset = vmAddr - memoryRegion.vmAddr
        // We ignore gaps implementation
        const endOffset = beginOffset + len
        return HostBuffer.get(memoryRegion.host, {
            range: [beginOffset, endOffset],
        })
    },
}

export interface MemoryMapping {
    sbpfVersion: SBPFVersion
    regions: Array<MemoryRegion>
    stackFrameSize: bigint
    // Typescript specific workaround
    views: Map<MemoryRegion, DataView>
}

export const MemoryMapping = {
    /**
     * Creates a new memory mapping.
     */
    newUnitialized({
        regions,
        config,
        sbpfVersion,
    }: {
        regions: Array<MemoryRegion>
        config: Config
        sbpfVersion: SBPFVersion
    }): MemoryMapping {
        return {
            stackFrameSize: config.stackFrameSize,
            regions,
            sbpfVersion,
            views: new Map<MemoryRegion, DataView>(),
        }
    },

    /** Map virtual memory to host memory. */
    map(
        memoryMapping: MemoryMapping,
        {
            accessType,
            vmAddr,
            len,
        }: { accessType: AccessType; vmAddr: bigint; len: bigint },
    ) {
        const searchResult = MemoryMapping.findRegion(memoryMapping, { vmAddr })
        if (searchResult) {
            const { region } = searchResult
            if (region.host.kind === "Mutable" || accessType !== "Store") {
            }
        } else {
            throw MemoryMapping.generateAccessViolation(memoryMapping, {
                accessType,
                vmAddr,
                len,
            })
        }
    },

    /** Loads specified size of bytes at the given guest address. */
    load(
        memoryMapping: MemoryMapping,
        { vmAddr, size }: { vmAddr: bigint; size: 1 | 2 | 4 | 8 },
    ) {},

    /** Returns the `MemoryRegion` which contains the given address. */
    findRegion(
        memoryMapping: MemoryMapping,
        { vmAddr }: { vmAddr: bigint },
    ): { index: bigint; region: MemoryRegion } | null {
        const index = vmAddr >> VIRTUAL_ADDRESS_BITS
        if (index < memoryMapping.regions.length) {
            const region = memoryMapping.regions[Number(index)]
            return { index, region }
        }
        return null
    },

    generateAccessViolation(
        memoryMapping: MemoryMapping,
        {
            accessType,
            vmAddr,
            len,
        }: { accessType: AccessType; vmAddr: bigint; len: bigint },
    ) {
        const searchResult = MemoryMapping.findRegion(memoryMapping, { vmAddr })
        let regionName = "unallocated"
        if (searchResult) {
            const { index } = searchResult
            switch (index) {
                case 1n: {
                    regionName = "program"
                    break
                }
                case 2n: {
                    regionName = "stack"
                    break
                }
                case 3n: {
                    regionName = "heap"
                    break
                }
                case 4n: {
                    regionName = "input"
                    break
                }
                default: {
                    regionName = "allocated"
                }
            }
        }
        return new AccessViolation({ accessType, vmAddr, len, regionName })
    },
}
