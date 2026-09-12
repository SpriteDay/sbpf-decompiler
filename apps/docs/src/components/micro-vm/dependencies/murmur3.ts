import { addU32, readU32LE, rotateLeftU32, toU32 } from "./utils"

/** 32-bit MurmurHash3 hasher */
export interface Hasher {
    buf: Buffer
    index: Index
    processed: number
    state: State
}

interface State {
    0: number
}

type Buffer = {
    bytes: Uint8Array
}

type Index = 0 | 1 | 2 | 3

export const Index = {
    from({ x }: { x: number }): Index {
        switch (x % 4) {
            case 0:
                return 0
            case 1:
                return 1
            case 2:
                return 2
            case 3:
                return 3
            default:
                throw new Error("Unreachable")
        }
    },
}

export const Hasher = {
    push(hasher: Hasher, { buf }: { buf: Uint8Array }): void {
        const start = hasher.index
        const len = buf.length
        for (let i = 0; i < len; i++) {
            hasher.buf.bytes[start + i] = buf[i]
        }
        hasher.index = Index.from({ x: start + len })
    },

    default(): Hasher {
        return {
            buf: { bytes: new Uint8Array(4) },
            index: 0,
            processed: 0,
            state: { 0: 0 },
        }
    },

    finish32(hasher: Hasher): number {
        // tail
        let state: number
        switch (hasher.index) {
            case 3: {
                let block = 0
                block ^= hasher.buf.bytes[2] << 16
                block ^= hasher.buf.bytes[1] << 8
                block ^= hasher.buf.bytes[0]
                state = hasher.state[0] ^ preMix(block)
                break
            }
            case 2: {
                let block = 0
                block ^= hasher.buf.bytes[1] << 8
                block ^= hasher.buf.bytes[0]
                state = hasher.state[0] ^ preMix(block)
                break
            }
            case 1: {
                let block = 0
                block ^= hasher.buf.bytes[0]
                state = hasher.state[0] ^ preMix(block)
                break
            }
            case 0: {
                state = hasher.state[0]
                break
            }
            default: {
                throw new Error("Unreachable")
            }
        }

        // finalization mix
        state ^= hasher.processed
        state ^= state >>> 16
        state = Math.imul(state, 0x85ebca6b)
        state ^= state >>> 13
        state = Math.imul(state, 0xc2b2ae35)
        state ^= state >>> 16

        return state
    },

    write(hasher: Hasher, { bytes }: { bytes: Uint8Array }) {
        const len = bytes.length
        hasher.processed = toU32(hasher.processed + len)

        let resultBody: Uint8Array
        if (hasher.index === 0) {
            resultBody = bytes
        } else {
            const index = hasher.index
            if (len + index >= 4) {
                // we can complete a block using the data left in the buffer
                const mid = 4 - index
                const head = bytes.slice(0, mid)
                const body = bytes.slice(mid, len)

                for (let i = 0; i < 4 - index; i++) {
                    hasher.buf.bytes[index + i] = head[i]
                }

                hasher.index = 0

                State.processBlock(hasher.state, { block: hasher.buf.bytes })

                resultBody = body
            } else {
                resultBody = bytes
            }
        }

        for (let i = 0; i < resultBody.length; i += 4) {
            const block = resultBody.subarray(i, i + 4)
            if (block.length === 4) {
                State.processBlock(hasher.state, { block })
            } else {
                Hasher.push(hasher, { buf: block })
            }
        }
    },
}

const C1 = 0xcc9e2d51
const C2 = 0x1b873593
const R1 = 15

export const State = {
    processBlock(state: State, { block }: { block: Uint8Array | undefined }) {
        state[0] = preMix(readU32LE(block!))
        state[0] = rotateLeftU32({ value: state[0], amount: 13 })
        state[0] = addU32(Math.imul(5, state[0]), 0xe6546b64)
    },
}

function preMix(block: number): number {
    let resultBlock = Math.imul(block, C1)
    resultBlock = rotateLeftU32({ value: resultBlock, amount: R1 })
    resultBlock = Math.imul(resultBlock, C2)
    return resultBlock
}
