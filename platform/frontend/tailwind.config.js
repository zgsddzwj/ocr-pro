/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#1E6F43', dark: '#14532D', light: '#E8F3EC' },
        ink: '#1A1A1A',
      },
      fontFamily: {
        sans: ['-apple-system', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
