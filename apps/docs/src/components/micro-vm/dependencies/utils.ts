/** Equivalent of Rust's String -> Vec<u8> */
export function stringToU8Array(str: string): Uint8Array {
    return new TextEncoder().encode(str)
}

export function u8ArrayToString(str: Uint8Array): string {
    return new TextDecoder().decode(str)
}

/** Equivalent of Rust's u32 .rotate_left() */
export function rotateLeftU32({
    value,
    amount,
}: {
    value: number
    amount: number
}): number {
    // Last ">>> 0" converts to unsigned before it gets returned as JS float value
    return ((value << amount) | (value >>> amount)) >>> 0
}

/** Equivalent of Rust's LE::read_u32 over [u8] */
export function readU32LE(array: Uint8Array) {
    const view = new DataView(array.buffer, array.byteOffset, array.byteLength)
    return view.getUint32(0, true)
}

/** Equivalent of Rust's u32 .wrapping_add() */
export function addU32(a: number, b: number) {
    return (a + b) >>> 0
}

export function toU32(value: number) {
    return value >>> 0
}

export function usizeToLeBytes(value: bigint) {
    const buf = new Uint8Array(8)
    new DataView(buf.buffer).setBigUint64(0, value, true)
    return buf
}
