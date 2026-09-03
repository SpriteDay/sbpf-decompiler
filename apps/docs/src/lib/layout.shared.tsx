import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"
import Image from "next/image"

// fill this with your actual GitHub info, for example:
export const gitConfig = {
    user: "SpriteDay",
    repo: "sbpf-decompiler-docs",
    branch: "main",
}

export function baseOptions(): BaseLayoutProps {
    return {
        nav: {
            title: (
                <div className="flex items-center gap-2">
                    <Image
                        alt="logo"
                        src="/Logo.webp"
                        width={32}
                        height={32}
                        className="rounded-sm dark:mix-blend-screen"
                    />
                    <span className="text-[1rem] font-medium tracking-tight">
                        SBFP Decompilation
                    </span>
                </div>
            ),
        },
        githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
    }
}
