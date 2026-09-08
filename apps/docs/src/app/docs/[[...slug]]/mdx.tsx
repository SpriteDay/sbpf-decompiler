import defaultMdxComponents from "fumadocs-ui/mdx"
import type { MDXComponents } from "mdx/types"
import { SimpleSbpfLoop } from "./01-control-flow-graph/1-simple-sbpf-loop"

export function getMDXComponents(components?: MDXComponents) {
    return {
        ...defaultMdxComponents,
        TestComponent: SimpleSbpfLoop,
        ...components,
    } satisfies MDXComponents
}

export const useMDXComponents = getMDXComponents

declare global {
    type MDXProvidedComponents = ReturnType<typeof getMDXComponents>
}
