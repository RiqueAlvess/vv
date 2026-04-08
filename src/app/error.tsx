'use client';

import { useEffect } from 'react';
import { Logo } from '@/components/ui/logo';
import { WrenchIcon } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center text-center max-w-md">
        <Logo size={40} variant="dark" />

        <div className="mt-8 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
          <WrenchIcon className="h-8 w-8 text-amber-600" />
        </div>

        <h1 className="mt-4 text-xl font-semibold text-foreground">Sistema em Manutenção</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Estamos realizando melhorias no sistema. Por favor, tente novamente em alguns instantes.
        </p>

        {error.digest && (
          <p className="mt-3 text-xs text-muted-foreground/60 font-mono">
            Código: {error.digest}
          </p>
        )}

        <button
          type="button"
          onClick={reset}
          className="mt-8 inline-flex h-10 items-center justify-center rounded-md bg-[#0D3D4F] px-6 text-sm font-medium text-white transition-colors hover:bg-[#0D3D4F]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
