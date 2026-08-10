/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0B0E14",
          900: "#0F131C",
          800: "#131722",
          700: "#1A2030",
          600: "#232838",
          500: "#2E3547",
        },
        mist: {
          50: "#E6E9EF",
          400: "#7C8496",
          600: "#565D70",
        },
        cobalt: {
          400: "#6E93F5",
          500: "#4C7CF0",
          600: "#3A63D6",
        },
        amber: {
          400: "#F0A64C",
          500: "#E0913A",
        },
        moss: {
          400: "#5FBF8F",
        },
      },
      fontFamily: {
        display: ["Space Grotesk", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        keycap: "0 2px 0 0 rgba(0,0,0,0.4), inset 0 1px 0 0 rgba(255,255,255,0.06)",
      },
    },
  },
  plugins: [],
};
