'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useApi } from '@/hooks/use-api';
import { useNotifications } from '@/hooks/use-notifications';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Sparkles, ChevronDown, ChevronUp, Download,
  AlertTriangle, CheckCircle2,
  Info, Shield, Plus, Trash2, FilePlus,
} from 'lucide-react';
import type { ActionPlanProblem, PlannedAction, ActionType, ActionStatus } from '@/lib/hse-agent';
import { HSE_DIMENSIONS } from '@/lib/constants';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

interface ActionPlanData {
  id: string;
  campaign_id: string;
  model_used: string | null;
  problems: ActionPlanProblem[];
  generated_at: string;
  updated_at: string;
}

interface ActionPlanPanelProps {
  campaignId: string;
  campaignStatus: string;
  canEdit: boolean;
}

const RISK_CONFIG: Record<string, {
  label: string;
  bg: string;
  border: string;
  text: string;
  icon: React.ReactNode;
  badgeClass: string;
}> = {
  critico: {
    label: 'Crítico',
    bg: 'bg-violet-50',
    border: 'border-violet-300',
    text: 'text-violet-800',
    icon: <AlertTriangle className="h-4 w-4 text-violet-600" />,
    badgeClass: 'bg-violet-700 text-white hover:bg-violet-700',
  },
  importante: {
    label: 'Importante',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
    badgeClass: 'bg-red-500 text-white hover:bg-red-500',
  },
  moderado: {
    label: 'Moderado',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    icon: <Shield className="h-4 w-4 text-amber-500" />,
    badgeClass: 'bg-amber-500 text-white hover:bg-amber-500',
  },
  aceitavel: {
    label: 'Aceitável',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    text: 'text-teal-800',
    icon: <CheckCircle2 className="h-4 w-4 text-teal-500" />,
    badgeClass: 'bg-teal-600 text-white hover:bg-teal-600',
  },
};

const ACTION_TYPE_OPTIONS: { value: ActionType; label: string }[] = [
  { value: 'corretiva',    label: 'Corretiva' },
  { value: 'preventiva',  label: 'Preventiva' },
  { value: 'contingencia',label: 'Contingência' },
  { value: 'paliativa',   label: 'Paliativa' },
];

