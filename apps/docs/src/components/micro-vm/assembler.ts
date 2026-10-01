export function insnRaw(
    opc: bigint,
    dst: bigint,
    src: bigint,
    off: bigint,
    imm: bigint,
): Int8Array {
    const bytes = new Int8Array(8)
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

    view.setInt8(0, Number(opc))
    view.setInt8(1, Number(dst) | (Number(src) << 4))
    view.setInt16(2, Number(off), true)
    view.setInt32(4, Number(imm), true)

    return bytes
}
