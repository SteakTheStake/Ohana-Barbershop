import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypeScript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".next-dev/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "src/payload-types.ts",
      "src/migrations/**",
    ],
  },
  {
    // Loading flags and cleared selections are intentional when fetch inputs change.
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  {
    // The existing WebGL initializer is a hoisted function, not a mutable value.
    files: ["src/components/ocean-text.tsx"],
    rules: { "react-hooks/immutability": "off" },
  },
];

export default eslintConfig;
