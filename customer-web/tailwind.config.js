/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'serif'],
        body: ['Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        ink: {
          DEFAULT: '#2a2748',
          soft: '#6b6796',
          faint: '#a8a4c9',
        },
        line: {
          DEFAULT: '#c8cdf0',
          soft: '#e3e6f7',
        },
        accent: {
          DEFAULT: '#8b91e8',
          deep: '#5a62cc',
          soft: '#e8eaff',
        },
        paper: '#ffffff',
        bg: {
          DEFAULT: '#f5f3ff',
          alt: '#eef0ff',
        },
        danger: '#e85a78',
        success: '#4fb88a',
      },
      animation: {
        'float-char': 'floatChar 3.4s ease-in-out infinite',
        'shadow-pulse': 'shadowPulse 3.4s ease-in-out infinite',
        'pop': 'pop 0.5s cubic-bezier(.2,1.6,.4,1) both',
        'slide-up': 'slideUp 0.3s cubic-bezier(.2,.8,.2,1)',
        'fade-in': 'fadeIn 0.25s ease',
        'shimmer': 'shimmer 2s ease-in-out infinite',
      },
      keyframes: {
        floatChar: {
          '0%,100%': { transform: 'translateY(0) rotate(-0.6deg)' },
          '50%': { transform: 'translateY(-10px) rotate(0.6deg)' },
        },
        shadowPulse: {
          '0%,100%': { width: '110px', opacity: '0.6' },
          '50%': { width: '88px', opacity: '0.35' },
        },
        pop: {
          '0%': { transform: 'scale(0)' },
          '100%': { transform: 'scale(1)' },
        },
        slideUp: {
          from: { transform: 'translateY(40px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        shimmer: {
          '0%,100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [],
};
