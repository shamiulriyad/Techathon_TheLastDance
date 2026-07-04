/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
        display: ['"Rajdhani"', '"Orbitron"', 'sans-serif']
      },
      colors: {
        base: '#030712',
        panel: 'rgba(255,255,255,0.05)',
        cyan: {
          glow: '#22d3ee'
        },
        amber: {
          glow: '#facc15'
        },
        danger: {
          glow: '#f87171'
        }
      },
      keyframes: {
        spinFast: {
          to: { transform: 'rotate(360deg)' }
        },
        pulseRing: {
          '0%, 100%': { opacity: 0.6, transform: 'scale(1)' },
          '50%': { opacity: 1, transform: 'scale(1.15)' }
        },
        slideIn: {
          from: { opacity: 0, transform: 'translateX(24px)' },
          to: { opacity: 1, transform: 'translateX(0)' }
        },
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 }
        }
      },
      animation: {
        'spin-fan': 'spinFast 0.6s linear infinite',
        'pulse-ring': 'pulseRing 1.4s ease-in-out infinite',
        'slide-in': 'slideIn 0.4s ease-out',
        'fade-in': 'fadeIn 0.6s ease-out'
      }
    }
  },
  plugins: []
}
