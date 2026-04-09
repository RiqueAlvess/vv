import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx,js,jsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#144660',
          light: '#1a5a80',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#1ff28d',
          hover: '#17d47e',
          light: '#ebf0eb',
          foreground: '#FFFFFF',
        },
        brand: {
          teal: '#144660',
          green: '#1ff28d',
          white: '#FFFFFF',
          gray: '#ebf0eb',
          dark: '#0d2a3d',
          text: '#1A1A1A',
          muted: '#6B7280',
        },
      },
    },
  },
} satisfies Config
