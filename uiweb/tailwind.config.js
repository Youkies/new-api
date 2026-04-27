/** @type {import('tailwindcss').Config} */
const clayVar = (name) => `rgb(var(${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        clay: {
          bg: clayVar('--clay-bg'),
          surface: clayVar('--clay-surface'),
          pink: {
            50: clayVar('--clay-pink-50'),
            100: clayVar('--clay-pink-100'),
            200: clayVar('--clay-pink-200'),
            300: clayVar('--clay-pink-300'),
            400: clayVar('--clay-pink-400'),
          },
          blue: {
            50: clayVar('--clay-blue-50'),
            100: clayVar('--clay-blue-100'),
            200: clayVar('--clay-blue-200'),
            300: clayVar('--clay-blue-300'),
          },
          purple: {
            50: clayVar('--clay-purple-50'),
            100: clayVar('--clay-purple-100'),
            200: clayVar('--clay-purple-200'),
            300: clayVar('--clay-purple-300'),
          },
          green: {
            50: clayVar('--clay-green-50'),
            100: clayVar('--clay-green-100'),
            200: clayVar('--clay-green-200'),
            300: clayVar('--clay-green-300'),
          },
          yellow: {
            50: clayVar('--clay-yellow-50'),
            100: clayVar('--clay-yellow-100'),
            200: clayVar('--clay-yellow-200'),
            300: clayVar('--clay-yellow-300'),
          },
          ink: clayVar('--clay-ink'),
          faint: clayVar('--clay-faint'),
        },
      },
      fontFamily: {
        sans: ['Nunito', 'Quicksand', 'Rounded Mplus 1c', 'ui-sans-serif', 'system-ui'],
      },
      borderRadius: {
        'clay-sm': '16px',
        clay: '24px',
        'clay-lg': '32px',
        'clay-xl': '48px',
        'clay-pill': '50px',
      },
      boxShadow: {
        'clay-sm': 'var(--clay-shadow-sm)',
        clay: 'var(--clay-shadow)',
        'clay-hover': 'var(--clay-shadow-hover)',
        'clay-active': 'var(--clay-shadow-active)',
        'clay-inset': 'var(--clay-shadow-inset)',
      },
      transitionTimingFunction: {
        clay: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        float: {
          '0%, 100%': {
            transform: 'translate(0, 0) rotate(0deg)',
            borderRadius: '45% 55% 40% 60% / 50% 60% 40% 50%',
          },
          '33%': {
            transform: 'translate(0, -20px) rotate(5deg)',
            borderRadius: '50% 50% 50% 50% / 50% 50% 50% 50%',
          },
          '66%': {
            transform: 'translate(0, 10px) rotate(-5deg)',
            borderRadius: '60% 40% 60% 40% / 40% 60% 40% 60%',
          },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
