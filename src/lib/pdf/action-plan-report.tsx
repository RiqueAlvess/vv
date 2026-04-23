import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ActionPlanProblem } from '@/lib/hse-agent';

const RISK_COLORS = {
  aceitavel:  '#0D9488',
  moderado:   '#F59E0B',
  importante: '#EF4444',
  critico:    '#7C3AED',
} as const;

const ACTION_TYPE_LABELS: Record<string, string> = {
  corretiva:    'Corretiva',
  preventiva:   'Preventiva',
  contingencia: 'Contingência',
  paliativa:    'Paliativa',
};

const STATUS_LABELS: Record<string, string> = {
  pendente:      'Pendente',
  em_andamento:  'Em andamento',
  concluida:     'Concluída',
};

const BRAND = {
  primary:      '#0D3D4F',
  primaryLight: '#1B5F75',
  accent:       '#00C896',
  accentLight:  '#E8FBF5',
  white:        '#FFFFFF',
  textMuted:    '#475569',
  textLight:    '#94a3b8',
  bg:           '#F8FAFC',
  border:       '#E2E8F0',
};

const RISK_LABELS: Record<string, string> = {
  aceitavel:  'Aceitável',
  moderado:   'Moderado',
  importante: 'Importante',
  critico:    'Crítico',
};

const s = StyleSheet.create({
  page:           { fontFamily: 'Helvetica', fontSize: 9, padding: 36, color: '#1e293b', backgroundColor: BRAND.white },
  header:         { marginBottom: 18, borderBottom: `2pt solid ${BRAND.accent}`, paddingBottom: 10 },
  docTitle:       { fontSize: 15, fontFamily: 'Helvetica-Bold', color: BRAND.primary, marginBottom: 2 },
  docMeta:        { fontSize: 8.5, color: BRAND.textMuted },
  section:        { marginTop: 14 },
  problemCard:    { marginBottom: 14, border: `1pt solid ${BRAND.border}`, borderRadius: 4, overflow: 'hidden' },
  problemHeader:  { flexDirection: 'row', alignItems: 'center', padding: '7 10', gap: 8 },
  riskBadge:      { borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2 },
  riskBadgeText:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: BRAND.white },
  problemTitle:   { fontSize: 10, fontFamily: 'Helvetica-Bold', color: BRAND.white, flex: 1 },
  scoreRow:       { fontSize: 8, color: BRAND.white, opacity: 0.85 },
  bodyPad:        { padding: '8 10' },
  label:          { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: BRAND.primary, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  bodyText:       { fontSize: 8.5, color: '#334155', lineHeight: 1.45 },
  causeItem:      { flexDirection: 'row', gap: 4, marginBottom: 2 },
  bullet:         { fontSize: 8.5, color: BRAND.accent },
  divider:        { borderBottom: `0.5pt solid ${BRAND.border}`, marginVertical: 8 },
  tableHeader:    { flexDirection: 'row', backgroundColor: BRAND.primary, padding: '4 6' },
  tableRow:       { flexDirection: 'row', padding: '4 6', borderBottom: `0.5pt solid ${BRAND.border}` },
  tableRowAlt:    { flexDirection: 'row', padding: '4 6', borderBottom: `0.5pt solid ${BRAND.border}`, backgroundColor: BRAND.bg },
  thText:         { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: BRAND.white },
  tdText:         { fontSize: 8, color: '#334155' },
  colAction:      { flex: 3 },
  colType:        { width: 60 },
  colResp:        { width: 70 },
  colDeadline:    { width: 55 },
  colIndicator:   { flex: 2 },
  colStatus:      { width: 55 },
  legalBox:       { backgroundColor: BRAND.accentLight, padding: '6 8', borderLeft: `3pt solid ${BRAND.accent}`, marginTop: 8 },
  legalText:      { fontSize: 8, color: BRAND.primary },
  footer:         { position: 'absolute', bottom: 24, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: BRAND.textLight, borderTop: `0.5pt solid ${BRAND.border}`, paddingTop: 5 },
  kpiRow:         { flexDirection: 'row', gap: 12, marginBottom: 14 },
  kpiBox:         { flex: 1, backgroundColor: BRAND.bg, border: `1pt solid ${BRAND.border}`, borderRadius: 4, padding: '7 10' },
  kpiValue:       { fontSize: 18, fontFamily: 'Helvetica-Bold', color: BRAND.primary },
  kpiLabel:       { fontSize: 7.5, color: BRAND.textMuted, marginTop: 1 },
});

interface ActionPlanPDFProps {
  companyName: string;
  campaignName: string;
  generatedAt: string;
  problems: ActionPlanProblem[];
  filterDimensionKey?: string; // if set, only renders this dimension
  igrp?: number;
  igrpLabel?: string;
  totalResponded?: number;
}

