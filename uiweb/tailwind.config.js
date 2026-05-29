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
          line: clayVar('--clay-line'),
          'pink-ink': clayVar('--clay-pink-ink'),
          'blue-ink': clayVar('--clay-blue-ink'),
          'purple-ink': clayVar('--clay-purple-ink'),
          'green-ink': clayVar('--clay-green-ink'),
          'yellow-ink': clayVar('--clay-yellow-ink'),
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
        'clay-xs': 'var(--clay-shadow-xs)',
        'clay-sm': 'var(--clay-shadow-sm)',
        clay: 'var(--clay-shadow)',
        'clay-hover': 'var(--clay-shadow-hover)',
        'clay-active': 'var(--clay-shadow-active)',
        'clay-inset': 'var(--clay-shadow-inset)',
        'clay-inset-sm': 'var(--clay-shadow-inset-sm)',
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
        // 六一漂浮 emoji — 纯 translateY，GPU 加速，无 layout reflow
        floatA: { '0%,100%': { transform: 'translateY(0px) rotate(-4deg)' }, '50%': { transform: 'translateY(-10px) rotate(4deg)' } },
        floatB: { '0%,100%': { transform: 'translateY(0px) rotate(6deg)' },  '50%': { transform: 'translateY(-14px) rotate(-6deg)' } },
        floatC: { '0%,100%': { transform: 'translateY(0px) rotate(-2deg)' }, '50%': { transform: 'translateY(-8px) rotate(2deg)' } },
        floatD: { '0%,100%': { transform: 'translateY(0px) rotate(8deg)' },  '50%': { transform: 'translateY(-12px) rotate(-8deg)' } },
        floatE: { '0%,100%': { transform: 'translateY(0px) rotate(-5deg)' }, '50%': { transform: 'translateY(-16px) rotate(5deg)' } },
        floatF: { '0%,100%': { transform: 'translateY(0px) rotate(3deg)' },  '50%': { transform: 'translateY(-9px) rotate(-3deg)' } },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'float-a': 'floatA 3.2s ease-in-out infinite',
        'float-b': 'floatB 4.1s ease-in-out infinite',
        'float-c': 'floatC 3.7s ease-in-out infinite',
        'float-d': 'floatD 4.8s ease-in-out infinite',
        'float-e': 'floatE 3.5s ease-in-out infinite',
        'float-f': 'floatF 4.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
