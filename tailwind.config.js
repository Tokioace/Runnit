/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        surface2: 'var(--color-surface-2)',
        text: 'var(--color-text)',
        muted: 'var(--color-text-muted)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)'
        },
        mint: 'var(--color-mint)',
        success: 'var(--color-success)',
        danger: 'var(--color-danger)',
        gold: 'var(--color-gold)',
        silver: 'var(--color-silver)',
        bronze: 'var(--color-bronze)'
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        soft: '0 6px 18px rgba(0,0,0,.25)',
        deep: 'var(--shadow-color)'
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { 
            boxShadow: '0 0 0 0 rgba(108,99,255,.45)', 
            transform: 'translateZ(0)' 
          },
          '50%': { 
            boxShadow: '0 0 0 12px rgba(108,99,255,.0)' 
          }
        }
      },
      animation: {
        pulseGlow: 'pulseGlow 1.8s ease-out infinite'
      },
      fontFamily: {
        'condensed': ['Roboto Condensed', 'system-ui', 'sans-serif'],
        'sans': ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: [],
}

