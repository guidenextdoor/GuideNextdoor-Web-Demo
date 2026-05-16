/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gnd-red': '#7A1E1E',
        'gnd-coral': '#FF6B57',
        'gnd-cream': '#FAF7F4',
        'gnd-gray': '#6E6259',
        'gnd-dark': '#1F1F1F',
      },
    },
  },
  plugins: [],
}
