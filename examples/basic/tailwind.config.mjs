/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  // Use a `.dark` class on <html> (toggled by the theme script in
  // the document head) rather than the OS media query, so a manual
  // theme switcher can override the user's system preference.
  darkMode: 'class',
  theme: {
    // Disable default palette so we only ship our own neutral / accent
    // tokens. Keeps the bundle small and forces a unified look.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#ffffff',
      black: '#000000',
      ink: {
        50: '#fafafa',
        100: '#f4f4f5',
        200: '#e4e4e7',
        300: '#d4d4d8',
        400: '#a1a1aa',
        500: '#71717a',
        600: '#52525b',
        700: '#3f3f46',
        800: '#27272a',
        900: '#18181b',
        950: '#09090b',
      },
      accent: {
        // Subtle blue-grey. Not a SaaS purple. Just a touch of color
        // for active states and the search focus ring.
        DEFAULT: '#1f6feb',
        muted: '#388bfd1a',
      },
      // A tiny accent palette used only for status badges
      // (new / hot / mature / activity). Everything else stays
      // in the ink grayscale.
      emerald: {
        50: '#ecfdf5',
        300: '#6ee7b7',
        400: '#34d399',
        700: '#047857',
        800: '#065f46',
        950: '#022c22',
      },
      orange: {
        50: '#fff7ed',
        300: '#fdba74',
        400: '#fb923c',
        700: '#c2410c',
        800: '#9a3412',
        950: '#431407',
      },
      blue: {
        50: '#eff6ff',
        300: '#93c5fd',
        400: '#60a5fa',
        700: '#1d4ed8',
        800: '#1e40af',
        950: '#172554',
      },
      amber: {
        50: '#fffbeb',
        300: '#fcd34d',
        400: '#fbbf24',
        700: '#b45309',
        800: '#92400e',
        950: '#451a03',
      },
    },
    extend: {
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace',
        ],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      maxWidth: {
        container: '1140px',
        wide: '1400px',
        narrow: '720px',
      },
      borderRadius: {
        DEFAULT: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'gradient-shift': {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
        'subtle-bob': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2px)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.6s ease-out both',
        'fade-in': 'fade-in 0.8s ease-out both',
        'gradient-shift': 'gradient-shift 8s ease-in-out infinite',
        'subtle-bob': 'subtle-bob 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
