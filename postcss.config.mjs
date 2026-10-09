const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    // Merge equivalent rules after Tailwind expands utilities. Keep every selector;
    // structural compression must not depend on a single page's visible state.
    "postcss-csso": {},
  },
};

export default config;
