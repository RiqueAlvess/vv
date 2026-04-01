import { Logo } from '@/components/ui/logo';

const DEFAULT_AUTH_BG_IMAGE_URL =
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=80&auto=format&fit=crop';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const authBgImageUrl = process.env.NEXT_PUBLIC_AUTH_BG_IMAGE_URL || DEFAULT_AUTH_BG_IMAGE_URL;

  return (
    <div className="min-h-screen flex">
      {/* Left column — background image */}
      <div
        className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12"
        style={{
          backgroundImage: `url('${authBgImageUrl}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Overlay (resolved in favor of softer layer to preserve background image visibility) */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#002B49]/72 via-[#002B49]/52 to-[#001f35]/42" />

        {/* Top — logo */}
        <div className="relative z-10 flex items-center gap-3">
          <Logo size={36} />
          <span className="text-[#C5A059] font-semibold text-lg tracking-tight">Asta</span>
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
              <p className="text-[#C5A059] text-xs">Compliance</p>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="text-center">
              <p className="text-white font-bold text-xl">HSE-IT</p>
              <p className="text-[#C5A059] text-xs">Instrumento</p>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="text-center">
              <p className="text-white font-bold text-xl">LGPD</p>
              <p className="text-[#C5A059] text-xs">Conformidade</p>
            </div>
          </div>
        </div>

        {/* Bottom — copyright */}
        <div className="relative z-10">
          <p className="text-white/60 text-xs">
            Asta &copy; {new Date().getFullYear()} — Plataforma corporativa de RH
          </p>
        </div>
      </div>

      {/* Right column — pure white, no card */}
      <div className="flex flex-1 items-center justify-center bg-white px-8 py-12">
        {children}
      </div>
    </div>
  );
}
