import { AccessType } from "./memory-mapping"

export class AccessViolation extends Error {
    constructor({
        accessType,
        vmAddr,
        len,
        regionName,
    }: {
        accessType: AccessType
        vmAddr: bigint
        len: bigint
        regionName: string
    }) {
        super(
            `Access violation ${len} ${accessType} bytes at address 0x${vmAddr.toString(16)} (in ${regionName} region)`,
        )
        this.name = "AccessViolation"
    }
}

export class ExecutionOverrun extends Error {
    constructor() {
        super(
            "attempted to execute past the end of the text segment at BPF instruction",
        )
        this.name = "ExecutionOverrun"
    }
}
