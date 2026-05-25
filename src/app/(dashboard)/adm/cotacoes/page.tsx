'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Search, Phone, Mail, Building2, Users, ChevronLeft, ChevronRight,
  Star, RefreshCw, ExternalLink,
} from 'lucide-react';

const SIZE_LABEL: Record<string, string> = {
  '10-50':    '10–50',
  '51-200':   '51–200',
  '201-500':  '201–500',
  '501-1000': '501–1.000',
  '1001+':    '1.000+',
};

const INTEREST_COLOR = (v: number) => {
  if (v >= 8) return '#009B00';
  if (v >= 5) return '#F75900';
  return '#F7B511';
};

const INTEREST_LABEL = (v: number) => {
  if (v >= 9) return 'Urgente';
  if (v >= 7) return 'Alto';
  if (v >= 5) return 'Médio';
  if (v >= 3) return 'Baixo';
  return 'Mínimo';
};

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company_name: string;
  company_size: string;
  sector: string | null;
  role: string | null;
  pain_points: string[];
  interest: number;
  message: string | null;
  created_at: string;
};

function InterestDots({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full"
          style={{ background: i < value ? INTEREST_COLOR(value) : '#e5e7eb' }}
        />
      ))}
      <span className="ml-1.5 text-xs font-semibold" style={{ color: INTEREST_COLOR(value) }}>
        {value}/10
      </span>
    </div>
  );
}

export default function CotacoesPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [minInterest, setMinInterest] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        ...(search ? { q: search } : {}),
        ...(minInterest > 0 ? { min_interest: String(minInterest) } : {}),
      });
      const res = await fetch(`/api/admin/cotacoes?${params}`);
      if (!res.ok) return;
      const data = await res.json() as { leads: Lead[]; total: number };
      setLeads(data.leads);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [page, search, minInterest]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / 20));
  const highInterest = leads.filter((l) => l.interest >= 8).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0d2a3d]">Cotações Trial</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Leads gerados pelo funil de demonstração
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="rounded-xl bg-[#f7f8f6] border px-4 py-2 text-center">
            <p className="text-xl font-extrabold text-[#0d2a3d]">{total}</p>
            <p className="text-xs text-muted-foreground">Total de leads</p>
          </div>
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-2 text-center">
            <p className="text-xl font-extrabold text-green-700">{highInterest}</p>
            <p className="text-xs text-green-600">Interesse ≥ 8 (nesta página)</p>
          </div>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, empresa ou e-mail..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Interesse mín.</span>
          <div className="flex gap-1">
            {[0, 5, 7, 9].map((v) => (
              <button
                key={v}
                onClick={() => { setMinInterest(v); setPage(1); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                style={{
                  background:  minInterest === v ? '#144660' : 'white',
                  color:       minInterest === v ? 'white' : '#6b7280',
                  borderColor: minInterest === v ? '#144660' : '#e5e7eb',
                }}
              >
                {v === 0 ? 'Todos' : `${v}+`}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs text-muted-foreground hover:text-[#0d2a3d] transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* ── Cards ──────────────────────────────────────────────────────── */}
      {leads.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          {loading ? 'Carregando...' : 'Nenhum lead encontrado.'}
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => {
            const isOpen = expanded === lead.id;
            const date = new Date(lead.created_at).toLocaleString('pt-BR', {
              day: '2-digit', month: '2-digit', year: '2-digit',
              hour: '2-digit', minute: '2-digit',
            });

            return (
              <Card key={lead.id} className={`border transition-shadow ${lead.interest >= 8 ? 'border-green-200 bg-green-50/30' : ''}`}>
                <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpanded(isOpen ? null : lead.id)}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                        style={{ background: INTEREST_COLOR(lead.interest) }}
                      >
                        {lead.interest}
                      </div>
                      <div>
                        <CardTitle className="text-base">{lead.name}</CardTitle>
                        <CardDescription className="flex items-center gap-3 flex-wrap mt-0.5">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {lead.company_name}
                          </span>
                          {lead.role && <span className="text-xs">{lead.role}</span>}
                          <span className="text-xs">{date}</span>
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <Badge
                        variant="secondary"
                        className="text-xs"
                        style={{ color: INTEREST_COLOR(lead.interest) }}
                      >
                        <Star className="h-3 w-3 mr-1" />
                        {INTEREST_LABEL(lead.interest)}
                      </Badge>
                      {lead.company_size && (
                        <Badge variant="secondary" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          {SIZE_LABEL[lead.company_size] ?? lead.company_size} col.
                        </Badge>
                      )}
                      {lead.sector && (
                        <Badge variant="secondary" className="text-xs">{lead.sector}</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {isOpen && (
                  <CardContent className="pt-0 space-y-4 border-t">
                    {/* Contact */}
                    <div className="grid sm:grid-cols-2 gap-3 pt-4">
                      <a
                        href={`mailto:${lead.email}`}
                        className="flex items-center gap-2 text-sm text-[#144660] hover:underline"
                      >
                        <Mail className="h-4 w-4" />
                        {lead.email}
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </a>
                      {lead.phone && (
                        <a
                          href={`https://wa.me/55${lead.phone.replace(/\D/g, '')}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-[#144660] hover:underline"
                        >
                          <Phone className="h-4 w-4" />
                          {lead.phone}
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </a>
                      )}
                    </div>

                    {/* Interest bar */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Nível de interesse</p>
                      <InterestDots value={lead.interest} />
                    </div>

                    {/* Pain points */}
                    {lead.pain_points.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1.5">Motivações relatadas</p>
                        <div className="flex flex-wrap gap-1.5">
                          {lead.pain_points.map((p) => (
                            <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Message */}
                    {lead.message && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Mensagem</p>
                        <p className="text-sm bg-[#f7f8f6] rounded-lg p-3 text-[#0d2a3d] leading-relaxed">
                          {lead.message}
                        </p>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            {total} leads · página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
