export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left column — background image with overlay */}
      <div
        className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=80&auto=format&fit=crop')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-blue-900/60" />

        {/* Content over image */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm border border-white/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 text-white"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span className="text-white font-semibold text-lg tracking-tight">Asta</span>
          </div>
        </div>

        <div className="relative z-10 space-y-4">
          <h1 className="text-3xl font-bold text-white leading-tight">
            Plataforma de Análise de<br />
            Riscos Psicossociais
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed max-w-sm">
            Gestão completa de campanhas HSE-IT para compliance com a NR-1.
            Anonimato garantido por design.
          </p>
          <div className="flex items-center gap-6 pt-2">
            <div className="text-center">
              <p className="text-white font-bold text-xl">NR-1</p>
              <p className="text-slate-400 text-xs">Compliance</p>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="text-center">
              <p className="text-white font-bold text-xl">HSE-IT</p>
              <p className="text-slate-400 text-xs">Instrumento</p>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="text-center">
              <p className="text-white font-bold text-xl">LGPD</p>
              <p className="text-slate-400 text-xs">Conformidade</p>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-slate-500 text-xs">
            Asta &copy; {new Date().getFullYear()} — Plataforma corporativa de RH
          </p>
        </div>
      </div>

      {/* Right column — login form */}
      <div className="flex flex-1 items-center justify-center bg-background p-8">
        {children}
      </div>
    </div>
  );
}