const ACTION_STATUS_OPTIONS: { value: ActionStatus; label: string }[] = [
  { value: 'pendente',     label: 'Pendente' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluida',    label: 'Concluída' },
];

// ---------------------------------------------------------------------------
// Action row (inline editable)
// ---------------------------------------------------------------------------

function ActionRow({
  action,
  index,
  canEdit,
  onChange,
  onDelete,
}: {
  action: PlannedAction;
  index: number;
  canEdit: boolean;
  onChange: (updated: PlannedAction) => void;
  onDelete: () => void;
}) {
  const field = <T extends keyof PlannedAction>(key: T, value: string) =>
    onChange({ ...action, [key]: value });

  return (
    <tr className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
      <td className="p-2 align-top">
        {canEdit ? (
          <Textarea
            value={action.action}
            onChange={e => field('action', e.target.value)}
            className="min-h-[56px] text-xs resize-none"
            placeholder="Descreva a ação..."
          />
        ) : (
          <p className="text-xs leading-relaxed">{action.action}</p>
        )}
      </td>
      <td className="p-2 align-top w-28">
        {canEdit ? (
          <Select value={action.type} onValueChange={v => field('type', v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPE_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-xs">{ACTION_TYPE_OPTIONS.find(o => o.value === action.type)?.label ?? action.type}</p>
        )}
      </td>
      <td className="p-2 align-top w-32">
        {canEdit ? (
          <Input
            value={action.responsible}
            onChange={e => field('responsible', e.target.value)}
            className="h-8 text-xs"
            placeholder="Nome / cargo"
          />
        ) : (
          <p className="text-xs">{action.responsible || <span className="text-muted-foreground">—</span>}</p>
        )}
      </td>
      <td className="p-2 align-top w-28">
        {canEdit ? (
          <Input
            type="date"
            value={action.deadline}
            onChange={e => field('deadline', e.target.value)}
            className="h-8 text-xs"
          />
        ) : (
          <p className="text-xs">
            {action.deadline
              ? format(new Date(action.deadline), 'dd/MM/yyyy')
              : <span className="text-muted-foreground">—</span>}
          </p>
        )}
      </td>
      <td className="p-2 align-top">
        {canEdit ? (
          <Input
            value={action.indicator}
            onChange={e => field('indicator', e.target.value)}
            className="h-8 text-xs"
            placeholder="KPI de sucesso"
          />
        ) : (
          <p className="text-xs">{action.indicator}</p>
        )}
      </td>
      <td className="p-2 align-top w-28">
        {canEdit ? (
          <Select value={action.status} onValueChange={v => field('status', v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_STATUS_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-xs">{ACTION_STATUS_OPTIONS.find(o => o.value === action.status)?.label ?? action.status}</p>
        )}
      </td>
      {canEdit && (
        <td className="p-2 align-top w-8">
          <button
            type="button"
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive transition-colors"
            title="Remover ação"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </td>
      )}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Problem card
// ---------------------------------------------------------------------------

function ProblemCard({
  problem,
  index,
  campaignId,
  canEdit,
  onChange,
  onDelete,
}: {
  problem: ActionPlanProblem;
  index: number;
  campaignId: string;
  canEdit: boolean;
  onChange: (updated: ActionPlanProblem) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(index < 2);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cfg = RISK_CONFIG[problem.risk_level] ?? RISK_CONFIG.aceitavel;

  const completedCount = problem.actions.filter(a => a.status === 'concluida').length;
  const totalCount = problem.actions.length;

  const updateAction = (i: number, updated: PlannedAction) => {
    const actions = problem.actions.map((a, idx) => idx === i ? updated : a);
    onChange({ ...problem, actions });
  };

  const deleteAction = (i: number) => {
    onChange({ ...problem, actions: problem.actions.filter((_, idx) => idx !== i) });
  };

  const addAction = () => {
    const newAction: PlannedAction = {
      id: `act_${problem.dimension_key}_${Date.now()}`,
      type: 'corretiva',
      action: '',
      responsible: '',
      deadline: '',
      resources: '',
      indicator: '',
      status: 'pendente',
    };
    onChange({ ...problem, actions: [...problem.actions, newAction] });
  };

  return (
    <Card className={`border ${cfg.border} transition-shadow hover:shadow-sm`}>
      {/* Card header — clickable to expand */}
      <CardHeader
        className="py-3 px-4 cursor-pointer select-none"
        onClick={() => setExpanded(prev => !prev)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {/* Number badge */}
            <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${cfg.bg} border ${cfg.border}`}>
              <span className={cfg.text}>{index + 1}</span>
            </div>

            {/* Title + risk badge */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`text-xs shrink-0 ${cfg.badgeClass}`}>
                  {cfg.label} · NR {problem.nr}
                </Badge>
                <span className="font-semibold text-sm truncate">
                  {problem.dimension_name}
                </span>
                <span className="text-muted-foreground text-xs hidden sm:block truncate">
                  — {problem.problem_title}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Score: {problem.score.toFixed(2)} · {completedCount}/{totalCount} ações concluídas
              </p>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                window.open(`/api/campaigns/${campaignId}/action-plan/pdf?dimension=${problem.dimension_key}`, '_blank');
              }}
              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Exportar este problema como PDF"
            >
              <Download className="h-3.5 w-3.5" />
            </button>

            {canEdit && !confirmDelete && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
                className="p-1.5 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-destructive"
                title="Excluir problema"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}

            {canEdit && confirmDelete && (
              <div
                className="flex items-center gap-1"
                onClick={e => e.stopPropagation()}
              >
                <span className="text-xs text-destructive font-medium whitespace-nowrap">Excluir?</span>
                <button
                  type="button"
                  onClick={() => onDelete()}
                  className="px-2 py-0.5 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-0.5 text-xs border rounded hover:bg-muted transition-colors"
                >
                  Não
                </button>
              </div>
            )}

            {expanded
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CardHeader>

      {/* Expanded content */}
      {expanded && (
        <CardContent className="pt-0 px-4 pb-4 space-y-4">
          {/* Description */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Descrição do Problema
            </p>
            <p className="text-sm leading-relaxed">{problem.problem_description}</p>
          </div>

          {/* Root causes + impact side-by-side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Causas Raiz
              </p>
              <ul className="space-y-1">
                {problem.root_causes.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-teal-500 mt-0.5">•</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Impacto Esperado
                </p>
                <p className="text-sm">{problem.impact}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Monitoramento
                </p>
                <p className="text-sm">{problem.monitoring}</p>
              </div>
            </div>
          </div>

          {/* Actions matrix */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Matriz de Ações
              </p>
              {canEdit && (
                <Button size="sm" variant="outline" onClick={addAction} className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Nova Ação
                </Button>
              )}
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs min-w-[700px]">
                <thead>
                  <tr className="bg-muted/60">
                    <th className="p-2 text-left font-semibold">Ação</th>
                    <th className="p-2 text-left font-semibold w-28">Tipo</th>
                    <th className="p-2 text-left font-semibold w-32">Responsável</th>
                    <th className="p-2 text-left font-semibold w-28">Prazo</th>
                    <th className="p-2 text-left font-semibold">Indicador</th>
                    <th className="p-2 text-left font-semibold w-28">Status</th>
                    {canEdit && <th className="w-8" />}
                  </tr>
                </thead>
                <tbody>
                  {problem.actions.length === 0 ? (
                    <tr>
                      <td colSpan={canEdit ? 7 : 6} className="p-4 text-center text-muted-foreground text-xs">
                        Nenhuma ação cadastrada.
                      </td>
                    </tr>
                  ) : (
                    problem.actions.map((act, i) => (
                      <ActionRow
                        key={act.id}
                        action={act}
                        index={i}
                        canEdit={canEdit}
                        onChange={updated => updateAction(i, updated)}
                        onDelete={() => deleteAction(i)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legal reference */}
          {problem.legal_reference && (
            <div className="flex items-start gap-2 rounded-md bg-teal-50 border border-teal-100 px-3 py-2">
              <Info className="h-3.5 w-3.5 text-teal-600 mt-0.5 shrink-0" />
              <p className="text-xs text-teal-800">
                <span className="font-semibold">Base Legal:</span> {problem.legal_reference}
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

const DIMENSION_OPTIONS = HSE_DIMENSIONS.map(d => ({ value: d.key, label: d.name }));

const RISK_LEVEL_OPTIONS: { value: string; label: string }[] = [
  { value: 'critico',    label: 'Crítico' },
  { value: 'importante', label: 'Importante' },
  { value: 'moderado',   label: 'Moderado' },
  { value: 'aceitavel',  label: 'Aceitável' },
];

const EMPTY_NEW_PROBLEM = {
  dimension_key: 'demandas',
  risk_level: 'moderado',
  problem_title: '',
  problem_description: '',
};

export function ActionPlanPanel({ campaignId, campaignStatus, canEdit }: ActionPlanPanelProps) {
  const { get, post, patch } = useApi();
  const { success, error: notifyError } = useNotifications();

  const [plan, setPlan] = useState<ActionPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showAddProblem, setShowAddProblem] = useState(false);
  const [newProblem, setNewProblem] = useState(EMPTY_NEW_PROBLEM);

  // ── Load existing plan ──────────────────────────────────────────────────
  const loadPlan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get(`/api/campaigns/${campaignId}/action-plan`);
      if (res.ok) {
        const data = await res.json();
        setPlan(data);
        if (data.updated_at) setLastSaved(new Date(data.updated_at));
      }
      // 404 = not generated yet — that's fine
    } finally {
      setLoading(false);
    }
  }, [campaignId, get]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  // Cleanup debounce timer on unmount
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  // ── Generate via LLM ────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await post(`/api/campaigns/${campaignId}/hse-agent`, {});
      if (!res.ok) {
        const data = await res.json();
        notifyError(data.error ?? 'Falha ao gerar plano de ação');
        return;
      }
      const data = await res.json();
      setPlan(data);
      if (data.updated_at) setLastSaved(new Date(data.updated_at));
      success('Plano de ação gerado com sucesso!');
    } finally {
      setGenerating(false);
    }
  };

  // ── Auto-save (debounced 1.5s) ──────────────────────────────────────────
  const scheduleSave = useCallback((problems: ActionPlanProblem[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const res = await patch(`/api/campaigns/${campaignId}/action-plan`, { problems });
        if (res.ok) {
          setLastSaved(new Date());
        }
      } finally {
        setSaving(false);
      }
    }, 1500);
  }, [campaignId, patch]);

  const handleProblemChange = useCallback((index: number, updated: ActionPlanProblem) => {
    setPlan(prev => {
      if (!prev) return prev;
      const problems = prev.problems.map((p, i) => i === index ? updated : p);
      scheduleSave(problems);
      return { ...prev, problems };
    });
  }, [scheduleSave]);

  const handleProblemDelete = useCallback((index: number) => {
    setPlan(prev => {
      if (!prev) return prev;
      const problems = prev.problems.filter((_, i) => i !== index);
      scheduleSave(problems);
      return { ...prev, problems };
    });
  }, [scheduleSave]);

  const handleAddProblem = useCallback(() => {
    const dim = HSE_DIMENSIONS.find(d => d.key === newProblem.dimension_key)!;
    const created: ActionPlanProblem = {
      id: `prob_manual_${Date.now()}`,
      dimension_key: newProblem.dimension_key,
      dimension_name: dim?.name ?? newProblem.dimension_key,
      risk_level: newProblem.risk_level as ActionPlanProblem['risk_level'],
      score: 0,
      nr: 0,
      problem_title: newProblem.problem_title.trim(),
      problem_description: newProblem.problem_description.trim(),
      root_causes: [],
      impact: '',
      legal_reference: '',
      monitoring: '',
      actions: [],
    };
    setPlan(prev => {
      if (!prev) return prev;
      const problems = [...prev.problems, created];
      scheduleSave(problems);
      return { ...prev, problems };
    });
    setNewProblem(EMPTY_NEW_PROBLEM);
    setShowAddProblem(false);
    success('Problema adicionado.');
  }, [newProblem, scheduleSave, success]);

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3 py-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  // ── Not closed campaign ─────────────────────────────────────────────────
  if (campaignStatus !== 'closed') {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
          <Shield className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm text-center">
            O plano de ação está disponível somente para campanhas encerradas.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── No plan yet ─────────────────────────────────────────────────────────
  if (!plan) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-14 gap-4">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <div className="text-center space-y-1">
            <p className="font-semibold">Gerar Plano de Ação com IA</p>
            <p className="text-sm text-muted-foreground max-w-md">
              A IA irá analisar os resultados da campanha e gerar um plano de ação detalhado
              com medidas corretivas, preventivas e de contingência para cada dimensão de risco.
            </p>
          </div>
          {canEdit ? (
            <Button onClick={handleGenerate} disabled={generating} size="lg">
              {generating ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Gerando plano...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar Plano de Ação
                </>
              )}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Somente ADM ou RH podem gerar o plano.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Plan exists ─────────────────────────────────────────────────────────
  const criticalCount   = plan.problems.filter(p => p.risk_level === 'critico').length;
  const importantCount  = plan.problems.filter(p => p.risk_level === 'importante').length;
  const moderateCount   = plan.problems.filter(p => p.risk_level === 'moderado').length;
  const acceptableCount = plan.problems.filter(p => p.risk_level === 'aceitavel').length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Stats */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-sm">
                <span className="font-medium">Plano de Ação</span>
                <span className="text-muted-foreground ml-2 text-xs">
                  {plan.problems.length} dimensões · gerado {format(new Date(plan.generated_at), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {criticalCount > 0 && (
                  <Badge className="text-xs bg-violet-700 text-white">{criticalCount} Crítico</Badge>
                )}
                {importantCount > 0 && (
                  <Badge className="text-xs bg-red-500 text-white">{importantCount} Importante</Badge>
                )}
                {moderateCount > 0 && (
                  <Badge className="text-xs bg-amber-500 text-white">{moderateCount} Moderado</Badge>
                )}
                {acceptableCount > 0 && (
                  <Badge className="text-xs bg-teal-600 text-white">{acceptableCount} Aceitável</Badge>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {saving && (
                <span className="text-xs text-muted-foreground animate-pulse">Salvando...</span>
              )}
              {!saving && lastSaved && (
                <span className="text-xs text-muted-foreground">
                  Salvo {format(lastSaved, "HH:mm", { locale: ptBR })}
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`/api/campaigns/${campaignId}/action-plan/pdf`, '_blank')}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Exportar PDF
              </Button>
              {canEdit && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setShowAddProblem(true)}
                >
                  <FilePlus className="h-3.5 w-3.5 mr-1.5" />
                  Adicionar Problema
                </Button>
              )}
            </div>
          </div>

          {plan.model_used && (
            <p className="text-xs text-muted-foreground mt-2">
              Modelo: <span className="font-mono">{plan.model_used}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Problem cards */}
      {plan.problems.map((problem, i) => (
        <ProblemCard
          key={problem.id}
          problem={problem}
          index={i}
          campaignId={campaignId}
          canEdit={canEdit}
          onChange={updated => handleProblemChange(i, updated)}
          onDelete={() => handleProblemDelete(i)}
        />
      ))}

      {plan.problems.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 gap-2">
            <FilePlus className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum problema no plano. Adicione um manualmente.</p>
          </CardContent>
        </Card>
      )}

      {/* Dialog: add problem manually */}
      <Dialog open={showAddProblem} onOpenChange={setShowAddProblem}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FilePlus className="h-4 w-4 text-primary" />
              Adicionar Problema Manualmente
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Dimensão
                </label>
                <Select
                  value={newProblem.dimension_key}
                  onValueChange={v => setNewProblem(p => ({ ...p, dimension_key: v }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIMENSION_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value} className="text-sm">{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Nível de Risco
                </label>
                <Select
                  value={newProblem.risk_level}
                  onValueChange={v => setNewProblem(p => ({ ...p, risk_level: v }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RISK_LEVEL_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value} className="text-sm">{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Título do Problema <span className="text-destructive">*</span>
              </label>
              <Input
                value={newProblem.problem_title}
                onChange={e => setNewProblem(p => ({ ...p, problem_title: e.target.value }))}
                placeholder="Ex: Sobrecarga de trabalho e falta de autonomia"
                className="text-sm"
                maxLength={120}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Descrição
              </label>
              <Textarea
                value={newProblem.problem_description}
                onChange={e => setNewProblem(p => ({ ...p, problem_description: e.target.value }))}
                placeholder="Descreva o problema identificado, contexto e evidências..."
                className="text-sm min-h-[88px] resize-none"
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowAddProblem(false); setNewProblem(EMPTY_NEW_PROBLEM); }}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleAddProblem}
              disabled={!newProblem.problem_title.trim()}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
