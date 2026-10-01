"use client"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { useState } from "react"

export function BitRepresentation() {
    const [bitsState, setBitsState] = useState<Array<boolean>>(
        new Array(8).fill(false),
    )
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
                <div className="flex justify-center items-center gap-2 px-2 py-2">
                    {bitsState.map((value, index) => {
                        return (
                            <div
                                className="flex flex-col gap-2 items-center justify-center"
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
        </Card>
    )
}
