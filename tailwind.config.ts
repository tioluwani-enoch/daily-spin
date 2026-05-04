import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ambient: {
          DEFAULT: "var(--ambient-bg)",
          alt: "var(--ambient-bg-alt)",
          fg: "var(--ambient-fg)",
          muted: "var(--ambient-muted)",
          edge: "var(--ambient-edge)",
          accent: "var(--ambient-accent)",
          "accent-soft": "var(--ambient-accent-soft)",
          surface: "var(--ambient-surface)"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"]
      },
      fontSize: {
        display: ["2.25rem", { lineHeight: "1.15" }],
        h1: ["1.5rem", { lineHeight: "1.25" }],
        h2: ["1.125rem", { lineHeight: "1.4" }],
        body: ["1rem", { lineHeight: "1.6" }],
        meta: ["0.875rem", { lineHeight: "1.5" }],
        "mono-sm": ["0.8125rem", { lineHeight: "1.4" }]
      },
      boxShadow: {
        ambient: "0 24px 80px rgb(31 27 23 / 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
