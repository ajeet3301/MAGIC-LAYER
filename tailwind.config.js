/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f5f0ff',
          100: '#ede0ff',
          200: '#d8bfff',
          300: '#c09aff',
          400: '#a46eff',
          500: '#8b3dff',
          600: '#7a1aff',
          700: '#6600e6',
          800: '#5300ba',
          900: '#440098',
        },
        electric: {
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
        },
        surface: {
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
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #8b3dff 0%, #0ea5e9 100%)',
        'gradient-dark': 'linear-gradient(135deg, #18181b 0%, #27272a 100%)',
        'checkerboard': `
          linear-gradient(45deg, #c8c8c8 25%, transparent 25%),
          linear-gradient(-45deg, #c8c8c8 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #c8c8c8 75%),
          linear-gradient(-45deg, transparent 75%, #c8c8c8 75%)
        `,
      },
      backgroundSize: {
        'checkerboard': '16px 16px',
      },
      backgroundPosition: {
        'checkerboard': '0 0, 0 8px, 8px -8px, -8px 0px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
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
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      boxShadow: {
        'brand': '0 0 20px rgba(139, 61, 255, 0.3)',
        'electric': '0 0 20px rgba(14, 165, 233, 0.3)',
        'glow': '0 0 40px rgba(139, 61, 255, 0.2)',
      },
    },
  },
  plugins: [],
}
