/** Equivalent of Rust's String -> Vec<u8> */
export function stringToU8Array(str: string): Uint8Array {
    return new TextEncoder().encode(str)
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
