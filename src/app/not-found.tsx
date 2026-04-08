import Link from 'next/link';
import { Logo } from '@/components/ui/logo';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center text-center max-w-md">
        <Logo size={40} variant="dark" />

        <p className="mt-8 text-7xl font-bold text-[#0D3D4F] tracking-tight">404</p>
        <h1 className="mt-3 text-xl font-semibold text-foreground">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço que você acessou não existe ou foi movido.
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex h-10 items-center justify-center rounded-md bg-[#0D3D4F] px-6 text-sm font-medium text-white transition-colors hover:bg-[#0D3D4F]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
