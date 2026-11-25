import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#090A0F',
          900: '#0C0D12',
          850: '#11131A',
          800: '#161822',
          border: '#1E2230',
        },
        aurion: {
          gold: '#D4AF37',
          lime: '#B8FF2C',
          purple: '#8B5CF6',
          blue: '#3B82F6',
          indigo: '#6366F1',
        },
      },
    },
  },
  plugins: [],
};

export default config;
