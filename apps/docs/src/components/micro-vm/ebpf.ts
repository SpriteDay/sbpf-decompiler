// Three least significant bits are operation class:
// BPF operation class: 32 bit airthmetic or load.
const BPF_ALU32_LOAD = 0b0000_0_100
// BPF operation class: 64 bit control flow.
const BPF_JMP64 = 0b0000_0_101
// BPF operation class: 64 bit arithmetic or store.
const BPF_ALU64_STORE = 0b0000_0_111

// For load and store instructions:
// +--------+--------+------------+
// | 3 bits | 2 bits |   3 bits   |
// |  mode  |  size  | insn class |
// +--------+--------+------------+
// (MSB)                      (LSB)

// Size modifiers:
// BPF size modifier: 8 bytes.
const BPF_8B = 0b100_10_000

// For arithmetic (BPF_ALU/BPF_ALU64_STORE) and jump (BPF_JUMP64) instructions:
// +----------------+-------+------------+
// |     4 bits     | 1 bit |   3 bits   |
// | operation code |  src  | insn class |
// +----------------+-------+------------+
// (MSB)                            (LSB)

// Source modifiers
// BPF source operand modifier: 32-bit immideate value.
const BPF_K = 0b0000_0_000
// BPF source operand modifier: `src` register.
const BPF_X = 0b0000_1_000

// Operation codes -- BPF_ALU32_LOAD and BPF_ALU64_STORE classes:
// BPF ALU/ALU64 operation code: addition.
const BPF_ADD = 0b0000_0_000
// BPF ALU/ALU64 operation code: subtraction.
const BPF_SUB = 0b0001_0_000
// BPF ALU/ALU64 operation code: move.
const BPF_MOV = 0b1011_0_000

// Operation codes -- BPF_JMP32 and BPF_JMP64 classes:
// BPF JMP operation code: jump.
const BPF_JA = 0b0000_0_000
// BPF JMP operation code: jump if equal.
const BPF_JEQ = 0b0001_0_000
// BPF JMP operation code: jump if greater.
const BPF_JGT = 0b0010_0_000
// BPF JMP operation code: return from program.
const BPF_EXIT = 0b1001_0_000

// Op codes
// (Following operation names are not "official", but may be proper to sbpf;
// Linux kernel only combines above flags and does not attribute a name per operation.)
export const OpCodes = {
    // BPF opcode: `ldxdw dst, [src+off]` | `dst = (src + off) as u64`
    LD_8B_REG: BPF_ALU32_LOAD | BPF_X | BPF_8B,

    // BPF opcode: `mov64 dst, imm` | `dst = imm`
    MOV64_IMM: BPF_ALU64_STORE | BPF_K | BPF_MOV,
    // BPF opcode: `mov64 dst, src` | `dst = src`
    MOV64_REG: BPF_ALU64_STORE | BPF_X | BPF_MOV,

    // BPF opcode: `add64 dst, imm` | `dst += imm`
    ADD64_IMM: BPF_ALU64_STORE | BPF_K | BPF_ADD,
    // BPF opcode: `sub64, dst, imm` | `dst -= imm`
    SUB64_IMM: BPF_ALU64_STORE | BPF_K | BPF_SUB,

    // BPF opcode: `ja +off` | `PC += off`
    JA: BPF_JMP64 | BPF_JA,
    // BPF opcode: `jeq64 dst, imm, +off` | `PC += off if dst == imm`
    JEQ64_IMM: BPF_JMP64 | BPF_K | BPF_JEQ,
    // BPF opcode: `jgt64 dst, imm, +off` | `PC += off if dst > imm`
    JGT64_IMM: BPF_JMP64 | BPF_K | BPF_JGT,
    // BPF opcode: `exit` | `return r0`
    EXIT: BPF_JMP64 | BPF_EXIT,
}
