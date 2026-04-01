import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';

const inter = localFont({
  src: [
    { path: './fonts/inter-var.woff2', style: 'normal' },
  ],
  variable: '--font-inter',
  fallback: [
    'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont',
    'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif',
  ],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'vivamente360 — Saude Psicossocial NR-1',
  description: 'Plataforma SaaS de analise de riscos psicossociais baseada no HSE-IT e NR-1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} bg-white font-sans text-[#333333] antialiased`}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
