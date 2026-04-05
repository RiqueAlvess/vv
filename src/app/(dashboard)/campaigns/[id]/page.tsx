'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { useNotifications } from '@/hooks/use-notifications';
import { format } from 'date-fns';
import {
  ArrowLeft, Play, Square, Upload, BarChart3,
  Users, QrCode, ClipboardCheck, Download,
  Plus, Trash2, Eye, RefreshCw, FileSpreadsheet, FileText,
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
  total_responded: number;
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

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { get, post } = useApi();
  const { user } = useAuth();
  const { success, error: notifyError } = useNotifications();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
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
      // Auto-create first QR code
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

  // Flatten hierarchy into a list of rows for the respondents tab
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/campaigns"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          {campaign.description && <p className="text-muted-foreground">{campaign.description}</p>}
        </div>
        <Badge variant={campaign.status === 'active' ? 'default' : campaign.status === 'closed' ? 'outline' : 'secondary'}>
          {statusLabels[campaign.status]}
        </Badge>
      </div>

      {/* Action Buttons */}
      {canManage && (
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => { window.location.href = '/api/campaigns/csv-template'; }}>
            <Download className="h-4 w-4 mr-2" />
            Baixar Modelo CSV
          </Button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
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
            <Button onClick={() => setActivateModalOpen(true)}>
              <Play className="h-4 w-4 mr-2" />
              Ativar Campanha
            </Button>
          )}
          {campaign.status === 'active' && (
            <Button variant="destructive" onClick={() => setCloseModalOpen(true)}>
              <Square className="h-4 w-4 mr-2" />
              Encerrar Campanha
            </Button>
          )}
          {campaign.status === 'closed' && (
            <>
              <Button asChild>
                <Link href="/dashboard">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Ver Dashboard
                </Link>
              </Button>
              <Button
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
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Período</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {format(new Date(campaign.start_date), 'dd/MM/yyyy')} – {format(new Date(campaign.end_date), 'dd/MM/yyyy')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Respostas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{metrics?.total_responded ?? 0} respostas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              QR Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeQR ? (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-green-600">Ativo</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                <span className="text-sm text-muted-foreground">Inativo</span>
              </div>
            )}
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Gerenciar QR Code</CardTitle>
                  <CardDescription>Compartilhe com sua equipe para iniciar a pesquisa</CardDescription>
                </div>
                {canManage && campaign.status !== 'closed' && (
                  <Button variant="outline" onClick={() => setNewQRModalOpen(true)} disabled={actionLoading}>
                    <Plus className="h-4 w-4 mr-2" />
                    {activeQR ? 'Novo QR Code' : 'Criar QR Code'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeQR ? (
                <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                      <p className="text-sm font-semibold">QR Code Ativo</p>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono break-all">{surveyUrl}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Criado em {format(new Date(activeQR.created_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setQrViewModalOpen(true)}>
                      <Eye className="h-4 w-4 mr-1" />
                      Abrir
                    </Button>
                    {canManage && campaign.status !== 'closed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => { setSelectedQRId(activeQR.id); setDeactivateQRModalOpen(true); }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Desativar
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                  <QrCode className="h-10 w-10 mx-auto mb-3 opacity-30" />
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
                        className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30 text-xs"
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
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-lg border bg-muted/30 p-3 text-center">
                  <p className="text-2xl font-bold">{metrics?.total_responded ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Respostas recebidas</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 text-center">
                  <p className="text-2xl font-bold">{qrCodes.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">QR Codes gerados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Respondents tab ───────────────────────────────────────────── */}
        <TabsContent value="hierarchy">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Respondentes por Cargo</CardTitle>
                  <CardDescription>Cargos com respostas registradas, agrupados por unidade e setor</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchHierarchy} disabled={hierarchyLoading}>
                  <RefreshCw className={`h-4 w-4 ${hierarchyLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {hierarchyLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : respondentRows.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma hierarquia importada. Use &quot;Importar CSV&quot; para adicionar unidades, setores e cargos.
                </p>
              ) : (
                <>
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Unidade</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Setor</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cargo</th>
                          <th className="text-center px-4 py-3 font-medium text-muted-foreground">Respostas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {respondentRows
                          .slice((respondentsPage - 1) * RESPONDENTS_PAGE_SIZE, respondentsPage * RESPONDENTS_PAGE_SIZE)
                          .map((row, i) => (
                            <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="px-4 py-2.5 text-muted-foreground text-xs">{row.unit}</td>
                              <td className="px-4 py-2.5 text-muted-foreground text-xs">{row.sector}</td>
                              <td className="px-4 py-2.5 font-medium">{row.position}</td>
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
                  {/* Pagination */}
                  {respondentRows.length > RESPONDENTS_PAGE_SIZE && (
                    <div className="flex items-center justify-between pt-4">
                      <p className="text-xs text-muted-foreground">
                        {(respondentsPage - 1) * RESPONDENTS_PAGE_SIZE + 1}–{Math.min(respondentsPage * RESPONDENTS_PAGE_SIZE, respondentRows.length)} de {respondentRows.length} cargos
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
                          disabled={respondentsPage * RESPONDENTS_PAGE_SIZE >= respondentRows.length}
                          onClick={() => setRespondentsPage(p => p + 1)}
                        >
                          Próximo
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
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
