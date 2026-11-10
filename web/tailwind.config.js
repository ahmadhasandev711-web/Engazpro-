/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--c-canvas) / <alpha-value>)',
        panel: 'rgb(var(--c-panel) / <alpha-value>)',
        'surface-2': 'rgb(var(--c-surface-2) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        'line-2': 'rgb(var(--c-line-2) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        brand: {
          DEFAULT: 'rgb(var(--c-brand) / <alpha-value>)',
          ink: 'rgb(var(--c-brand-ink) / <alpha-value>)',
          soft: 'rgb(var(--c-brand-soft) / <alpha-value>)',
        },
        'on-brand': 'rgb(var(--c-on-brand) / <alpha-value>)',
        ok: {
          DEFAULT: 'rgb(var(--c-ok) / <alpha-value>)',
          soft: 'rgb(var(--c-ok-soft) / <alpha-value>)',
        },
        warn: {
          DEFAULT: 'rgb(var(--c-warn) / <alpha-value>)',
          soft: 'rgb(var(--c-warn-soft) / <alpha-value>)',
        },
        bad: {
          DEFAULT: 'rgb(var(--c-bad) / <alpha-value>)',
          soft: 'rgb(var(--c-bad-soft) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--c-info) / <alpha-value>)',
          soft: 'rgb(var(--c-info-soft) / <alpha-value>)',
        },
        primary: {
          50: 'rgb(var(--c-primary-50) / <alpha-value>)',
          100: 'rgb(var(--c-primary-100) / <alpha-value>)',
          200: 'rgb(var(--c-primary-200) / <alpha-value>)',
          300: 'rgb(var(--c-primary-300) / <alpha-value>)',
          400: 'rgb(var(--c-primary-400) / <alpha-value>)',
          500: 'rgb(var(--c-primary-500) / <alpha-value>)',
          600: 'rgb(var(--c-primary-600) / <alpha-value>)',
          700: 'rgb(var(--c-primary-700) / <alpha-value>)',
          800: 'rgb(var(--c-primary-800) / <alpha-value>)',
          900: 'rgb(var(--c-primary-900) / <alpha-value>)',
          950: 'rgb(var(--c-primary-950) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': '11px',
      },
    },
  },
  plugins: [],
}