function ProblemSection({ problem, index }: { problem: ActionPlanProblem; index: number }) {
  const bgColor = RISK_COLORS[problem.risk_level] ?? BRAND.primary;

  return (
    <View style={s.problemCard} wrap={false}>
      {/* Header */}
      <View style={[s.problemHeader, { backgroundColor: bgColor }]}>
        <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: BRAND.white, width: 20 }}>
          {index + 1}.
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={s.problemTitle}>{problem.dimension_name} — {problem.problem_title}</Text>
          <Text style={s.scoreRow}>
            Score: {problem.score.toFixed(2)} | NR: {problem.nr} | Risco: {RISK_LABELS[problem.risk_level] ?? problem.risk_level}
          </Text>
        </View>
      </View>

      {/* Body */}
      <View style={s.bodyPad}>
        {/* Description */}
        <Text style={s.label}>Descrição do Problema</Text>
        <Text style={s.bodyText}>{problem.problem_description}</Text>

        <View style={s.divider} />

        {/* Root causes + Impact row */}
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Causas Raiz</Text>
            {problem.root_causes.map((c, i) => (
              <View key={i} style={s.causeItem}>
                <Text style={s.bullet}>•</Text>
                <Text style={s.bodyText}>{c}</Text>
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Impacto Esperado</Text>
            <Text style={s.bodyText}>{problem.impact}</Text>
            <View style={{ marginTop: 8 }}>
              <Text style={s.label}>Monitoramento</Text>
              <Text style={s.bodyText}>{problem.monitoring}</Text>
            </View>
          </View>
        </View>

        <View style={s.divider} />

        {/* Actions table */}
        <Text style={[s.label, { marginBottom: 4 }]}>Matriz de Ações</Text>
        <View style={s.tableHeader}>
          <Text style={[s.thText, s.colAction]}>Ação</Text>
          <Text style={[s.thText, s.colType]}>Tipo</Text>
          <Text style={[s.thText, s.colResp]}>Responsável</Text>
          <Text style={[s.thText, s.colDeadline]}>Prazo</Text>
          <Text style={[s.thText, s.colIndicator]}>Indicador</Text>
          <Text style={[s.thText, s.colStatus]}>Status</Text>
        </View>
        {problem.actions.map((act, i) => (
          <View key={act.id} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
            <Text style={[s.tdText, s.colAction]}>{act.action}</Text>
            <Text style={[s.tdText, s.colType]}>{ACTION_TYPE_LABELS[act.type] ?? act.type}</Text>
            <Text style={[s.tdText, s.colResp]}>{act.responsible || '—'}</Text>
            <Text style={[s.tdText, s.colDeadline]}>{act.deadline || '—'}</Text>
            <Text style={[s.tdText, s.colIndicator]}>{act.indicator}</Text>
            <Text style={[s.tdText, s.colStatus]}>{STATUS_LABELS[act.status] ?? act.status}</Text>
          </View>
        ))}

        {/* Legal reference */}
        {problem.legal_reference && (
          <View style={s.legalBox}>
            <Text style={s.legalText}>Base Legal: {problem.legal_reference}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export function ActionPlanPDFDocument({
  companyName,
  campaignName,
  generatedAt,
  problems,
  filterDimensionKey,
  igrp,
  igrpLabel,
  totalResponded,
}: ActionPlanPDFProps) {
  const displayed = filterDimensionKey
    ? problems.filter(p => p.dimension_key === filterDimensionKey)
    : problems;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.docTitle}>
            Plano de Ação — Riscos Psicossociais{filterDimensionKey ? ` (${displayed[0]?.dimension_name ?? ''})` : ''}
          </Text>
          <Text style={s.docMeta}>
            {companyName} · {campaignName} · Gerado em {generatedAt}
          </Text>
        </View>

        {/* Summary KPIs (only on full report) */}
        {!filterDimensionKey && igrp !== undefined && (
          <View style={s.kpiRow}>
            <View style={s.kpiBox}>
              <Text style={s.kpiValue}>{igrp.toFixed(1)}</Text>
              <Text style={s.kpiLabel}>IGRP — {igrpLabel}</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiValue}>{problems.filter(p => p.risk_level === 'critico').length}</Text>
              <Text style={s.kpiLabel}>Dimensões Críticas</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiValue}>{problems.filter(p => p.risk_level === 'importante').length}</Text>
              <Text style={s.kpiLabel}>Dimensões Importantes</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={[s.kpiValue, { fontSize: 14 }]}>{totalResponded ?? 0}</Text>
              <Text style={s.kpiLabel}>Respondentes</Text>
            </View>
          </View>
        )}

        {/* Problems */}
        {displayed.map((problem, i) => (
          <ProblemSection key={problem.id} problem={problem} index={i} />
        ))}

        {/* Footer */}
        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) =>
            `${companyName} · Plano de Ação NR-1 · Página ${pageNumber} de ${totalPages} · Confidencial`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
