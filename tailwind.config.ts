import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0B0B0C",
        steel: "#1C1F24",
        fog: "#9AA0A6",
        chalk: "#F5F5F3",
        rust: "#C55B2E",
        safety: "#F5A524",
        moss: "#3FA373",
        // Heat scale — used on variance reveal and related signals.
        "heat-max": "#F5A524",
        "heat-warn": "#E07A3A",
        "heat-ok": "#3FA373",
        "heat-sandbag": "#6AA6B8",
        "badge-gold": "#D4A574",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      transitionTimingFunction: {
        reveal: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
      transitionDuration: {
        count: "1800ms",
        flash: "600ms",
        haptic: "120ms",
      },
      boxShadow: {
        reveal: "0 0 40px rgba(245, 165, 36, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
