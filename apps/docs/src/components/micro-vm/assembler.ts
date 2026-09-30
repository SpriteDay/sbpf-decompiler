export function insn_raw(
    opc: number,
    dst: number,
    src: number,
    off: number,
    imm: number,
): Int8Array {
    const bytes = new Int8Array(8)
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

    view.setInt8(0, opc)
    view.setInt8(1, dst | (src << 4))
    view.setInt16(2, off, true)
    view.setInt32(4, imm)

    return bytes
}
