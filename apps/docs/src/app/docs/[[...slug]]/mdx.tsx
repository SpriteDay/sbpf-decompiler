import defaultMdxComponents from "fumadocs-ui/mdx"
import type { MDXComponents } from "mdx/types"
import { TestComponent } from "./01-control-flow-graph/1-test-component"

export function getMDXComponents(components?: MDXComponents) {
    return {
        ...defaultMdxComponents,
        TestComponent,
        ...components,
    } satisfies MDXComponents
}

export const useMDXComponents = getMDXComponents

declare global {
    type MDXProvidedComponents = ReturnType<typeof getMDXComponents>
}
