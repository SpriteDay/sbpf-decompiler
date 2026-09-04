// Three least significant bits are operation class:
// BPF operation class: 64 bit arithmetic or store.
const BPF_ALU_64_STORE = 0x07

// For arithmetic (BPF_ALU/BPF_ALU64_STORE) and jump (BPF_JUMP64) instructions:
// +----------------+-------+------------+
// |     4 bits     | 1 bit | 3 bits     |
// | operation code | src   | insn class |
// +----------------+-------+------------+
// (MSB)                            (LSB)

// Source modifiers
// BPF source operand modifier: 32-bit immideate value.
const BPF_K = 0x00
// BPF source operand modifier: `src` register.
const BPF_X = 0x08

// BPF ALU/ALU64 operation code: move.
const BPF_MOV = 0xb0

export const OpCodes = {
    // BPF opcode: `mov64 dst, imm` | `dst = imm`
    MOV64_IMM: BPF_ALU_64_STORE + BPF_K + BPF_MOV,
    // BPF opcode: `mov64 dst, src` | `dst = src`
    MOV64_REG: BPF_ALU_64_STORE + BPF_X + BPF_MOV,
}
