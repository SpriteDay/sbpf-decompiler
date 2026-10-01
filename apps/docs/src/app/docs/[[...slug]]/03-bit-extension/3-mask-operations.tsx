"use client"

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useMemo, useState } from "react"
import { bitsArrayToNumber, numberToHex } from "./utils"
import { BitKnob } from "./components/bit-knob"
import { Separator } from "@/components/ui/separator"

type Operation = "AND" | "OR"

export function MaskOperations() {
    const [firstNumBitsState, setFirstNumBitsState] = useState<Array<boolean>>(
        new Array(16).fill(false),
    )
    const [secondNumBitsState, setSecondNumBitsState] = useState<
        Array<boolean>
    >(new Array(16).fill(false))
    const [operation, setOperation] = useState<Operation>("AND")
    const [signed, setSigned] = useState<boolean>(false)

    const resultNumBitsState = useMemo(() => {
        const firstNum = bitsArrayToNumber(firstNumBitsState, signed)
        const secondNum = bitsArrayToNumber(secondNumBitsState, signed)
        let value: number
        switch (operation) {
            case "AND": {
                value = firstNum & secondNum
                break
            }
            case "OR": {
                value = firstNum | secondNum
                break
            }
        }
        return value
            .toString(2)
            .padStart(16, "0")
            .split("")
            .reverse()
            .map((val) => Number(val) === 1)
    }, [firstNumBitsState, secondNumBitsState, operation, signed])

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    Applying operation (AND/OR) to two values to see the result
                </CardTitle>
                <CardDescription>
                    Use the knobs to control values and change operations
                </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center py-2 flex-col gap-4 items-center">
                <div className="flex flex-col gap-2 justify-center items-center">
                    <div className="flex justify-center flex-row-reverse items-center px-2 py-2">
                        {firstNumBitsState.map((value, index) => {
                            return (
                                <BitKnob
                                    key={index}
                                    value={value}
                                    index={index}
                                    onCheckedChange={(checked) =>
                                        setFirstNumBitsState((prev) => {
                                            const newState = [...prev]
                                            newState[index] = checked
                                            return newState
                                        })
                                    }
                                />
                            )
                        })}
                    </div>
                    <span className="font-semibold tabular-nums">
                        {numberToHex(
                            bitsArrayToNumber(firstNumBitsState, signed),
                            true,
                        )}
                    </span>
                </div>
                <ToggleGroup
                    variant="outline"
                    value={[operation]}
                    onValueChange={(value) =>
                        setOperation(value[0] as Operation)
                    }
                >
                    <ToggleGroupItem value="AND">AND</ToggleGroupItem>
                    <ToggleGroupItem value="OR">OR</ToggleGroupItem>
                </ToggleGroup>
                <div className="flex flex-col gap-2 justify-center items-center">
                    <div className="flex justify-center flex-row-reverse items-center px-2 py-2">
                        {secondNumBitsState.map((value, index) => {
                            return (
                                <BitKnob
                                    key={index}
                                    value={value}
                                    index={index}
                                    onCheckedChange={(checked) =>
                                        setSecondNumBitsState((prev) => {
                                            const newState = [...prev]
                                            newState[index] = checked
                                            return newState
                                        })
                                    }
                                />
                            )
                        })}
                    </div>
                    <span className="font-semibold tabular-nums">
                        {numberToHex(
                            bitsArrayToNumber(secondNumBitsState, signed),
                            true,
                        )}
                    </span>
                </div>
                <Separator />
                <div className="flex flex-col gap-2 justify-center items-center">
                    <div className="flex justify-center flex-row-reverse items-center px-2 py-2">
                        {resultNumBitsState.map((value, index) => {
                            return (
                                <BitKnob
                                    key={index}
                                    value={value}
                                    index={index}
                                    disabled={true}
                                    onCheckedChange={() => {}}
                                />
                            )
                        })}
                    </div>
                    <span className="font-semibold tabular-nums">
                        {numberToHex(
                            bitsArrayToNumber(resultNumBitsState, signed),
                            true,
                        )}
                    </span>
                </div>
            </CardContent>
            <CardFooter className="flex-col items-start gap-4 text-sm">
                <div className="flex w-full flex-col items-center gap-4 ">
                    <div className="flex flex-col gap-2 items-center">
                        <span className="text-lg">Sign</span>
                        <ToggleGroup
                            variant="outline"
                            value={[signed ? "true" : "false"]}
                            onValueChange={(value) =>
                                setSigned(value[0] === "true" ? true : false)
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
                </div>
            </CardFooter>
        </Card>
    )
}
