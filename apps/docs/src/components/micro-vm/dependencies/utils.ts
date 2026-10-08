/** Equivalent of Rust's String -> Vec<u8> */
export function stringToU8Array(str: string): Uint8Array {
    return new TextEncoder().encode(str)
}

export function u8ArrayToString(str: Uint8Array): string {
    return new TextDecoder().decode(str)
}

/** Equivalent of Rust's u32 .rotate_left() */
export function rotateLeftU32({
    value,
    amount,
}: {
    value: number
    amount: number
}): number {
    // Last ">>> 0" converts to unsigned before it gets returned as JS float value
    return ((value << amount) | (value >>> (32 - amount))) >>> 0
}

/** Equivalent of Rust's LE::read_u32 over [u8] */
export function readU32LE(array: Uint8Array) {
    const view = new DataView(array.buffer, array.byteOffset, array.byteLength)
    return view.getUint32(0, true)
}

/** Equivalent of Rust's u32 .wrapping_add() */
export function addU32(a: number, b: number) {
    return (a + b) >>> 0
}

export function toU32(value: number) {
    return value >>> 0
}

export function usizeToLeBytes(value: bigint) {
    const buf = new Uint8Array(8)
    new DataView(buf.buffer).setBigUint64(0, value, true)
    return buf
}

export const Ordering = {
    Less: -1,
    Equal: 0,
    Greater: 1,
} as const

export type Ordering = (typeof Ordering)[keyof typeof Ordering]

export const unknownToString = (obj: unknown): string => {
    if (typeof obj === "string") {
        return obj
    } else if (typeof obj === "object") {
        try {
            return JSON.stringify(obj, null, 2)
        } catch {
            return String(obj)
        }
    } else {
        return String(obj)
    }
}

/** Replacement of Rust's BTreeMap */
export interface SortedMap<V> {
    inner: Map<bigint, V>
}

export const SortedMap = {
    new<V>(): SortedMap<V> {
        return { inner: new Map<bigint, V>() }
    },
    sort<V>(self: SortedMap<V>) {
        const entries = [...self.inner].sort(([a], [b]) => Number(a - b))
        self.inner.clear()
        for (const [key, value] of entries) {
            self.inner.set(key, value)
        }
        return self.inner
    },
    insert<V>(self: SortedMap<V>, { key, value }: { key: bigint; value: V }) {
        self.inner.set(key, value)
        SortedMap.sort(self)
    },
}

/** Replacement of Rust's BTreeSet */
export interface SortedSet<V> {
    inner: Map<string, V>
    orderMap: Map<string, number>
}
export const SortedSet = {
    new<V>(): SortedSet<V> {
        return {
            inner: new Map<string, V>(),
            orderMap: new Map<string, number>(),
        }
    },
    sort<V>(self: SortedSet<V>) {
        const entries = [...self.inner].sort(
            ([a], [b]) => self.orderMap.get(a)! - self.orderMap.get(b)!,
        )
        self.inner.clear()
        for (const [key, value] of entries) {
            self.inner.set(key, value)
        }
        return self.inner
    },
    /** Returns true if element is inserted, false if an element was already in the set */
    insert<V>(self: SortedSet<V>, { value }: { value: V }): boolean {
        const newKey = unknownToString(value)
        let biggestExistingIndex = 0
        for (const [key, orderIndex] of [...self.orderMap]) {
            if (newKey === key) {
                return false
            }
            biggestExistingIndex = Math.max(biggestExistingIndex, orderIndex)
        }
        self.inner.set(newKey, value)
        self.orderMap.set(newKey, biggestExistingIndex + 1)
        SortedSet.sort(self)
        return true
    },
}
