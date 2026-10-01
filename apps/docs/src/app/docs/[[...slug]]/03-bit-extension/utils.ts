export function bitsArrayToNumber(
    bits: Array<boolean>,
    signed: boolean,
): number {
    return bits.reduce((acc, bit, index) => {
        if (!bit) {
            return acc
        }
        let positionValue: number
        if (signed && index === bits.length - 1) {
            positionValue = Math.pow(2, index) * -1
        } else {
            positionValue = Math.pow(2, index)
        }
        return acc + positionValue
    }, 0)
}

export function numberToHex(num: number, extended: boolean): string {
    const negative = num < 0
    const abs = Math.abs(num)
    return `${negative ? "-" : ""}0x${abs
        .toString(16)
        .padStart(extended ? 4 : 2, "0")
        .toUpperCase()}`
}
