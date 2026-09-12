/** Rust's equivalent of String -> Vec<u8> */
export function stringToU8Array(str: string): Uint8Array {
    return new TextEncoder().encode(str)
}
