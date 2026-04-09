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
          DEFAULT: '#1AA278',
          hover: '#158c66',
          light: '#E6F5F0',
          foreground: '#FFFFFF',
        },
        brand: {
          teal: '#0D3D4F',
          green: '#1AA278',
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
