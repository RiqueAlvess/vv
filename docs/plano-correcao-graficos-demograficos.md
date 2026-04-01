# Plano de correção — confronto técnico dos gráficos (branch `claude/add-demographic-charts-IW9ZQ` vs branch atual)

## Objetivo
Explicar **frente a frente** por que, hoje, vários gráficos aparecem zerados ou ausentes (não apenas os demográficos), e propor um plano de correção para garantir que **todos os gráficos da branch original** continuem funcionando na branch atual.

---

## 1) Diagnóstico consolidado (o que está acontecendo)

O problema atual é composto por **duas causas estruturais**:

1. **Leitura prioritária de cache para campanhas `closed`**.
   - A rota retorna cache antes de recalcular.
   - Em `closed`, esse cache é servido sempre (imutável).

2. **Incompatibilidade de shape entre quem escreve cache e quem lê cache**.
   - A rota de dashboard (cálculo “live”) grava um formato A.
   - O worker/`metrics.service` grava um formato B (legado/diferente).
   - O `buildPayloadFromCache` espera formato A; quando recebe B, vários campos caem em `[]`, `{}` ou `0` por default.

Resultado prático: gráficos inteiros podem vir vazios/zerados mesmo com respostas na campanha.

---

## 2) Confronto de código “frente a frente”

## 2.1 Fonte da verdade (payload esperado pela UI)
Na rota principal de dashboard, o payload completo contém (entre outros):
- `dimension_analysis`,
- `stacked_by_dimension`,
- `stacked_by_question`,
- `heatmap`,
- `position_table`,
- `gender_risk`, `age_risk`.

Esses campos são montados explicitamente no `payload` da rota.  

## 2.2 Leitura de cache (como a API responde quando usa cache)
O `buildPayloadFromCache` busca:
- `dimension_analysis <- cached.dimension_scores`
- `stacked_by_dimension <- rd.stacked_by_dimension`
- `stacked_by_question <- rd.stacked_by_question`
- `top_sectors_by_nr <- tc.top_sectors_by_nr`
- `top_positions_by_nr <- tc.top_positions_by_nr`
- `gender_distribution <- dd.gender_distribution`
- `age_distribution <- dd.age_distribution`
- `gender_risk <- cached.scores_by_gender`
- `age_risk <- cached.scores_by_age`

Se não encontrar, usa fallback (`[]`, `{}`, `0`).

## 2.3 Escrita de cache pela rota (formato A — compatível)
A própria rota grava no cache:
- `dimension_scores = dimensionAnalysis` (array de objetos),
- `risk_distribution` contendo `stacked_by_dimension`, `stacked_by_question`, `workers_*`, `igrp_*`,
- `top_critical_sectors` como objeto com `top_sectors_by_nr` e `top_positions_by_nr`,
- `scores_by_gender` e `scores_by_age` no formato esperado pelos gráficos demográficos.

## 2.4 Escrita de cache pelo worker/metrics (formato B — incompatível parcial)
`calculateAndStoreCampaignMetrics` salva dados diferentes:
- `dimension_scores = getDimensionScores()` (mapa `{dim: number}` em vez de array esperado pela UI),
- `risk_distribution = getRiskDistribution()` (apenas contagem por risco, sem `stacked_by_dimension`/`stacked_by_question`/`igrp_*`),
- `top_critical_sectors = getTopCriticalSectors()` (array direto, não objeto com chaves `top_sectors_by_nr` e `top_positions_by_nr`),
- `scores_by_gender`/`scores_by_age` como `Record<string, Record<string, number>>`, mas os componentes demográficos atuais esperam lista de itens (`GenderData[]`/`AgeData[]`).

---

## 3) Impacto por gráfico (o que quebra e por quê)

| Área / Gráfico | Branch original (`claude/add-demographic-charts-IW9ZQ`) | Branch atual com cache incompatível | Sintoma visto |
|---|---|---|---|
| Distribuição de Risco por Dimensão | vinha de payload live | `stacked_by_dimension` pode cair em `[]` ao ler cache legado | gráfico vazio/zerado |
| Distribuição de Risco por Questão | vinha de payload live | `stacked_by_question` pode cair em `[]` | gráfico vazio/zerado |
| Heatmap NR × Unidade | vinha com estrutura própria da rota | `heatmap_data` pode ter shape diferente do componente | heatmap sem informação útil |
| Análise Detalhada por Cargo | `position_table` calculado na rota | pode receber `top_critical_groups` de outra semântica | tabela inconsistente/“zerada” |
| Demográficos (Gênero/Faixa Etária) | arrays de objetos por grupo | podem vir em formato de mapa ou arrays vazios | cards ausentes ou sem barras |

> Conclusão: o “zerado geral” e o “faltando demográfico” são manifestações do **mesmo problema de contrato de dados + cache fechado imutável**.

---

## 4) Plano de correção proposto

## Fase A — Corrigir contrato de dados (prioridade máxima)
1. **Definir um schema único de payload de dashboard (v2)**
   - Criar tipo/validador único para: `dimension_analysis`, `stacked_by_dimension`, `stacked_by_question`, `heatmap`, `position_table`, `gender_risk`, `age_risk`.

2. **Unificar escritores de cache**
   - Reaproveitar a mesma função de serialização tanto na rota quanto no worker.
   - Proibir gravação “shape B”.

3. **Versionar cache (`payload_version`)**
   - Leitor só serve cache com versão suportada.
   - Versão antiga dispara rebuild automático.

## Fase B — Tratar legados (para recuperar campanhas já fechadas)
4. **Backfill idempotente em `campaign_metrics`**
   - Encontrar registros com versão antiga ou shape incompatível.
   - Recalcular e persistir no formato v2.

5. **Fallback seguro na leitura**
   - Se campanha `closed` tiver cache inválido/incompleto, recalcular em tempo real e atualizar cache antes de responder.

## Fase C — Blindagem de UI
6. **Não ocultar seção inteira silenciosamente**
   - Em vez de sumir blocos críticos, mostrar estado explícito (“dados indisponíveis / suprimidos / em reparo”).

7. **Adaptador temporário de shape**
   - Até concluir backfill total, adaptar maps legados para arrays esperados pelos componentes (demográficos, dimensões etc.).

## Fase D — Qualidade
8. **Testes de contrato (API)**
   - Cache v2 válido: serve cache sem recalcular.
   - Cache legado: detecta incompatibilidade e reprocessa.

9. **Testes de regressão visual/funcional (UI)**
   - Garantir render de todos os blocos citados: Dimensão, Questão, Heatmap, Cargo, Demográficos.

10. **Métricas e observabilidade**
   - Logar motivo de rebuild (`version_mismatch`, `missing_keys`, `shape_mismatch`).

---

## 5) Critérios de aceite (o que você pode cobrar na aprovação)
- Nenhum gráfico principal do dashboard fica zerado por causa de shape/cache.
- Demográficos (Gênero e Faixa Etária) aparecem quando houver base válida; com supressão LGPD, exibem estado correto.
- Campanhas fechadas antigas voltam a renderizar corretamente após backfill.
- Rota e worker passam a produzir exatamente o mesmo contrato de payload.

---

## 6) Resumo executivo
O problema não é só “demográfico”: há uma divergência estrutural entre **como o cache é escrito** e **como ele é lido/renderizado**. Isso explica tanto gráficos zerados (dimensão/questão/heatmap/cargo) quanto gráficos faltantes (demográficos). A correção real é padronizar contrato, versionar cache e executar backfill.
