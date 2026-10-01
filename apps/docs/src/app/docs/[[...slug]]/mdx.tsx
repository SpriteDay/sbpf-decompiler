import defaultMdxComponents from "fumadocs-ui/mdx"
import type { MDXComponents } from "mdx/types"
import { SimpleSbpfLoop } from "./01-control-flow-graph/1-simple-sbpf-loop"
import { SlotsParsing } from "./02-instructions-reading/1-slots-parsing"
import { LddwProgram } from "./02-instructions-reading/2-lddw-program"

export function getMDXComponents(components?: MDXComponents) {
    return {
        ...defaultMdxComponents,
        SimpleSbpfLoop,
        SlotsParsing,
        LddwProgram,
        ...components,
    } satisfies MDXComponents
}

export const useMDXComponents = getMDXComponents

declare global {
    type MDXProvidedComponents = ReturnType<typeof getMDXComponents>
}
