export function insnRaw(
    opc: bigint,
    dst: bigint,
    src: bigint,
    off: bigint,
    imm: bigint,
): Uint8Array {
    const bytes = new Uint8Array(8)
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

    view.setUint8(0, Number(opc))
    view.setUint8(1, Number(dst) | (Number(src) << 4))
    view.setUint16(2, Number(off), true)
    view.setUint32(4, Number(imm), true)

    return bytes
}
