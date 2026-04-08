'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Loader2 } from 'lucide-react';
import { Logo } from '@/components/ui/logo';

interface CompanyOption {
  id: string;
  name: string;
}

type Step = 'credentials' | 'select-company';

export default function LoginPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Credenciais inválidas');
        return;
      }

      setUserRole(data.user?.role ?? '');

      if (data.needs_company_select && data.companies?.length > 1) {
        setCompanies(data.companies);
        setStep('select-company');
        return;
      }

      // Single company — go straight in
      redirectAfterLogin(data.user?.role);
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const getPostLoginPath = (role: string) => (role === 'ADM' ? '/companies' : '/dashboard');

  const redirectAfterLogin = (role: string) => {
    router.push(getPostLoginPath(role));
  };

  const handleSelectCompany = async (companyId: string) => {
    setSwitchingId(companyId);
    setError('');

    try {
      const res = await fetch('/api/auth/switch-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ company_id: companyId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erro ao selecionar empresa');
        return;
      }

      // Hard reload after company switch to guarantee auth/session context refresh.
      window.location.href = getPostLoginPath(userRole);
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setSwitchingId(null);
    }
  };

  // ── Company selection screen ──────────────────────────────────────────
  if (step === 'select-company') {
    return (
      <div className="flex flex-col justify-center w-full max-w-sm px-2">
        <div className="flex flex-col items-center mb-8">
          <Logo size={44} variant="dark" />
          <p className="text-sm text-muted-foreground mt-3">Selecione a empresa</p>
        </div>

        <div className="space-y-2">
          {companies.map((company) => (
            <button
              key={company.id}
              type="button"
              disabled={switchingId !== null}
              onClick={() => handleSelectCompany(company.id)}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-background px-4 py-3.5 text-left text-sm font-medium transition-colors hover:bg-accent hover:border-[#00C896]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#0D3D4F]/10">
                {switchingId === company.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#0D3D4F]" />
                ) : (
                  <Building2 className="h-4 w-4 text-[#0D3D4F]" />
                )}
              </div>
              <span className="flex-1 truncate">{company.name}</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => { setStep('credentials'); setError(''); setSwitchingId(null); }}
          className="mt-6 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 text-center"
        >
          Voltar ao login
        </button>

        <p className="text-center text-[10px] text-muted-foreground/50 mt-8">v1.0.6</p>
      </div>
    );
  }

  // ── Credentials screen ────────────────────────────────────────────────
  return (
    <div className="flex flex-col justify-center w-full max-w-sm px-2">
      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        <Logo size={44} variant="dark" />
        <p className="text-sm text-muted-foreground mt-3">
          Plataforma de Riscos Psicossociais NR-1
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11"
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium">
            Senha
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-11"
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-11 text-sm font-medium"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Entrando...
            </>
          ) : (
            'Entrar'
          )}
        </Button>
      </form>

      {/* Footer note */}
      <p className="text-center text-xs text-muted-foreground mt-10">
        Acesso restrito a usuários autorizados
      </p>
      <p className="text-center text-[10px] text-muted-foreground/50 mt-2">v1.0.6</p>
    </div>
  );
}
