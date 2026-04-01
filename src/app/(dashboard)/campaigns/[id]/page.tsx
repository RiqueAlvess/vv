'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmModal } from '@/components/modals/confirm-modal';
import { CSVUploadModal } from '@/components/modals/csv-upload-modal';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { useNotifications } from '@/hooks/use-notifications';
import { format } from 'date-fns';
import {
  ArrowLeft, Play, Square, Upload, Send, BarChart3,
  Users, Mail, CheckCircle2, Clock, XCircle, ChevronDown, ChevronRight, ClipboardCheck, Download,
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

interface Invitation {
  id: string;
  status: string;
  sent_at: string | null;
  token_used: boolean;
  employee?: { email_hash: string };
}

interface Metrics {
  total_invited: number;
  total_responded: number;
  response_rate: number;
}

interface Employee {
  id: string;
  email_hash: string;
  has_email: boolean;
  invited: boolean;
  invitation_status: string | null;
  invited_at: string | null;
}

interface Position {
  id: string;
  name: string;
  employees: Employee[];
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
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [activateModalOpen, setActivateModalOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendAllModalOpen, setSendAllModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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

  const fetchInvitations = useCallback(async () => {
    try {
      const res = await get(`/api/campaigns/${campaignId}/invitations`);
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.data || []);
      }
    } catch {
      // ignore
    }
  }, [campaignId, get]);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await get(`/api/campaigns/${campaignId}/metrics`);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch {
      // ignore
    }
  }, [campaignId, get]);

  const fetchEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    try {
      const res = await get(`/api/campaigns/${campaignId}/employees`);
      if (res.ok) {
        const data = await res.json();
        setUnits(data.data || []);
      }
    } catch {
      // ignore
    } finally {
      setEmployeesLoading(false);
    }
  }, [campaignId, get]);

  useEffect(() => {
    fetchCampaign();
    fetchInvitations();
    fetchMetrics();
  }, [fetchCampaign, fetchInvitations, fetchMetrics]);

  useEffect(() => {
    if (campaign?.status !== 'active') return;
    const interval = setInterval(() => {
      fetchMetrics();
    }, 30_000);
    return () => clearInterval(interval);
  }, [campaign?.status, fetchMetrics]);

  const handleCSVUpload = async (rows: Array<{ unidade: string; setor: string; cargo: string; email: string }>) => {
    setActionLoading(true);
    try {
      // Send rows as JSON — no CSV re-serialization
      const res = await post(`/api/campaigns/${campaignId}/upload-csv`, { rows });
      if (res.status === 409) {
        const data = await res.json();
        notifyError(data.error || 'Ação não permitida no status atual da campanha');
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        notifyError(data.error || 'Erro ao importar CSV');
        return;
      }
      const data = await res.json();
      if (data.emails_failed > 0) {
        success(
          `${data.employees} colaboradores importados`,
          `${data.emails_sent} convites enviados, ${data.emails_failed} falhas no envio`
        );
      } else {
        success(
          `${data.employees} colaboradores importados`,
          `${data.emails_sent} convites enviados com sucesso`
        );
      }
      setCsvModalOpen(false);
      fetchInvitations();
      fetchMetrics();
      fetchEmployees();
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
      success('Campanha ativada');
      setActivateModalOpen(false);
      fetchCampaign();
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
    } catch {
      notifyError('Erro ao encerrar campanha');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendSelected = async () => {
    setActionLoading(true);
    try {
      const res = await post(`/api/campaigns/${campaignId}/send-invitations`, {
        employee_ids: Array.from(selectedEmployees),
      });
      if (res.status === 409) {
        const data = await res.json();
        notifyError(data.error || 'Ação não permitida no status atual da campanha');
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        notifyError(data.error || 'Erro ao enviar convites');
        return;
      }
      const data = await res.json();
      success(`${data.sent} convite(s) enviado(s)${data.failed > 0 ? `, ${data.failed} falhou` : ''}`);
      setSendModalOpen(false);
      setSelectedEmployees(new Set());
      fetchInvitations();
      fetchMetrics();
      fetchEmployees();
    } catch {
      notifyError('Erro ao enviar convites');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendAll = async () => {
    setActionLoading(true);
    try {
      const res = await post(`/api/campaigns/${campaignId}/send-invitations`, { send_all: true });
      if (res.status === 409) {
        const data = await res.json();
        notifyError(data.error || 'Ação não permitida no status atual da campanha');
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        notifyError(data.error || 'Erro ao enviar convites');
        return;
      }
      const data = await res.json();
      success(`${data.sent} convite(s) enviado(s)${data.failed > 0 ? `, ${data.failed} falhou` : ''}`);
      setSendAllModalOpen(false);
      setSelectedEmployees(new Set());
      fetchInvitations();
      fetchMetrics();
      fetchEmployees();
    } catch {
      notifyError('Erro ao enviar convites');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleUnit = (unitId: string) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      next.has(unitId) ? next.delete(unitId) : next.add(unitId);
      return next;
    });
  };

  const toggleSector = (sectorId: string) => {
    setExpandedSectors((prev) => {
      const next = new Set(prev);
      next.has(sectorId) ? next.delete(sectorId) : next.add(sectorId);
      return next;
    });
  };

  const toggleEmployee = (empId: string) => {
    setSelectedEmployees((prev) => {
      const next = new Set(prev);
      next.has(empId) ? next.delete(empId) : next.add(empId);
      return next;
    });
  };

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
  const responseRate = metrics?.response_rate ?? 0;

  const allSelectableEmployees = units
    .flatMap((u) => u.sectors)
    .flatMap((s) => s.positions)
    .flatMap((p) => p.employees)
    .filter((e) => e.has_email && !e.invited);

  return (
    <div className="space-y-6">
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
          {/* Download CSV Template — always available */}
          <Button
            variant="outline"
            onClick={() => { window.location.href = '/api/campaigns/csv-template'; }}
          >
            <Download className="h-4 w-4 mr-2" />
            Baixar Modelo CSV
          </Button>

          {/* CSV Import — only when campaign is active */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    disabled={campaign.status !== 'active'}
                    onClick={() => setCsvModalOpen(true)}
                    className={campaign.status !== 'active' ? 'pointer-events-none opacity-50' : ''}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Importar CSV
                  </Button>
                </span>
              </TooltipTrigger>
              {campaign.status !== 'active' && (
                <TooltipContent>
                  <p>Disponível apenas quando a campanha estiver ativa</p>
                </TooltipContent>
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
            <Button asChild>
              <Link href={`/dashboard`}>
                <BarChart3 className="h-4 w-4 mr-2" />
                Ver Dashboard
              </Link>
            </Button>
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
              {format(new Date(campaign.start_date), 'dd/MM/yyyy')} - {format(new Date(campaign.end_date), 'dd/MM/yyyy')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Participantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{metrics?.total_invited ?? 0} convidados</p>
            <p className="text-sm text-muted-foreground">{metrics?.total_responded ?? 0} respostas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Resposta</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{responseRate.toFixed(1)}%</p>
            <Progress value={responseRate} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="employees" onValueChange={(v) => v === 'employees' && fetchEmployees()}>
        <TabsList>
          <TabsTrigger value="employees">
            <Users className="h-4 w-4 mr-2" />
            Colaboradores
          </TabsTrigger>
          <TabsTrigger value="invitations">
            <Mail className="h-4 w-4 mr-2" />
            Convites ({invitations.length})
          </TabsTrigger>
          <TabsTrigger value="checklist">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Checklist NR-1
          </TabsTrigger>
        </TabsList>

        {/* Colaboradores tab */}
        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Colaboradores</CardTitle>
                  <CardDescription>Selecione quem receberá o convite de pesquisa</CardDescription>
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              variant="outline"
                              disabled={campaign.status !== 'active' || selectedEmployees.size === 0 || actionLoading}
                              onClick={() => setSendModalOpen(true)}
                              className={campaign.status !== 'active' ? 'pointer-events-none opacity-50' : ''}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Enviar Selecionados ({selectedEmployees.size})
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {campaign.status !== 'active' && (
                          <TooltipContent>
                            <p>Disponível apenas quando a campanha estiver ativa</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              disabled={campaign.status !== 'active' || actionLoading}
                              onClick={() => setSendAllModalOpen(true)}
                              className={campaign.status !== 'active' ? 'pointer-events-none opacity-50' : ''}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Enviar para Todos
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {campaign.status !== 'active' && (
                          <TooltipContent>
                            <p>Disponível apenas quando a campanha estiver ativa</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {employeesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : units.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum colaborador importado. Use &quot;Importar CSV&quot; na aba de rascunho.
                </p>
              ) : (
                <div className="space-y-2">
                  {units.map((unit) => (
                    <div key={unit.id} className="border rounded-lg overflow-hidden">
                      <button
                        className="w-full flex items-center gap-2 px-4 py-3 bg-muted/40 hover:bg-muted/60 text-left font-medium text-sm"
                        onClick={() => toggleUnit(unit.id)}
                      >
                        {expandedUnits.has(unit.id) ? (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        )}
                        {unit.name}
                        <span className="ml-auto text-muted-foreground font-normal">
                          {unit.sectors.flatMap((s) => s.positions).flatMap((p) => p.employees).length} colaborador(es)
                        </span>
                      </button>

                      {expandedUnits.has(unit.id) && (
                        <div className="divide-y">
                          {unit.sectors.map((sector) => (
                            <div key={sector.id}>
                              <button
                                className="w-full flex items-center gap-2 px-6 py-2 bg-background hover:bg-muted/20 text-left text-sm text-muted-foreground"
                                onClick={() => toggleSector(sector.id)}
                              >
                                {expandedSectors.has(sector.id) ? (
                                  <ChevronDown className="h-3 w-3 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-3 w-3 shrink-0" />
                                )}
                                {sector.name}
                              </button>

                              {expandedSectors.has(sector.id) && (
                                <div className="px-8 py-2 space-y-4">
                                  {sector.positions.map((position) => (
                                    <div key={position.id}>
                                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                        {position.name}
                                      </p>
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="w-10"></TableHead>
                                            <TableHead>ID (hash)</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Convidado em</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {position.employees.map((emp) => {
                                            const selectable = emp.has_email && !emp.invited;
                                            return (
                                              <TableRow key={emp.id}>
                                                <TableCell>
                                                  <Checkbox
                                                    disabled={!selectable || !canManage || campaign.status !== 'active'}
                                                    checked={selectedEmployees.has(emp.id)}
                                                    onCheckedChange={() => toggleEmployee(emp.id)}
                                                  />
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">
                                                  {emp.email_hash.slice(0, 8)}...
                                                </TableCell>
                                                <TableCell>
                                                  {emp.invited ? (
                                                    <Badge variant="default">
                                                      {emp.invitation_status === 'responded' ? 'Respondeu' : 'Convidado'}
                                                    </Badge>
                                                  ) : emp.has_email ? (
                                                    <Badge variant="secondary">Aguardando</Badge>
                                                  ) : (
                                                    <Badge variant="outline">Sem e-mail</Badge>
                                                  )}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                  {emp.invited_at
                                                    ? format(new Date(emp.invited_at), 'dd/MM/yyyy HH:mm')
                                                    : '-'}
                                                </TableCell>
                                              </TableRow>
                                            );
                                          })}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Checklist NR-1 tab */}
        <TabsContent value="checklist">
          <CampaignChecklist campaignId={campaignId} canEdit={canManage} />
        </TabsContent>

        {/* Convites tab */}
        <TabsContent value="invitations">
          <Card>
            <CardHeader>
              <CardTitle>Convites da Campanha</CardTitle>
              <CardDescription>
                Visão agregada — status individual protegido por anonimato
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Aggregate progress */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Taxa de resposta</span>
                  <span className="font-semibold">
                    {metrics?.total_responded ?? 0} / {metrics?.total_invited ?? 0} responderam
                  </span>
                </div>
                <Progress value={responseRate} className="h-3" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{responseRate.toFixed(1)}% de adesão</span>
                  <span>
                    {(metrics?.total_invited ?? 0) - (metrics?.total_responded ?? 0)} pendentes
                  </span>
                </div>
              </div>

              {/* Status summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border bg-muted/30 p-3 text-center">
                  <p className="text-2xl font-bold">{metrics?.total_invited ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Convidados</p>
                </div>
                <div className="rounded-lg border bg-green-500/10 border-green-500/20 p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{metrics?.total_responded ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Responderam</p>
                </div>
                <div className="rounded-lg border bg-orange-500/10 border-orange-500/20 p-3 text-center">
                  <p className="text-2xl font-bold text-orange-500">
                    {(metrics?.total_invited ?? 0) - (metrics?.total_responded ?? 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Pendentes</p>
                </div>
              </div>

              {/* Anonymity note */}
              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                O status individual de cada convite é protegido por anonimato (LGPD).
                Os dados acima são contagens agregadas e atualizadas em tempo real.
              </div>

              {/* Invitation list — show only hash and sent date, NO individual status */}
              {invitations.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Convites enviados ({invitations.length})
                  </p>
                  <div className="max-h-64 overflow-y-auto space-y-1 rounded-md border p-2">
                    {invitations.slice(0, 100).map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-xs"
                      >
                        <span className="font-mono text-muted-foreground">
                          {inv.employee?.email_hash
                            ? `${inv.employee.email_hash.slice(0, 16)}...`
                            : `${inv.id.slice(0, 16)}...`
                          }
                        </span>
                        <span className="text-muted-foreground">
                          {inv.sent_at
                            ? format(new Date(inv.sent_at), 'dd/MM/yyyy HH:mm')
                            : '—'
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <CSVUploadModal
        open={csvModalOpen}
        onOpenChange={setCsvModalOpen}
        onUpload={handleCSVUpload}
        loading={actionLoading}
      />

      <ConfirmModal
        open={activateModalOpen}
        onOpenChange={setActivateModalOpen}
        title="Ativar Campanha"
        description="Ao ativar a campanha, ela ficará disponível para envio de convites. Deseja continuar?"
        confirmText="Ativar"
        loading={actionLoading}
        onConfirm={handleActivate}
      />

      <ConfirmModal
        open={closeModalOpen}
        onOpenChange={setCloseModalOpen}
        title="Encerrar Campanha"
        description="Ao encerrar a campanha, não será mais possível coletar respostas. Os resultados serão calculados automaticamente."
        confirmText="Encerrar"
        variant="destructive"
        loading={actionLoading}
        onConfirm={handleClose}
      />

      <ConfirmModal
        open={sendModalOpen}
        onOpenChange={setSendModalOpen}
        title="Enviar Convites Selecionados"
        description={`Deseja enviar convites para os ${selectedEmployees.size} colaborador(es) selecionado(s)?`}
        confirmText="Enviar"
        loading={actionLoading}
        onConfirm={handleSendSelected}
      />

      <ConfirmModal
        open={sendAllModalOpen}
        onOpenChange={setSendAllModalOpen}
        title="Enviar para Todos"
        description={`Deseja enviar convites para todos os ${allSelectableEmployees.length} colaborador(es) que ainda não foram convidados?`}
        confirmText="Enviar para Todos"
        loading={actionLoading}
        onConfirm={handleSendAll}
      />
    </div>
  );
}
