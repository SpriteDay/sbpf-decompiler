import defaultMdxComponents from "fumadocs-ui/mdx"
import type { MDXComponents } from "mdx/types"
import { SimpleSbpfLoop } from "./01-control-flow-graph/1-simple-sbpf-loop"
import { SlotsParsing } from "./02-instructions-reading/1-slots-parsing"

export function getMDXComponents(components?: MDXComponents) {
    return {
        ...defaultMdxComponents,
        SimpleSbpfLoop,
        SlotsParsing,
        ...components,
    } satisfies MDXComponents
}

export const useMDXComponents = getMDXComponents

declare global {
    type MDXProvidedComponents = ReturnType<typeof getMDXComponents>
}
