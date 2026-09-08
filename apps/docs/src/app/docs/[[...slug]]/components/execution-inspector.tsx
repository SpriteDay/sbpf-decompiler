import { Insn } from "@/components/micro-vm/ebpf"
import { runV3InstructionsWithTracing } from "@/components/micro-vm/v3-harness"
import { useMemo } from "react"

export function ExecutionInspector({ program }: { program: Array<Insn> }) {
    const programResult = useMemo(() => {
        runV3InstructionsWithTracing({ instructions: program })
    }, [program])
    return null
}
