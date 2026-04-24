/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        clay: {
          bg: '#e0e5ec',
          surface: '#e0e5ec',
          pink: {
            50: '#ffc8dd',
            100: '#ffb3d9',
            200: '#ff99ac',
            300: '#ff8fb3',
            400: '#ff6a88',
          },
          blue: {
            50: '#cae9ff',
            100: '#a2d2ff',
            200: '#7eb8e0',
            300: '#5a9fd4',
          },
          purple: {
            50: '#e4c1f9',
            100: '#d4a5f3',
            200: '#c48ee8',
            300: '#b377dc',
          },
          green: {
            50: '#d8f3dc',
            100: '#b7e4c7',
            200: '#95d5b2',
            300: '#74c69d',
          },
          yellow: {
            50: '#fff4bd',
            100: '#ffe6a7',
            200: '#ffd98e',
            300: '#ffcc77',
          },
          ink: '#4a5568',
          faint: '#718096',
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
        clay:
          '9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5), inset 5px 5px 10px rgba(163,177,198,0.2), inset -5px -5px 10px rgba(255,255,255,0.5)',
        'clay-hover':
          '14px 14px 24px rgba(163,177,198,0.6), -14px -14px 24px rgba(255,255,255,0.5), inset 5px 5px 10px rgba(163,177,198,0.2), inset -5px -5px 10px rgba(255,255,255,0.5)',
        'clay-active':
          'inset 4px 4px 8px rgba(163,177,198,0.5), inset -4px -4px 8px rgba(255,255,255,0.8)',
        'clay-inset':
          'inset 6px 6px 10px rgba(163,177,198,0.7), inset -6px -6px 10px rgba(255,255,255,0.8)',
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
