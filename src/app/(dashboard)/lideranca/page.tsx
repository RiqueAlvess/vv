'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useApi } from '@/hooks/use-api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, ChevronRight, Calendar, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Campaign {
  id: string;
  name: string;
  status: string;
  start_date: string;
  end_date: string;
}

export default function LiderancaPage() {
  const { user } = useAuth();
  const { get } = useApi();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get('/api/campaigns')
      .then((r) => r.json())
      .then((data: Campaign[]) => {
        // Only show closed campaigns — dashboard requires it
        setCampaigns(Array.isArray(data) ? data.filter((c) => c.status === 'closed') : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [get]);

  if (!user?.sector_id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] text-center px-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Lock className="w-7 h-7 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">Setor não atribuído</h2>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">
          Seu usuário não possui um setor vinculado. Solicite ao administrador que configure seu acesso.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meu Setor</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Selecione uma avaliação encerrada para visualizar os dados do seu setor
        </p>
      </div>

      {/* Sector badge */}
      <div className="flex items-center gap-2 bg-[#144660]/5 border border-[#144660]/20 rounded-lg px-4 py-2.5">
        <Shield className="h-4 w-4 text-[#144660] shrink-0" />
        <span className="text-sm text-[#144660]">
          Acesso restrito ao seu setor — os dados apresentados não permitem identificação individual
        </span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Shield className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="font-medium text-muted-foreground">Nenhuma avaliação encerrada disponível</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Os dados são liberados somente após o encerramento da coleta
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <Card
              key={c.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/lideranca/${c.id}`)}
            >
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(c.end_date), "dd 'de' MMM yyyy", { locale: ptBR })}
                  </p>
                </div>
                <Badge className="bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100 shrink-0">
                  Encerrada
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
