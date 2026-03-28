export interface ChecklistItem {
  id: string;
  text: string;
}

export interface ChecklistStage {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export const CHECKLIST_STAGES: ChecklistStage[] = [
  {
    id: 'stage-1',
    title: 'Etapa 1 — Planejamento da Avaliação',
    items: [
      { id: 's1-01', text: 'Definir equipe responsável pela gestão dos riscos psicossociais' },
      { id: 's1-02', text: 'Estabelecer cronograma da campanha de avaliação' },
      { id: 's1-03', text: 'Comunicar colaboradores sobre a realização da pesquisa e garantia de anonimato' },
      { id: 's1-04', text: 'Obter aprovação da liderança para condução do processo' },
      { id: 's1-05', text: 'Definir setores e unidades participantes' },
    ],
  },
  {
    id: 'stage-2',
    title: 'Etapa 2 — Coleta de Dados',
    items: [
      { id: 's2-01', text: 'Importar lista de colaboradores (CSV) com unidade, setor e cargo' },
      { id: 's2-02', text: 'Enviar convites por e-mail para todos os colaboradores elegíveis' },
      { id: 's2-03', text: 'Monitorar taxa de resposta durante o período da campanha' },
      { id: 's2-04', text: 'Garantir taxa de resposta mínima de 50% para validade estatística' },
      { id: 's2-05', text: 'Encerrar campanha após o período definido' },
    ],
  },
  {
    id: 'stage-3',
    title: 'Etapa 3 — Análise e Avaliação dos Riscos',
    items: [
      { id: 's3-01', text: 'Gerar relatório consolidado das 7 dimensões HSE-IT' },
      { id: 's3-02', text: 'Identificar dimensões com risco crítico (nível ≥ 3,1 para negativas)' },
      { id: 's3-03', text: 'Identificar setores com maior exposição ao risco' },
      { id: 's3-04', text: 'Calcular IGRP (Índice Geral de Risco Psicossocial)' },
      { id: 's3-05', text: 'Documentar resultados no Programa de Gerenciamento de Riscos (PGR)' },
      { id: 's3-06', text: 'Exportar relatório PDF para arquivo e conformidade NR-1' },
    ],
  },
  {
    id: 'stage-4',
    title: 'Etapa 4 — Elaboração do Plano de Ação',
    items: [
      { id: 's4-01', text: 'Priorizar riscos críticos e importantes para ação imediata' },
      { id: 's4-02', text: 'Definir medidas de controle para cada dimensão de risco identificada' },
      { id: 's4-03', text: 'Atribuir responsáveis e prazos para cada ação' },
      { id: 's4-04', text: 'Apresentar plano de ação à liderança e CIPA (se houver)' },
      { id: 's4-05', text: 'Incluir plano de ação no PGR da empresa' },
    ],
  },
  {
    id: 'stage-5',
    title: 'Etapa 5 — Implementação das Medidas',
    items: [
      { id: 's5-01', text: 'Iniciar execução das medidas de controle conforme cronograma' },
      { id: 's5-02', text: 'Comunicar colaboradores sobre as ações sendo tomadas' },
      { id: 's5-03', text: 'Registrar evidências das intervenções realizadas' },
      { id: 's5-04', text: 'Realizar treinamentos ou capacitações previstas no plano' },
    ],
  },
  {
    id: 'stage-6',
    title: 'Etapa 6 — Monitoramento e Revisão',
    items: [
      { id: 's6-01', text: 'Definir indicadores para acompanhamento da eficácia das medidas' },
      { id: 's6-02', text: 'Agendar próxima avaliação periódica (mínimo anual conforme NR-1)' },
      { id: 's6-03', text: 'Registrar no PGR a data da última avaliação e resultados' },
      { id: 's6-04', text: 'Arquivar documentação por no mínimo 20 anos (NR-1 §1.4.3)' },
    ],
  },
];

export const TOTAL_ITEMS = CHECKLIST_STAGES.reduce((sum, s) => sum + s.items.length, 0);
