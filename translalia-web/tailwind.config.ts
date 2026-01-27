import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      container: {
        center: true,
        padding: "1rem",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["Merriweather", "Georgia", "serif"],
      },
      // Semantic color system
      colors: {
        // Background layers
        base: "rgb(var(--color-base) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        // Text hierarchy
        foreground: {
          DEFAULT: "rgb(var(--color-foreground) / <alpha-value>)",
          secondary: "rgb(var(--color-foreground-secondary) / <alpha-value>)",
          muted: "rgb(var(--color-foreground-muted) / <alpha-value>)",
          disabled: "rgb(var(--color-foreground-disabled) / <alpha-value>)",
        },
        // Accent color (sky blue)
        accent: {
          DEFAULT: "rgb(var(--color-accent) / <alpha-value>)",
          light: "rgb(var(--color-accent-light) / <alpha-value>)",
          dark: "rgb(var(--color-accent-dark) / <alpha-value>)",
        },
        // Semantic colors
        success: {
          DEFAULT: "rgb(var(--color-success) / <alpha-value>)",
          light: "rgb(var(--color-success-light) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "rgb(var(--color-warning) / <alpha-value>)",
          light: "rgb(var(--color-warning-light) / <alpha-value>)",
        },
        error: {
          DEFAULT: "rgb(var(--color-error) / <alpha-value>)",
          light: "rgb(var(--color-error-light) / <alpha-value>)",
        },
        // Border colors
        border: {
          DEFAULT: "rgb(var(--color-border) / <alpha-value>)",
          subtle: "rgb(var(--color-border-subtle) / <alpha-value>)",
        },
      },
      // Standardized border radius (3 levels)
      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        md: "8px",
        lg: "12px",
      },
      animation: {
        slideInRight: "slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        fadeInUp: "fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        glow: "glow 2s ease-in-out infinite",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      keyframes: {
        slideInRight: {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        fadeInUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 5px rgba(2, 132, 199, 0.5)" },
          "50%": { boxShadow: "0 0 20px rgba(2, 132, 199, 0.8)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      boxShadow: {
        // Subtle card shadow
        card: "0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.06)",
        // Panel shadows (preserved)
        "panel-shadow": "0 2px 8px rgba(0, 0, 0, 0.08)",
        "panel-shadow-lg": "0 4px 16px rgba(0, 0, 0, 0.12)",
        // Modal shadow
        modal: "0 10px 40px rgba(0, 0, 0, 0.15)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      transitionDuration: {
        fast: "150ms",
        smooth: "200ms",
      },
      // Focus ring utilities
      ringWidth: {
        focus: "2px",
      },
      ringOffsetWidth: {
        focus: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
