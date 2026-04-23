'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApi } from '@/hooks/use-api';
import { useNotifications } from '@/hooks/use-notifications';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Sparkles, ChevronDown, ChevronUp, Download,
  RefreshCw, Save, AlertTriangle, CheckCircle2,
  Info, Shield, Plus, Trash2,
} from 'lucide-react';
import type { ActionPlanProblem, PlannedAction, ActionType, ActionStatus } from '@/lib/hse-agent';

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
}: {
  problem: ActionPlanProblem;
  index: number;
  campaignId: string;
  canEdit: boolean;
  onChange: (updated: ActionPlanProblem) => void;
}) {
  const [expanded, setExpanded] = useState(index < 2);
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

export function ActionPlanPanel({ campaignId, campaignStatus, canEdit }: ActionPlanPanelProps) {
  const { get, post, patch } = useApi();
  const { success, error: notifyError } = useNotifications();

  const [plan, setPlan] = useState<ActionPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
                Exportar PDF completo
              </Button>
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  {generating ? (
                    <div className="h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-1.5" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Regenerar
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
        />
      ))}
    </div>
  );
}
