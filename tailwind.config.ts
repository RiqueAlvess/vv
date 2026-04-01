import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx,js,jsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#002B49',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#C5A059',
          alt: '#D4AF37',
          foreground: '#FFFFFF',
        },
        brand: {
          navy: '#002B49',
          gold: '#C5A059',
          white: '#FFFFFF',
          gray: '#F4F4F4',
          text: '#333333',
        },
      },
    },
  },
} satisfies Config
