import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { FormattingStyle } from "../../../components/utils"

export function FormattingSelector({
    formatStyle,
    setFormatStyle,
}: {
    formatStyle: FormattingStyle
    setFormatStyle: (newFormatStyle: FormattingStyle) => void
}) {
    return (
        <ToggleGroup
            variant="outline"
            value={[formatStyle]}
            onValueChange={(value) =>
                value[0]! && setFormatStyle(value[0] as FormattingStyle)
            }
        >
            <ToggleGroupItem value="NASM" size="sm">
                NASM
            </ToggleGroupItem>
            <ToggleGroupItem value="LLVM" size="sm">
                LLVM
            </ToggleGroupItem>
        </ToggleGroup>
    )
}
