/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#090A0F',
          900: '#0C0D12',
          800: '#11131A',
          border: '#1E2230',
        },
        aurion: {
          gold: '#D4AF37',
          lime: '#B8FF2C',
          purple: '#8B5CF6',
        },
      },
      animation: {
        'spin-slow': 'spin 6s linear infinite',
      },
    },
  },
  plugins: [],
};
