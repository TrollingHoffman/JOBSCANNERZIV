import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: '#0C1411', forest: '#12312A', paper: '#F1F4F2', surface: '#FFFFFF',
        ink: '#101A16', body: '#3A4A44', muted: '#6C7B75', line: '#DCE4E0',
        accent: '#2F6B58', 'accent-soft': '#E1EFE8', signal: '#9FE870',
        amber: '#B87A2B', 'amber-soft': '#FBF0DF', flame: '#D9552B', 'flame-soft': '#FDEBE3',
        danger: '#B3402E', 'danger-soft': '#FBE7E3',
      },
      fontFamily: { display: ['var(--font-display)', 'serif'], sans: ['var(--font-sans)', 'system-ui', 'sans-serif'] },
      boxShadow: {
        card: '0 1px 2px rgba(16,26,22,.04), 0 10px 30px -20px rgba(16,26,22,.35)',
        lift: '0 4px 10px rgba(16,26,22,.06), 0 26px 48px -28px rgba(16,26,22,.5)',
        modal: '0 40px 80px -30px rgba(12,20,17,.55)',
        toast: '0 18px 40px -18px rgba(12,20,17,.5)',
      },
      borderRadius: { '2xl': '1.25rem', '3xl': '1.75rem', '4xl': '2.25rem' },
    },
  },
  plugins: [],
} satisfies Config;
