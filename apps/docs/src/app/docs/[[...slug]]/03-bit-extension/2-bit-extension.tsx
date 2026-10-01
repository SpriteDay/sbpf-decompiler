"use client"

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { useState } from "react"

export function BitExtension() {
    const [lsbBitsState, setLsbBitsState] = useState<Array<boolean>>(
        new Array(8).fill(false),
    )
    const [msbBitsState, setMsbBitsState] = useState<Array<boolean>>(
        new Array(8).fill(false),
    )
    const [signed, setSigned] = useState<boolean>(false)
    const [extended, setExtended] = useState<boolean>(false)
    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    Example of how values change on extension depending on
                    representation
                </CardTitle>
                <CardDescription>
                    Use the knobs to turn on and off bits
                </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center py-2">
                <div className="flex justify-center flex-row-reverse items-center  px-2 py-2">
                    {[...lsbBitsState, ...msbBitsState].map((value, index) => {
                        const lsb = index + 1 <= msbBitsState.length
                        const active =
                            lsb ||
                            (extended && index + 1 >= lsbBitsState.length)
                        return (
                            <div
                                className={cn(
                                    "flex flex-col gap-2 items-center justify-center",
                                    (index + 1) % 4 === 0 && "ml-6",
                                    !active && "opacity-50",
                                )}
                                key={index}
                            >
                                <span className="text-lg">{Number(value)}</span>
                                <Switch
                                    className="rotate-270"
                                    disabled={!active}
                                    checked={value}
                                    onCheckedChange={(checked) => {
                                        if (index + 1 <= lsbBitsState.length) {
                                            setLsbBitsState((prev) => {
                                                const newState = [...prev]
                                                newState[index] = checked
                                                return newState
                                            })
                                        } else {
                                            setMsbBitsState((prev) => {
                                                const newState = [...prev]
                                                newState[
                                                    index - lsbBitsState.length
                                                ] = checked
                                                return newState
                                            })
                                        }
                                    }}
                                />
                            </div>
                        )
                    })}
                </div>
            </CardContent>
            <CardFooter className="flex-col items-start gap-4 text-sm">
                <div className="flex w-full flex-col items-center gap-4 ">
                    <Label className="text-base">
                        Value:{" "}
                        <span className="font-semibold tabular-nums">
                            {numberToHex(
                                bitsArrayToNumber(
                                    [
                                        ...lsbBitsState,
                                        ...(extended ? msbBitsState : []),
                                    ],
                                    signed,
                                ),
                                extended,
                            )}
                        </span>
                    </Label>
                    <div className="flex flex-row w-full px-2 justify-around items-center">
                        <div className="flex flex-col gap-2 items-center">
                            <span className="text-lg">Sign</span>
                            <ToggleGroup
                                variant="outline"
                                value={[signed ? "true" : "false"]}
                                onValueChange={(value) =>
                                    setSigned(
                                        value[0] === "true" ? true : false,
                                    )
                                }
                            >
                                <ToggleGroupItem value="false">
                                    Unsigned
                                </ToggleGroupItem>
                                <ToggleGroupItem value="true">
                                    Signed
                                </ToggleGroupItem>
                            </ToggleGroup>
                        </div>
                        <div className="flex flex-col gap-2 items-center">
                            <span className="text-lg">Extension</span>
                            <ToggleGroup
                                variant="outline"
                                value={[extended ? "true" : "false"]}
                                onValueChange={(value) =>
                                    setExtended(
                                        value[0] === "true" ? true : false,
                                    )
                                }
                            >
                                <ToggleGroupItem value="false">
                                    Original
                                </ToggleGroupItem>
                                <ToggleGroupItem value="true">
                                    Extended
                                </ToggleGroupItem>
                            </ToggleGroup>
                        </div>
                    </div>
                </div>
            </CardFooter>
        </Card>
    )
}

function bitsArrayToNumber(bits: Array<boolean>, signed: boolean): number {
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

function numberToHex(num: number, extended: boolean): string {
    const negative = num < 0
    const abs = Math.abs(num)
    return `${negative ? "-" : ""}0x${abs
        .toString(16)
        .padStart(extended ? 4 : 2, "0")
        .toUpperCase()}`
}
