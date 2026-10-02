// Tailwind v4 is mostly CSS-first (see tokens.css `@theme`). This file only
// scopes content paths and registers plugins. Most repos won't need it; keep
// for projects that prefer a JS config or use plugins.
import type { Config } from "tailwindcss";

const config: Config = {
  // Tailwind v4 detects content automatically when you `@import "tailwindcss"`
  // in CSS. List explicitly if you want to override:
  content: [
    "./src/**/*.{ts,tsx,js,jsx,html,mdx}",
    "./app/**/*.{ts,tsx,js,jsx,mdx}",
    "./components/**/*.{ts,tsx,js,jsx}",
    "./app/styles/**/*.{ts,tsx,js,jsx,css}",
  ],
  theme: {
    // All design tokens live in tokens.css `@theme`. Don't duplicate here.
    extend: {},
  },
  plugins: [
    // require("tailwindcss-animate"), // shadcn animations
  ],
};

export default config;
