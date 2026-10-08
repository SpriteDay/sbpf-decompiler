export const Ordering = {
    Less: -1,
    Equal: 0,
    Greater: 1,
} as const

export type Ordering = (typeof Ordering)[keyof typeof Ordering]

/** Replacement of Rust's BTreeMap */
export class SortedMap<K, V> {
    private inner = new Map<string, [K, V]>()

    get size() {
        return this.inner.size
    }

    public sort() {
        const entries = [...this.inner].sort(([_ka, [a]], [_kb, [b]]) => {
            if (
                ["number", "bigint"].includes(typeof a) &&
                ["number", "bigint"].includes(typeof b)
            ) {
                return Number(
                    BigInt(a as number | bigint) - BigInt(b as number | bigint),
                )
            }
            return 0
        })
        this.inner = new Map([...entries])
    }

    public get(key: K): V | undefined {
        return this.inner.get(unknownToString(key))?.[1]
    }

    public has(key: K): boolean {
        return this.inner.has(unknownToString(key))
    }

    public insert(key: K, value: V) {
        const innerKey = unknownToString(key)
        this.inner.set(innerKey, [key, value])
        this.sort()
        return true
    }

    *[Symbol.iterator](): Generator<[K, V]> {
        for (const [_, entry] of [...this.inner]) {
            yield entry
        }
    }

    public forEach(
        fn: (entry: [K, V], index: number, sortedMap: this) => unknown,
    ) {
        let index = 0
        for (const [_, [key, value]] of [...this.inner]) {
            fn([key, value], index, this)
            index++
        }
    }

    public entries() {
        return this.inner.values()
    }

    public keys() {
        return [...this.inner].map(([_, [key, _val]]) => key)
    }

    /** Removes all of the elements from the inner map */
    public clear() {
        this.inner = new Map()
    }

    static from<K, V>(map: Map<K, V>): SortedMap<K, V> {
        const sortedMap = new SortedMap<K, V>()
        for (const [key, val] of map) {
            sortedMap.insert(key, val)
        }
        return sortedMap
    }

    /** Replaces inner map with a passed one */
    public replace(map: Map<K, V>) {
        this.clear()
        for (const [key, val] of map) {
            this.insert(key, val)
        }
    }
}

/** Replacement of Rust's BTreeSet */
export class SortedSet<V> {
    private inner = new Map<string, V>()

    get size() {
        return this.inner.size
    }

    public sort() {
        const entries = [...this.inner].sort(([_ka, a], [_kb, b]) => {
            if (
                ["number", "bigint"].includes(typeof a) &&
                ["number", "bigint"].includes(typeof b)
            ) {
                return Number(
                    BigInt(a as number | bigint) - BigInt(b as number | bigint),
                )
            }
            return 0
        })
        this.inner = new Map([...entries])
    }

    public insert(value: V) {
        const newEntry = !this.inner.has(unknownToString(value))
        const innerKey = unknownToString(value)
        this.inner.set(innerKey, value)
        this.sort()
        return newEntry
    }

    *[Symbol.iterator](): Generator<V> {
        for (const [_, entry] of [...this.inner]) {
            yield entry
        }
    }

    public forEach(fn: (entry: V, index: number, sortedSet: this) => unknown) {
        let index = 0
        for (const [_, value] of [...this.inner]) {
            fn(value, index, this)
            index++
        }
    }

    public entries() {
        return this.inner.values()
    }

    /** Removes all of the elements from the inner map */
    public clear() {
        this.inner = new Map()
    }
}

export const unknownToString = (obj: unknown): string => {
    if (["string", "number", "symbol", "boolean"].includes(typeof obj)) {
        return String(obj)
    } else if (typeof obj === "bigint") {
        return obj.toString()
    } else if (typeof obj === "object") {
        return JSON.stringify(
            obj,
            (_key, val) => (typeof val === "bigint" ? Number(val) : val),
            2,
        )
    } else {
        return String(obj)
    }
}
