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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useState } from "react"
import { BitKnob } from "./components/bit-knob"
import { bitsArrayToNumber, numberToHex } from "./utils"

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
                            <BitKnob
                                key={index}
                                value={value}
                                index={index}
                                onCheckedChange={(checked) =>
                                    setBitsState((prev) => {
                                        const newState = [...prev]
                                        newState[index] = checked
                                        return newState
                                    })
                                }
                            />
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
                                false,
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
