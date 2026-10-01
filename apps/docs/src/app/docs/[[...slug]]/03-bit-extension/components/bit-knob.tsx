"use client"

import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { ComponentProps } from "react"

export function BitKnob({
    index,
    value,
    disabled = false,
    className,
    onCheckedChange,
}: {
    index: number
    value: boolean
    disabled?: boolean
    className?: string
    onCheckedChange: ComponentProps<typeof Switch>["onCheckedChange"]
}) {
    return (
        <div
            className={cn(
                "flex flex-col gap-2 items-center justify-center",
                (index + 1) % 4 === 0 && "ml-6",
                className,
            )}
        >
            <span className="text-lg">{Number(value)}</span>
            <Switch
                className="rotate-270"
                checked={value}
                onCheckedChange={onCheckedChange}
                disabled={disabled}
            />
        </div>
    )
}
