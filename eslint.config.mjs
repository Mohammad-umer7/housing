import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Coverage reports — generated, not source.
    "coverage/**",
    // Second, self-contained project (MOE Strategist) — deployed as its OWN Vercel
    // project with Root Directory = moe-strategist. The housing app must never lint or
    // type-check it (it has its own tsconfig/eslint). See tsconfig "exclude" too.
    "moe-strategist/**",
  ]),
]);

export default eslintConfig;
