export const Ordering = {
    Less: -1,
    Equal: 0,
    Greater: 1,
} as const

export type Ordering = (typeof Ordering)[keyof typeof Ordering]

export class SortedMap<K, V> {
    private inner = new Map<K, V>()
    private orderMap = new Map<K, number>()

    public size: number = 0

    public sort() {
        const entries = [...this.inner].sort(
            ([a], [b]) => this.orderMap.get(a)! - this.orderMap.get(b)!,
        )
        this.inner = new Map([...entries])
    }

    public get(key: K): V | undefined {
        return this.inner.get(key)
    }

    public has(key: K): boolean {
        return this.inner.has(key)
    }

    public insert(key: K, value: V) {
        const newKey = unknownToString(key)
        let biggestExistingIndex = 0
        for (const [key, orderIndex] of [...this.orderMap]) {
            if (newKey === key) {
                return false
            }
            biggestExistingIndex = Math.max(biggestExistingIndex, orderIndex)
        }
        this.inner.set(key, value)
        this.orderMap.set(key, biggestExistingIndex + 1)
        this.sort()
        this.size++
        return true
    }

    *[Symbol.iterator](): Generator<[K, V]> {
        for (const entry of [...this.inner]) {
            yield entry
        }
    }

    public forEach(
        fn: (entry: [K, V], index: number, map: Map<K, V>) => unknown,
    ) {
        let index = 0
        for (const [key, value] of [...this.inner]) {
            fn([key, value], index, this.inner)
            index++
        }
    }

    public entries() {
        return this.inner.entries()
    }

    public keys() {
        return this.inner.keys()
    }

    /** Removes all of the elements from the inner map */
    public clear() {
        this.inner = new Map()
        this.orderMap = new Map()
        this.size = 0
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
