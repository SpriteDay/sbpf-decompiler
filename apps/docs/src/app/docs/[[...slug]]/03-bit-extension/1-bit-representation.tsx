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

export function BitRepresentation() {
    const [bitsState, setBitsState] = useState<Array<boolean>>(
        new Array(8).fill(false),
    )
    const [mode, setMode] = useState<"signed" | "unsigned">("unsigned")
    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    Example of interpretation of the same value as signed and
                    unsigned integer
                </CardTitle>
                <CardDescription>
                    Use the knobs to turn on and off bits
                </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center py-2">
                <div className="flex justify-center flex-row-reverse items-center  px-2 py-2">
                    {bitsState.map((value, index) => {
                        return (
                            <div
                                className={cn(
                                    "flex flex-col gap-2 items-center justify-center",
                                    (index + 1) % 4 === 0 && "ml-6",
                                )}
                                key={index}
                            >
                                <span className="text-lg">{Number(value)}</span>
                                <Switch
                                    className="rotate-270"
                                    checked={value}
                                    onCheckedChange={(checked) =>
                                        setBitsState((prev) => {
                                            const newState = [...prev]
                                            newState[index] = checked
                                            return newState
                                        })
                                    }
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
                                bitsArrayToNumber(bitsState, mode === "signed"),
                            )}
                        </span>
                    </Label>
                    <ToggleGroup
                        variant="outline"
                        value={[mode]}
                        onValueChange={(value) =>
                            setMode(value[0] as "signed" | "unsigned")
                        }
                    >
                        <ToggleGroupItem value="unsigned">
                            Unsigned
                        </ToggleGroupItem>
                        <ToggleGroupItem value="signed">Signed</ToggleGroupItem>
                    </ToggleGroup>
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

function numberToHex(num: number): string {
    const negative = num < 0
    const abs = Math.abs(num)
    return `${negative ? "-" : ""}0x${abs.toString(16).padStart(2, "0").toUpperCase()}`
}
