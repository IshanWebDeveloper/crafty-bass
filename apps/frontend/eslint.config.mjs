import playwright from "eslint-plugin-playwright";
import { defineConfig, globalIgnores } from "eslint/config";
import nxPlugin from "@nx/eslint-plugin";
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
  ]),
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    plugins: {
      "@nx": nxPlugin,
    },
    rules: {
      "@nx/enforce-module-boundaries": [
        "error",
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: "type:app",
              onlyDependOnLibsWithTags: [
                "type:feature",
                "type:ui",
                "type:data-access",
                "type:util",
              ],
            },
            {
              sourceTag: "scope:web",
              onlyDependOnLibsWithTags: ["scope:web", "scope:shared"],
            },
            {
              sourceTag: "scope:api",
              onlyDependOnLibsWithTags: ["scope:api", "scope:shared"],
            },
            {
              sourceTag: "scope:shared",
              onlyDependOnLibsWithTags: ["scope:shared"],
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
