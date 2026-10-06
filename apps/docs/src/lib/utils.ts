import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function capitalize<T extends string>(str: T): Capitalize<T> {
    return (str[0].toUpperCase() + str.slice(1)) as Capitalize<T>
}

export function byteArrayToHex(
    bytes: Uint8Array | Int8Array,
    separator = "",
): string {
    return Array.from(bytes, (b) =>
        (b & 0xff).toString(16).padStart(2, "0"),
    ).join(separator)
}
