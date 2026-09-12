import { Hasher as MurMur3Hasher } from "./murmur3"

export const Hash = {
    hashU8Slice({ data, state }: { data: Uint8Array; state: MurMur3Hasher }) {
        const newLen = 8
        MurMur3Hasher.write(state, { bytes: data.subarray(0, newLen) })
    },
}
