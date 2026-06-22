/** @type {import('tailwindcss').Config} */
// Brand colours mirror assets/css/tokens.css (the pc-brand source of truth).
// Bridging Studio to tokens.css directly is a post-M1 cleanup (per the handoff).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#030D3A',
        'navy-700': '#0A1A55',
        teal: '#00C896',
        'teal-ink': '#008060',
        surface: '#F4F5F7',
        line: '#E4E7EC',
        ink: '#333333',
        'ink-soft': '#5A6173',
        orange: '#FF7D00',
        'light-blue': '#248CFF',
      },
      fontFamily: {
        head: ['"Inter Tight"', 'sans-serif'],
        body: ['Figtree', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
