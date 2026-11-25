/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      gridTemplateColumns: {
        13: 'repeat(13, minmax(0, 1fr))',
      },
      colors: {
        'hq-base': 'var(--hq-bg-base)',
        'hq-surface': 'var(--hq-bg-surface)',
        'hq-elevated': 'var(--hq-bg-elevated)',
        'hq-border': 'var(--hq-border-subtle)',
        'hq-felt': 'var(--hq-table-felt)',
        'hq-text': 'var(--hq-text-primary)',
        'hq-muted': 'var(--hq-text-secondary)',
        'hq-raise': 'var(--hq-verdict-raise)',
        'hq-call': 'var(--hq-verdict-call)',
        'hq-check': 'var(--hq-verdict-check)',
        'hq-fold': 'var(--hq-verdict-fold)',
        'hq-gold': 'var(--hq-my-hand-ring)',
        'hq-btn': 'var(--hq-chip-btn)',
      },
    },
  },
  plugins: [],
};