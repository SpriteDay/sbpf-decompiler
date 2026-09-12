/** 32-bit MurmurHash3 hasher */
export interface Hasher {
    buf: Buffer
    index: Index
    processed: number
    state: State
}

type State = number

type Buffer = {
    bytes: Uint8Array | undefined
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
    push(hasher: Hasher, { buf }: { buf: Uint8Array }) {
        const start = hasher.index
        const len = buf.length
        for (let i = 0; i < len; i++) {
            hasher.buf.bytes![start + i] = buf[i]
        }
        hasher.index = Index.from({ x: start + len })
    },
}
