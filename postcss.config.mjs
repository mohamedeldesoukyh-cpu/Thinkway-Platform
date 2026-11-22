import path from "node:path";

const config = {
  plugins: {
    [path.resolve("scripts/postcss-runtime-sources.cjs")]: {},
    "@tailwindcss/postcss": {},
    // Merge equivalent rules after Tailwind expands utilities. Keep every selector;
    // structural compression must not depend on a single page's visible state.
    "postcss-csso": {},
  },
};

export default config;
