/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Geist"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        ink: {
          50: '#f7f7f5',
          100: '#eeede8',
          200: '#d8d6cf',
          300: '#b5b1a6',
          400: '#8e8a7d',
          500: '#6b6759',
          600: '#535044',
          700: '#3f3d34',
          800: '#2a2924',
          900: '#1a1916',
        },
        accent: {
          50: '#eef8f6',
          100: '#d6eee9',
          200: '#addee0',
          300: '#76c4cb',
          400: '#3fa1ae',
          500: '#267f8e',
          600: '#206675',
          700: '#1f5360',
          800: '#1d444f',
          900: '#1b3943',
        },
      },
      boxShadow: {
        soft: '0 1px 3px rgba(26, 25, 22, 0.04), 0 1px 2px rgba(26, 25, 22, 0.06)',
        card: '0 4px 20px rgba(26, 25, 22, 0.06), 0 1px 3px rgba(26, 25, 22, 0.04)',
      },
    },
  },
  plugins: [],
};
