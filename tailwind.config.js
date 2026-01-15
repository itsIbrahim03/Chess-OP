/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1E293B', // Logo Dark (Pawn)
          med: '#475569',     // Logo Med (Book)
          light: '#F1F5F9',   // Logo Light (Paper)
        },
        chess: {
          bg: '#0F172A',      // Main App BG (Deep Slate)
          panel: '#1E293B',   // Card/Sidebar BG
          text: {
            primary: '#F8FAFC',
            secondary: '#94A3B8',
          },
          accent: {
            DEFAULT: '#38BDF8', // Sky Blue Action
            hover: '#0EA5E9',
          },
          status: {
            success: '#10B981', // Emerald
            error: '#EF4444',   // Red
            warning: '#F59E0B', // Amber
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'], 
      }
    },
  },
  plugins: [],
}
