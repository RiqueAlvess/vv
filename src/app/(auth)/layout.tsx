import { LogoImage } from '@/components/ui/logo-image';
import { brand } from '@/lib/brand';

// Force dynamic rendering so the env-var URL is always evaluated at request
// time and never served from a stale static/edge cache.
export const dynamic = 'force-dynamic';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const authBgImageUrl = brand.authBgUrl;

  return (
    <>
      {/*
        Preload the background image in <head> so the browser fetches it
        immediately — before it discovers the inline style — eliminating the
        "blank on first load" flash that happens when the image is found only
        during CSS/layout paint.
      */}
      {authBgImageUrl && (
        // @ts-expect-error — fetchpriority is a valid HTML attr, not yet in React types
        <link rel="preload" as="image" href={authBgImageUrl} fetchpriority="high" />
      )}

      <div className="min-h-screen flex">
        {/* Left column — background image */}
        <div
          className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12"
          style={{
            backgroundImage: authBgImageUrl ? `url('${authBgImageUrl}')` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0D3D4F]/72 via-[#0D3D4F]/52 to-[#1A2E35]/42" />

          {/* Top — logo */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="h-8"><LogoImage /></div>
          </div>

          {/* Middle — headline */}
          <div className="relative z-10 space-y-4">
            <h1 className="text-3xl font-bold text-white leading-tight">
              Plataforma de Análise de<br />
              Riscos Psicossociais
            </h1>
            <p className="text-white/80 text-sm leading-relaxed max-w-sm">
              Gestão completa de campanhas HSE-IT para compliance com a NR-1.
              Anonimato garantido por design.
            </p>
            <div className="flex items-center gap-6 pt-2">
              <div className="text-center">
                <p className="text-white font-bold text-xl">NR-1</p>
                <p className="text-[#00C896] text-xs">Compliance</p>
              </div>
              <div className="h-8 w-px bg-white/20" />
              <div className="text-center">
                <p className="text-white font-bold text-xl">HSE-IT</p>
                <p className="text-[#00C896] text-xs">Instrumento</p>
              </div>
              <div className="h-8 w-px bg-white/20" />
              <div className="text-center">
                <p className="text-white font-bold text-xl">LGPD</p>
                <p className="text-[#00C896] text-xs">Conformidade</p>
              </div>
            </div>
          </div>

          {/* Bottom — copyright */}
          <div className="relative z-10">
            <p className="text-white/60 text-xs">
              Vivamente360 &copy; {new Date().getFullYear()} — Plataforma corporativa de RH
            </p>
          </div>
        </div>

        {/* Right column — pure white, no card */}
        <div className="flex flex-1 items-center justify-center bg-white px-8 py-12">
          {children}
        </div>
      </div>
    </>
  );
}
