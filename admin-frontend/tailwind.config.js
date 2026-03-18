/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0EA5E9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0F172A',
        },
        accent: '#10B981',
        navy: {
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155',
        },
      },
    },
  },
  plugins: [],
};
