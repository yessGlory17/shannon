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
        display: ['Nunito', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },
      colors: {
        zinc: {
          850: '#1f1f23',
          950: '#09090b',
        },
        brand: {
          blue: '#60a5fa',
          purple: '#a78bfa',
          50: '#f0f0ff',
          100: '#e0e0ff',
          200: '#c4b5fd',
          300: '#a78bfa',
          400: '#8b7cf7',
          500: '#7c6bf0',
          600: '#6d5de8',
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #60a5fa, #a78bfa)',
        'brand-gradient-r': 'linear-gradient(135deg, #a78bfa, #60a5fa)',
        'brand-gradient-subtle': 'linear-gradient(135deg, rgba(96,165,250,0.12), rgba(167,139,250,0.12))',
        'brand-gradient-hover': 'linear-gradient(135deg, #7bb5fb, #b9a3fb)',
        'surface-gradient': 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)',
      },
      boxShadow: {
        'brand-sm': '0 2px 8px -2px rgba(96,165,250,0.15), 0 2px 4px -2px rgba(167,139,250,0.10)',
        'brand': '0 4px 16px -4px rgba(96,165,250,0.20), 0 4px 8px -4px rgba(167,139,250,0.15)',
        'brand-lg': '0 8px 32px -8px rgba(96,165,250,0.25), 0 8px 16px -8px rgba(167,139,250,0.20)',
        'glow': '0 0 20px rgba(96,165,250,0.15), 0 0 40px rgba(167,139,250,0.08)',
        'inner-brand': 'inset 0 1px 0 rgba(96,165,250,0.08)',
        'card': '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)',
      },
      borderColor: {
        'brand-subtle': 'rgba(96,165,250,0.15)',
      },
      animation: {
        'gradient-x': 'gradient-x 3s ease infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'shimmer': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
}
