import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import tailwindcssPrettier from "eslint-plugin-tailwindcss-prettier"

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            parserOptions: {
                project: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            "@typescript-eslint/no-floating-promises": "error",
        },
    },
    {
        plugins: {
            "tailwindcss-prettier": tailwindcssPrettier,
        },
        rules: {
            "@typescript-eslint/no-unused-vars": "off",
            "@next/next/no-sync-scripts": "off",
            "import/no-anonymous-default-export": "off",
            "tailwindcss-prettier/order": [
                "warn",
                {
                    attributes: [], // Additional attributes to check
                    functions: ["clsx", "tw", "cn", "cva"], // Function names to check
                },
            ],
        },
    },
    // Override default ignores of eslint-config-next.
    globalIgnores([
        // Default ignores of eslint-config-next:
        ".next/**",
        "out/**",
        "build/**",
        "next-env.d.ts",
        ".source/**",
    ]),
])

export default eslintConfig
