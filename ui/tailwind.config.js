module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        devos: {
          bg:      '#0a0a0f',
          surface: '#111118',
          border:  '#1e1e2e',
          accent:  '#6366f1',
          green:   '#22c55e',
          red:     '#ef4444',
          yellow:  '#eab308',
          text:    '#e2e8f0',
          muted:   '#64748b'
        }
      }
    }
  },
  plugins: []
}
