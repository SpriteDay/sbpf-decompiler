// components/site-toc.tsx
import Link from "next/link"
import { source } from "@/lib/source"

type Node = (typeof source.pageTree)["children"][number]

function TreeList({ nodes }: { nodes: Node[] }) {
    return (
        <ul>
            {nodes.map((node, i) => {
                if (node.type === "page") {
                    return (
                        <li key={node.url}>
                            <Link href={node.url}>{node.name}</Link>
                        </li>
                    )
                }

                if (node.type === "folder") {
                    return (
                        <li key={i}>
                            {node.index ? (
                                <Link href={node.index.url}>{node.name}</Link>
                            ) : (
                                <strong>{node.name}</strong>
                            )}
                            <TreeList nodes={node.children} />
                        </li>
                    )
                }

                if (node.type === "separator") {
                    return (
                        <li key={i} style={{ listStyle: "none" }}>
                            <strong>{node.name}</strong>
                        </li>
                    )
                }

                return null
            })}
        </ul>
    )
}

export function TableOfContent() {
    return <TreeList nodes={source.pageTree.children} />
}
