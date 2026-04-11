'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmModal } from '@/components/modals/confirm-modal';
import { CSVUploadModal } from '@/components/modals/csv-upload-modal';
import { QRCodeModal } from '@/components/modals/qrcode-modal';
import { QRCodeCanvas } from 'qrcode.react';
import { useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { useNotifications } from '@/hooks/use-notifications';
import { format } from 'date-fns';
import {
  ArrowLeft, Play, Square, Upload, BarChart3,
  Users, QrCode, ClipboardCheck, Download,
  Plus, Trash2, Eye, RefreshCw, FileSpreadsheet, FileText,
  ChevronDown, Calendar, MessageSquare,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CampaignChecklist } from '@/components/checklist/campaign-checklist';
import type { Campaign } from '@/types';

const statusLabels: Record<string, string> = {
  draft: 'Rascunho',
  active: 'Ativa',
  closed: 'Encerrada',
};

interface QRCode {
  id: string;
  token: string;
  is_active: boolean;
  created_at: string;
  deactivated_at: string | null;
}

interface Metrics {
  total_employees: number;
  total_responded: number;
  response_rate: number;
}

interface Position {
  id: string;
  name: string;
  response_count: number;
}

interface Sector {
  id: string;
  name: string;
  positions: Position[];
}

interface Unit {
  id: string;
  name: string;
  sectors: Sector[];
}

function CampaignStatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {statusLabels[status]}
      </span>
    );
  }
  if (status === 'closed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
        {statusLabels[status]}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      {statusLabels[status]}
    </span>
  );
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { get, post } = useApi();
  const { user } = useAuth();
  const { success, error: notifyError } = useNotifications();
  const queryClient = useQueryClient();
  const campaignId = params.id as string;
  const qrInlineRef = useRef<HTMLDivElement>(null);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [companyData, setCompanyData] = useState<{ name: string; logo_url: string | null } | null>(null);
  const [qrCodes, setQrCodes] = useState<QRCode[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [respondentsPage, setRespondentsPage] = useState(1);
  const RESPONDENTS_PAGE_SIZE = 15;
  const [loading, setLoading] = useState(true);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [activateModalOpen, setActivateModalOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [newQRModalOpen, setNewQRModalOpen] = useState(false);
  const [deactivateQRModalOpen, setDeactivateQRModalOpen] = useState(false);
  const [qrViewModalOpen, setQrViewModalOpen] = useState(false);
  const [selectedQRId, setSelectedQRId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Respondents filter state
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedSector, setSelectedSector] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [unitFilterOpen, setUnitFilterOpen] = useState(false);
  const [sectorFilterOpen, setSectorFilterOpen] = useState(false);
  const [positionFilterOpen, setPositionFilterOpen] = useState(false);

  const appUrl = typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL ?? '');

  const activeQR = qrCodes.find((q) => q.is_active);
  const surveyUrl = activeQR ? `${appUrl}/survey/${activeQR.token}` : '';

  const fetchCampaign = useCallback(async () => {
    try {
      const res = await get(`/api/campaigns/${campaignId}`);
      if (!res.ok) {
        notifyError('Campanha não encontrada');
        router.push('/campaigns');
        return;
      }
      const data = await res.json();
      setCampaign(data);
    } catch {
      notifyError('Erro ao carregar campanha');
    } finally {
      setLoading(false);
    }
  }, [campaignId, get, notifyError, router]);

  const fetchQRCodes = useCallback(async () => {
    try {
      const res = await get(`/api/campaigns/${campaignId}/qrcode`);
      if (res.ok) {
        const data = await res.json();
        setQrCodes(data.data || []);
      }
    } catch { /* ignore */ }
  }, [campaignId, get]);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await get(`/api/campaigns/${campaignId}/metrics`);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch { /* ignore */ }
  }, [campaignId, get]);

  const fetchHierarchy = useCallback(async () => {
    setHierarchyLoading(true);
    try {
      const res = await get(`/api/campaigns/${campaignId}/employees`);
      if (res.ok) {
        const data = await res.json();
        setUnits(data.data || []);
      }
    } catch { /* ignore */ }
    finally { setHierarchyLoading(false); }
  }, [campaignId, get]);

  useEffect(() => {
    fetchCampaign();
    fetchQRCodes();
    fetchMetrics();
  }, [fetchCampaign, fetchQRCodes, fetchMetrics]);

  useEffect(() => {
    if (campaign?.status !== 'active') return;
    const interval = setInterval(fetchMetrics, 30_000);
    return () => clearInterval(interval);
  }, [campaign?.status, fetchMetrics]);

  useEffect(() => {
    if (!campaign?.company_id) return;
    get(`/api/companies/${campaign.company_id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setCompanyData({ name: data.name, logo_url: data.logo_url }))
      .catch(() => {});
  }, [campaign?.company_id, get]);

  const handleCSVUpload = async (rows: Array<{ unidade: string; setor: string; cargo: string }>) => {
    setActionLoading(true);
    try {
      const res = await post(`/api/campaigns/${campaignId}/upload-csv`, { rows });
      if (res.status === 409) {
        const data = await res.json();
        notifyError(data.error || 'Ação não permitida no status atual');
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        notifyError(data.error || 'Erro ao importar CSV');
        return;
      }
      const data = await res.json();
      success('Hierarquia importada', `${data.units} unidades, ${data.sectors} setores, ${data.positions} cargos`);
      setCsvModalOpen(false);
      fetchHierarchy();
    } catch {
      notifyError('Erro ao importar CSV');
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = async () => {
    setActionLoading(true);
    try {
      const res = await post(`/api/campaigns/${campaignId}/activate`);
      if (!res.ok) {
        const data = await res.json();
        notifyError(data.error || 'Erro ao ativar campanha');
        return;
      }
      await post(`/api/campaigns/${campaignId}/qrcode`);
      success('Campanha ativada', 'QR Code gerado automaticamente');
      setActivateModalOpen(false);
      fetchCampaign();
      fetchQRCodes();
    } catch {
      notifyError('Erro ao ativar campanha');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async () => {
    setActionLoading(true);
    try {
      const res = await post(`/api/campaigns/${campaignId}/close`);
      if (!res.ok) {
        const data = await res.json();
        notifyError(data.error || 'Erro ao encerrar campanha');
        return;
      }
      success('Campanha encerrada');
      setCloseModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'closed'] });
      fetchCampaign();
      fetchQRCodes();
    } catch {
      notifyError('Erro ao encerrar campanha');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateNewQR = async () => {
    setActionLoading(true);
    try {
      const res = await post(`/api/campaigns/${campaignId}/qrcode`);
      if (!res.ok) {
        const data = await res.json();
        notifyError(data.error || 'Erro ao criar QR Code');
        return;
      }
      success('Novo QR Code criado');
      setNewQRModalOpen(false);
      fetchQRCodes();
    } catch {
      notifyError('Erro ao criar QR Code');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivateQR = async () => {
    if (!selectedQRId) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/campaigns/${campaignId}/qrcode`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ qr_id: selectedQRId }),
      });
      if (!res.ok) { notifyError('Erro ao desativar QR Code'); return; }
      success('QR Code desativado');
      setDeactivateQRModalOpen(false);
      setSelectedQRId('');
      fetchQRCodes();
    } catch {
      notifyError('Erro ao desativar QR Code');
    } finally {
      setActionLoading(false);
    }
  };

  // Flatten hierarchy into rows
  const respondentRows = units.flatMap(unit =>
    unit.sectors.flatMap(sector =>
      sector.positions.map(pos => ({
        unit: unit.name,
        sector: sector.name,
        position: pos.name,
        response_count: pos.response_count,
      }))
    )
  ).sort((a, b) => b.response_count - a.response_count);

  // Filter derived data
  const uniqueUnits = [...new Set(respondentRows.map(r => r.unit))];
  const uniqueSectors = [...new Set(
    respondentRows
      .filter(r => !selectedUnit || r.unit === selectedUnit)
      .map(r => r.sector)
  )];
  const uniquePositions = [...new Set(
    respondentRows
      .filter(r =>
        (!selectedUnit || r.unit === selectedUnit) &&
        (!selectedSector || r.sector === selectedSector)
      )
      .map(r => r.position)
  )];
  const filteredRespondentRows = respondentRows.filter(r =>
    (!selectedUnit || r.unit === selectedUnit) &&
    (!selectedSector || r.sector === selectedSector) &&
    (!selectedPosition || r.position === selectedPosition)
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!campaign) return null;

  const canManage = user?.role === 'ADM' || user?.role === 'RH';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/campaigns"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold truncate">{campaign.name}</h1>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          {campaign.description && (
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{campaign.description}</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {canManage && (
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { window.location.href = '/api/campaigns/csv-template'; }}>
            <Download className="h-4 w-4 mr-2" />
            Baixar Modelo CSV
          </Button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={campaign.status === 'closed'}
                    onClick={() => setCsvModalOpen(true)}
                    className={campaign.status === 'closed' ? 'pointer-events-none opacity-50' : ''}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Importar CSV
                  </Button>
                </span>
              </TooltipTrigger>
              {campaign.status === 'closed' && (
                <TooltipContent><p>Não disponível para campanhas encerradas</p></TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          {campaign.status === 'draft' && (
            <Button size="sm" onClick={() => setActivateModalOpen(true)}>
              <Play className="h-4 w-4 mr-2" />
              Ativar Campanha
            </Button>
          )}
          {campaign.status === 'active' && (
            <Button size="sm" variant="destructive" onClick={() => setCloseModalOpen(true)}>
              <Square className="h-4 w-4 mr-2" />
              Encerrar Campanha
            </Button>
          )}
          {campaign.status === 'closed' && (
            <>
              <Button size="sm" asChild>
                <Link href="/dashboard">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Ver Dashboard
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = `/api/campaigns/${campaignId}/report/pdf?sync=1`;
                  a.target = '_blank';
                  a.click();
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
              {user?.role === 'ADM' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = `/api/campaigns/${campaignId}/dashboard/export`;
                    a.download = '';
                    a.click();
                  }}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Exportar Planilha
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-muted/60">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium mb-1">Período</p>
                <p className="text-sm font-semibold leading-tight">
                  {format(new Date(campaign.start_date), 'dd/MM/yyyy')}
                  <span className="text-muted-foreground font-normal"> – </span>
                  {format(new Date(campaign.end_date), 'dd/MM/yyyy')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-muted/60">
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium mb-1">Funcionários Cadastrados</p>
                <p className="text-sm font-semibold">
                  {metrics?.total_employees ?? 0} colaboradores
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-muted/60">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium mb-1">Respostas</p>
                <p className="text-sm font-semibold">
                  {metrics?.total_responded ?? 0} respostas
                </p>
                {(metrics?.total_employees ?? 0) > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {metrics?.response_rate ?? 0}% de adesão
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-muted/60">
                <QrCode className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium mb-1">QR Code</p>
                {activeQR ? (
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-sm font-semibold text-emerald-700">Ativo</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-gray-300 shrink-0" />
                    <span className="text-sm text-muted-foreground">Inativo</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="qrcode" onValueChange={(v) => v === 'hierarchy' && fetchHierarchy()}>
        <TabsList>
          <TabsTrigger value="qrcode">
            <QrCode className="h-4 w-4 mr-2" />
            QR Code
          </TabsTrigger>
          <TabsTrigger value="hierarchy">
            <Users className="h-4 w-4 mr-2" />
            Respondentes
          </TabsTrigger>
          <TabsTrigger value="checklist">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Checklist NR-1
          </TabsTrigger>
        </TabsList>

        {/* ── QR Code tab ───────────────────────────────────────────────── */}
        <TabsContent value="qrcode">
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Gerenciar QR Code</CardTitle>
                  <CardDescription>Compartilhe com sua equipe para iniciar a pesquisa</CardDescription>
                </div>
                {canManage && campaign.status !== 'closed' && (
                  <Button variant="outline" size="sm" onClick={() => setNewQRModalOpen(true)} disabled={actionLoading}>
                    <Plus className="h-4 w-4 mr-2" />
                    {activeQR ? 'Novo QR Code' : 'Criar QR Code'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeQR ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-5">
                  <div className="flex items-start gap-4">
                    {/* Left: info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                        <p className="text-sm font-semibold">
                          QR Code <span className="text-emerald-600">● Ativo</span>
                        </p>
                      </div>
                      <a
                        href={surveyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline font-mono break-all block"
                      >
                        {surveyUrl}
                      </a>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Criado em {format(new Date(activeQR.created_at), 'dd/MM/yyyy HH:mm')}
                      </p>
                    </div>

                    {/* Right: QR image + button */}
                    <div className="flex flex-col items-center gap-2 shrink-0" ref={qrInlineRef}>
                      <div className="bg-white p-2 rounded-xl border shadow-sm">
                        <QRCodeCanvas
                          value={surveyUrl}
                          size={96}
                          level="H"
                          marginSize={0}
                          bgColor="#FFFFFF"
                          fgColor="#000000"
                        />
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setQrViewModalOpen(true)}>
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Abrir
                        </Button>
                        {canManage && campaign.status !== 'closed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => { setSelectedQRId(activeQR.id); setDeactivateQRModalOpen(true); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
                  <QrCode className="h-10 w-10 mx-auto mb-3 opacity-25" />
                  <p className="text-sm">
                    {campaign.status === 'draft'
                      ? 'O QR Code será gerado automaticamente ao ativar a campanha.'
                      : campaign.status === 'closed'
                      ? 'Campanha encerrada — QR Code desativado.'
                      : 'Nenhum QR Code ativo. Clique em "Criar QR Code".'}
                  </p>
                </div>
              )}

              {/* Histórico */}
              {qrCodes.filter((q) => !q.is_active).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Histórico
                  </p>
                  <div className="space-y-1">
                    {qrCodes.filter((q) => !q.is_active).map((qr) => (
                      <div
                        key={qr.id}
                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/40 text-xs"
                      >
                        <span className="font-mono text-muted-foreground">{qr.token.slice(0, 8)}…</span>
                        <span className="text-muted-foreground">
                          Desativado em{' '}
                          {qr.deactivated_at
                            ? format(new Date(qr.deactivated_at), 'dd/MM/yyyy HH:mm')
                            : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Counters */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="rounded-xl border bg-muted/30 p-4 text-center">
                  <p className="text-2xl font-bold">{metrics?.total_employees ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Funcionários cadastrados</p>
                </div>
                <div className="rounded-xl border bg-muted/30 p-4 text-center">
                  <p className="text-2xl font-bold">{metrics?.total_responded ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Respostas recebidas</p>
                </div>
                <div className="rounded-xl border bg-muted/30 p-4 text-center">
                  <p className="text-2xl font-bold">{qrCodes.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">QR Codes gerados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Respondents tab ───────────────────────────────────────────── */}
        <TabsContent value="hierarchy">
          <div className="rounded-xl border shadow-sm overflow-hidden bg-card flex">
            {/* Sidebar */}
            <aside className="w-56 border-r flex-shrink-0 flex flex-col">
              <div className="px-4 py-3 border-b bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Navegação e Filtros
                </p>
              </div>

              <div className="p-2 flex-1 overflow-y-auto">
                {/* Active view item */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium mb-1">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Análise de Respondentes</span>
                </div>

                {/* Filtros Ativos */}
                <div className="mt-2">
                  <button
                    onClick={() => setFiltersOpen(!filtersOpen)}
                    className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:bg-muted/50 transition-colors"
                  >
                    <span>Filtros Ativos</span>
                    <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${filtersOpen ? '' : '-rotate-90'}`} />
                  </button>

                  {filtersOpen && (
                    <div className="space-y-0.5 pl-1 mt-0.5">
                      {/* Unidade filter */}
                      <div>
                        <button
                          onClick={() => setUnitFilterOpen(!unitFilterOpen)}
                          className="flex items-center justify-between w-full px-3 py-1.5 text-sm text-foreground/80 hover:bg-muted/50 rounded-lg transition-colors"
                        >
                          <span>Unidade</span>
                          <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${unitFilterOpen ? '' : '-rotate-90'}`} />
                        </button>
                        {unitFilterOpen && (
                          <div className="pl-3 space-y-0.5 py-0.5">
                            <button
                              onClick={() => { setSelectedUnit(''); setSelectedSector(''); setSelectedPosition(''); }}
                              className={`w-full text-left px-2 py-1 text-xs rounded-md hover:bg-muted/50 transition-colors ${!selectedUnit ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
                            >
                              Todas
                            </button>
                            {uniqueUnits.map(unit => (
                              <button
                                key={unit}
                                onClick={() => { setSelectedUnit(unit); setSelectedSector(''); setSelectedPosition(''); setRespondentsPage(1); }}
                                className={`w-full text-left px-2 py-1 text-xs rounded-md hover:bg-muted/50 transition-colors truncate ${selectedUnit === unit ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
                              >
                                {unit}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Setor filter */}
                      <div>
                        <button
                          onClick={() => setSectorFilterOpen(!sectorFilterOpen)}
                          className="flex items-center justify-between w-full px-3 py-1.5 text-sm text-foreground/80 hover:bg-muted/50 rounded-lg transition-colors"
                        >
                          <span>Setor</span>
                          <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${sectorFilterOpen ? '' : '-rotate-90'}`} />
                        </button>
                        {sectorFilterOpen && (
                          <div className="pl-3 space-y-0.5 py-0.5">
                            <button
                              onClick={() => { setSelectedSector(''); setSelectedPosition(''); }}
                              className={`w-full text-left px-2 py-1 text-xs rounded-md hover:bg-muted/50 transition-colors ${!selectedSector ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
                            >
                              Todos
                            </button>
                            {uniqueSectors.map(sector => (
                              <button
                                key={sector}
                                onClick={() => { setSelectedSector(sector); setSelectedPosition(''); setRespondentsPage(1); }}
                                className={`w-full text-left px-2 py-1 text-xs rounded-md hover:bg-muted/50 transition-colors truncate ${selectedSector === sector ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
                              >
                                {sector}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Cargo filter */}
                      <div>
                        <button
                          onClick={() => setPositionFilterOpen(!positionFilterOpen)}
                          className="flex items-center justify-between w-full px-3 py-1.5 text-sm text-foreground/80 hover:bg-muted/50 rounded-lg transition-colors"
                        >
                          <span>Cargo</span>
                          <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${positionFilterOpen ? '' : '-rotate-90'}`} />
                        </button>
                        {positionFilterOpen && (
                          <div className="pl-3 space-y-0.5 py-0.5">
                            <button
                              onClick={() => setSelectedPosition('')}
                              className={`w-full text-left px-2 py-1 text-xs rounded-md hover:bg-muted/50 transition-colors ${!selectedPosition ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
                            >
                              Todos
                            </button>
                            {uniquePositions.map(pos => (
                              <button
                                key={pos}
                                onClick={() => { setSelectedPosition(pos); setRespondentsPage(1); }}
                                className={`w-full text-left px-2 py-1 text-xs rounded-md hover:bg-muted/50 transition-colors truncate ${selectedPosition === pos ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
                              >
                                {pos}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Outras Visualizações */}
                <div className="mt-4">
                  <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Outras Visualizações
                  </p>
                </div>
              </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <h3 className="text-base font-semibold">Análise de Respondentes</h3>
                <Button variant="outline" size="sm" onClick={fetchHierarchy} disabled={hierarchyLoading}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${hierarchyLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              <div className="p-5">
                {hierarchyLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ) : respondentRows.length === 0 ? (
                  <div className="py-12 text-center">
                    <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma hierarquia importada. Use &quot;Importar CSV&quot; para adicionar unidades, setores e cargos.
                    </p>
                  </div>
                ) : filteredRespondentRows.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-sm text-muted-foreground">
                      Nenhum resultado para os filtros selecionados.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40">
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Unidade</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Setor</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cargo</th>
                            <th className="text-center px-4 py-3 font-medium text-muted-foreground">Respostas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRespondentRows
                            .slice((respondentsPage - 1) * RESPONDENTS_PAGE_SIZE, respondentsPage * RESPONDENTS_PAGE_SIZE)
                            .map((row, i) => (
                              <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                <td className="px-4 py-2.5 text-muted-foreground text-xs">{row.unit}</td>
                                <td className="px-4 py-2.5 text-muted-foreground text-xs">{row.sector}</td>
                                <td className="px-4 py-2.5 font-medium text-sm">{row.position}</td>
                                <td className="px-4 py-2.5 text-center">
                                  {row.response_count > 0 ? (
                                    <Badge variant="secondary">{row.response_count}</Badge>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>

                    {filteredRespondentRows.length > RESPONDENTS_PAGE_SIZE && (
                      <div className="flex items-center justify-between pt-4">
                        <p className="text-xs text-muted-foreground">
                          {(respondentsPage - 1) * RESPONDENTS_PAGE_SIZE + 1}–{Math.min(respondentsPage * RESPONDENTS_PAGE_SIZE, filteredRespondentRows.length)} de {filteredRespondentRows.length} cargos
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={respondentsPage === 1}
                            onClick={() => setRespondentsPage(p => p - 1)}
                          >
                            Anterior
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={respondentsPage * RESPONDENTS_PAGE_SIZE >= filteredRespondentRows.length}
                            onClick={() => setRespondentsPage(p => p + 1)}
                          >
                            Próximo
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Checklist tab ─────────────────────────────────────────────── */}
        <TabsContent value="checklist">
          <CampaignChecklist campaignId={campaignId} canEdit={canManage} />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <CSVUploadModal
        open={csvModalOpen}
        onOpenChange={setCsvModalOpen}
        onUpload={handleCSVUpload}
        loading={actionLoading}
      />

      {activeQR && (
        <QRCodeModal
          open={qrViewModalOpen}
          onOpenChange={setQrViewModalOpen}
          surveyUrl={surveyUrl}
          campaignName={campaign.name}
          campaignStartDate={campaign.start_date}
          campaignEndDate={campaign.end_date}
          companyName={companyData?.name}
          companyLogoUrl={companyData?.logo_url ?? undefined}
        />
      )}

      <ConfirmModal
        open={activateModalOpen}
        onOpenChange={setActivateModalOpen}
        title="Ativar Campanha"
        description="Ao ativar, um QR Code será gerado automaticamente. Deseja continuar?"
        confirmText="Ativar"
        loading={actionLoading}
        onConfirm={handleActivate}
      />

      <ConfirmModal
        open={closeModalOpen}
        onOpenChange={setCloseModalOpen}
        title="Encerrar Campanha"
        description="O QR Code será desativado e não será mais possível coletar respostas. Os resultados serão calculados."
        confirmText="Encerrar"
        variant="destructive"
        loading={actionLoading}
        onConfirm={handleClose}
      />

      <ConfirmModal
        open={newQRModalOpen}
        onOpenChange={setNewQRModalOpen}
        title={activeQR ? 'Criar Novo QR Code' : 'Criar QR Code'}
        description={
          activeQR
            ? 'O QR Code atual será desativado e um novo será gerado. Links anteriores não funcionarão mais.'
            : 'Um novo QR Code será criado para esta campanha.'
        }
        confirmText="Criar"
        loading={actionLoading}
        onConfirm={handleCreateNewQR}
      />

      <ConfirmModal
        open={deactivateQRModalOpen}
        onOpenChange={setDeactivateQRModalOpen}
        title="Desativar QR Code"
        description="O QR Code será desativado. Quem tentar acessar pelo link não conseguirá mais responder."
        confirmText="Desativar"
        variant="destructive"
        loading={actionLoading}
        onConfirm={handleDeactivateQR}
      />
    </div>
  );
}
