/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"DM Sans"', "system-ui", "sans-serif"],
        body: ['"DM Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      colors: {
        surface: {
          50: "#FAFBFC",
          100: "#F1F3F5",
          200: "#E5E8EB",
          300: "#D1D6DB",
          400: "#9AA4B0",
          500: "#6B7685",
          600: "#4E5968",
          700: "#333D4B",
          800: "#191F28",
          900: "#0E1116",
        },
        accent: {
          DEFAULT: "#2563EB",
          light: "#3B82F6",
          dark: "#1D4ED8",
          muted: "#DBEAFE",
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.04), 0 6px 16px rgba(0,0,0,0.06)",
        "card-hover":
          "0 2px 6px rgba(0,0,0,0.06), 0 12px 24px rgba(0,0,0,0.10)",
        glow: "0 0 40px rgba(37,99,235,0.15)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.5s ease-out forwards",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
