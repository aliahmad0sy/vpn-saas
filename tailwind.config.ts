import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  // Use `media` so the existing `dark:` variants apply automatically based on
  // the user's OS preference. Switching to `class` would require a theme
  // toggle and adding `dark` to <html> on hydration; we don't ship one yet.
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#bcdaff',
          300: '#8dc1ff',
          400: '#599cff',
          500: '#3479ff',
          600: '#1f5af5',
          700: '#1846e0',
          800: '#1a3bb5',
          900: '#1c388e',
          950: '#152357',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
