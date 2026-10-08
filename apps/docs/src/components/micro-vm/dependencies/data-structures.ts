export const Ordering = {
    Less: -1,
    Equal: 0,
    Greater: 1,
} as const

export type Ordering = (typeof Ordering)[keyof typeof Ordering]

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
export interface SortedSet<V> {
    inner: Map<string, V>
}
export const SortedSet = {
    new<V>(): SortedSet<V> {
        return {
            inner: new Map<string, V>(),
        }
    },
    sort<V>(self: SortedSet<V>) {
        const entries = [...self.inner]
        self.inner.clear()
        for (const [key, value] of entries) {
            self.inner.set(key, value)
        }
        return self.inner
    },
    /** Returns true if element is inserted, false if an element was already in the set */
    insert<V>(self: SortedSet<V>, { value }: { value: V }): boolean {
        const newKey = unknownToString(value)
        if (self.inner.has(newKey)) {
            return false
        }
        self.inner.set(newKey, value)
        SortedSet.sort(self)
        return true
    },
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
