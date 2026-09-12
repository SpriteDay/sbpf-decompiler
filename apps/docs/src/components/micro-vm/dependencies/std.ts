/** Rust's equivalent of String -> Vec<u8> */
export function stringToU8Array(str: string): Uint8Array {
    return new TextEncoder().encode(str)
}

/** Rust's equivalent of u32 .rotate_left() */
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
