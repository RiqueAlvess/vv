import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx,js,jsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0D3D4F',
          light: '#1B5F75',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#00C896',
          hover: '#00B082',
          light: '#E8FBF5',
          foreground: '#FFFFFF',
        },
        brand: {
          teal: '#0D3D4F',
          green: '#00C896',
          white: '#FFFFFF',
          gray: '#F7F7F7',
          dark: '#1A2E35',
          text: '#1A1A1A',
          muted: '#6B7280',
        },
      },
    },
  },
} satisfies Config
