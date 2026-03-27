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
  Users, Mail, CheckCircle2, Clock, XCircle, ChevronDown, ChevronRight,
} from 'lucide-react';
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

  const handleCSVUpload = async (rows: Array<{ unidade: string; setor: string; cargo: string; email: string }>) => {
    setActionLoading(true);
    try {
      const csvContent = ['unidade,setor,cargo,email', ...rows.map(r => `${r.unidade},${r.setor},${r.cargo},${r.email}`)].join('\n');
      const res = await post(`/api/campaigns/${campaignId}/upload-csv`, { csv_content: csvContent });
      if (!res.ok) {
        const data = await res.json();
        notifyError(data.error || 'Erro ao importar CSV');
        return;
      }
      success('Colaboradores importados com sucesso');
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
          {campaign.status === 'draft' && (
            <>
              <Button variant="outline" onClick={() => setCsvModalOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Importar CSV
              </Button>
              <Button onClick={() => setActivateModalOpen(true)}>
                <Play className="h-4 w-4 mr-2" />
                Ativar Campanha
              </Button>
            </>
          )}
          {campaign.status === 'active' && (
            <>
              <Button variant="destructive" onClick={() => setCloseModalOpen(true)}>
                <Square className="h-4 w-4 mr-2" />
                Encerrar Campanha
              </Button>
            </>
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
                {canManage && campaign.status === 'active' && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={selectedEmployees.size === 0 || actionLoading}
                      onClick={() => setSendModalOpen(true)}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Enviar Selecionados ({selectedEmployees.size})
                    </Button>
                    <Button
                      disabled={actionLoading}
                      onClick={() => setSendAllModalOpen(true)}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Enviar para Todos
                    </Button>
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

        {/* Convites tab */}
        <TabsContent value="invitations">
          <Card>
            <CardHeader>
              <CardTitle>Convites Enviados</CardTitle>
              <CardDescription>Lista de convites de pesquisa</CardDescription>
            </CardHeader>
            <CardContent>
              {invitations.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum convite encontrado. Selecione colaboradores na aba Colaboradores.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Enviado em</TableHead>
                      <TableHead>Respondido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.slice(0, 50).map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs">{inv.id.slice(0, 8)}...</TableCell>
                        <TableCell>
                          <Badge variant={inv.status === 'sent' ? 'default' : inv.status === 'pending' ? 'secondary' : 'outline'}>
                            {inv.status === 'sent' ? 'Enviado' : inv.status === 'pending' ? 'Pendente' : inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {inv.sent_at ? format(new Date(inv.sent_at), 'dd/MM/yyyy HH:mm') : '-'}
                        </TableCell>
                        <TableCell>
                          {inv.token_used ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : inv.sent_at ? (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {invitations.length > 50 && (
                <p className="text-sm text-muted-foreground text-center mt-4">
                  Mostrando 50 de {invitations.length} convites
                </p>
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
