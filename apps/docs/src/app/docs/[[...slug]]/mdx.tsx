import defaultMdxComponents from "fumadocs-ui/mdx"
import type { MDXComponents } from "mdx/types"
import { SimpleSbpfLoop } from "./01-control-flow-graph/1-simple-sbpf-loop"
import { SlotsParsing } from "./02-instructions-reading/1-slots-parsing"
import { LddwProgram } from "./02-instructions-reading/2-lddw-program"
import { BitRepresentation } from "./03-bit-extension/1-bit-representation"
import { BitExtension } from "./03-bit-extension/2-bit-extension"
import { MaskOperations } from "./03-bit-extension/3-mask-operations"
import { ControlFlowGraph } from "./01-control-flow-graph/control-flow-graph/control-flow-graph"
import { TableOfContent } from "./table-of-content"

export function getMDXComponents(components?: MDXComponents) {
    return {
        ...defaultMdxComponents,
        TableOfContent,
        SimpleSbpfLoop,
        SlotsParsing,
        LddwProgram,
        BitRepresentation,
        BitExtension,
        MaskOperations,
        ControlFlowGraph,
        ...components,
    } satisfies MDXComponents
}

export const useMDXComponents = getMDXComponents

declare global {
    type MDXProvidedComponents = ReturnType<typeof getMDXComponents>
}
