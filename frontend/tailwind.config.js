/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        mystica: {
          dark: '#1a1a2e',
          blue: '#00b4d8',
          green: '#2d9e6b',
          light: '#90e0ef'
        }
      }
    }
  },
  plugins: []
};
