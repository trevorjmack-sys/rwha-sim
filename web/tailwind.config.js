/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      // STHS-retro dark palette
      colors: {
        rwha: {
          bg:        '#0d0d14',   // near-black navy
          surface:   '#14141f',   // card background
          border:    '#1e1e2e',   // subtle borders
          text:      '#e2e2f0',   // primary text
          muted:     '#6b6b8a',   // secondary/dim text
          amber:     '#f5a623',   // scoreboard amber — primary accent
          'amber-dim':'#a06b10',  // dimmed amber
          green:     '#27c45a',   // wins / positive
          red:       '#e84545',   // losses / negative
          blue:      '#4a9eff',   // links / info
        },
      },
      fontFamily: {
        // Mono for scores/stats, sans for UI
        mono: ['"JetBrains Mono"', '"Fira Mono"', '"Courier New"', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Scoreboard-style sizes
        'score-lg': ['3rem',   { lineHeight: '1', fontWeight: '700' }],
        'score-md': ['1.75rem',{ lineHeight: '1', fontWeight: '700' }],
      },
    },
  },
  plugins: [],
};
