# Análise técnica — por que o dashboard mostra 99%/100% em risco por gênero/faixa etária

## Contexto
No payload analisado da campanha `CampanhaDemo1`, os blocos **Risco por Gênero**, **Risco por Faixa Etária** e o KPI **Em Risco Alto** aparecem em ~99%/100%.

Exemplo observado:
- `gender_risk[*].critical_pct`: 99–100
- `age_risk[*].critical_pct`: 99–100
- `workers_high_risk_pct`: 100

---

## 3 causas-raiz (os “3 erros”)

## 1) Erro de definição semântica (label x cálculo)
O backend calcula `critical_pct` como **percentual de avaliações** em alto risco (`respondente × dimensão`), não como percentual de **trabalhadores** em alto risco.

Hoje a fórmula no backend é:
- denominador: `totalEvaluations` (cada pessoa conta 7 vezes, uma por dimensão)
- numerador: `highRiskEvaluations` (`NR >= 9` por dimensão)

Isso está implementado tanto para gênero/idade quanto no KPI geral. Ou seja, o texto “trabalhadores” induz uma leitura errada do indicador. O componente de donut inclusive já descreve corretamente como “% de avaliações (respondente × dimensão)”.【F:src/app/api/campaigns/[id]/dashboard/route.ts†L182-L221】【F:src/app/api/campaigns/[id]/dashboard/route.ts†L236-L288】【F:src/components/dashboard/charts/workers-risk-donut.tsx†L22-L26】【F:src/components/dashboard/charts/kpi-row.tsx†L65-L69】

## 2) Erro de consistência entre widgets (métrica não bate com distribuição)
No mesmo payload, `stacked_by_dimension` indica vários percentuais moderados/aceitáveis por dimensão (ou seja, não poderia resultar naturalmente em 99–100% de “alto risco” em todas as quebras). Isso sinaliza **inconsistência de contrato/cache** entre datasets do dashboard.

Esse cenário já foi documentado no projeto: campanhas fechadas podem servir cache com shape diferente do esperado, gerando métricas incoerentes entre blocos (uns com cálculo novo, outros com cache legado).【F:docs/plano-correcao-graficos-demograficos.md†L7-L16】【F:docs/plano-correcao-graficos-demograficos.md†L37-L56】

## 3) Erro de apresentação/precisão (arredondamento e percepção)
Os percentuais são arredondados com `Math.round`, o que comprime variações pequenas e pode “colar” grupos em 99/100 no topo visual. Além disso, a UI usa escala de cor que pinta vermelho já em valores altos, reforçando percepção de “tudo crítico”, mesmo quando o indicador é uma taxa de avaliações agregadas.

No backend o arredondamento para inteiro é explícito para gênero/idade e KPI geral.【F:src/app/api/campaigns/[id]/dashboard/route.ts†L237-L241】【F:src/app/api/campaigns/[id]/dashboard/route.ts†L266-L270】【F:src/app/api/campaigns/[id]/dashboard/route.ts†L177-L181】

---

## Diagnóstico objetivo

Em resumo, o 99%/100% não parece ser “um único bug”, e sim a soma de:
1. **Métrica calculada por avaliação**, mas comunicada como se fosse por trabalhador.
2. **Inconsistência entre blocos** por possível cache/shape legado em campanhas closed.
3. **Arredondamento inteiro** + visualização que amplifica extremos.

---

## Plano de ação (ordem recomendada)

## Fase 1 — Corrigir contrato do indicador (rápido, alto impacto)
1. Renomear no payload e na UI:
   - `critical_pct` -> `high_risk_eval_pct` (quando for avaliação)
   - `workers_high_risk_pct` -> `high_risk_eval_pct_global` (ou equivalente)
2. Ajustar rótulos dos cards para “% de avaliações” (se mantiver a métrica atual).

## Fase 2 — Entregar a métrica de negócio esperada (por trabalhador)
3. Criar **nova métrica por respondente**:
   - trabalhador em alto risco = possui pelo menos uma dimensão com `NR >= 9`.
   - fórmula: `workers_high_risk_pct = responded_high_risk / total_responded`.
4. Exibir as duas visões (opcional, recomendado):
   - `% avaliações em risco` (intensidade)
   - `% trabalhadores com ao menos 1 dimensão em risco` (prevalência)

## Fase 3 — Sanear consistência de cache
5. Versionar payload de cache e invalidar/rebuild de versões antigas.
6. Bloquear leitura de cache sem chaves mínimas obrigatórias (`stacked_by_dimension`, `gender_risk`, `age_risk`, etc.).
7. Rodar backfill para campanhas `closed` antigas.

## Fase 4 — Melhorar leitura analítica
8. Mostrar 1 casa decimal (ex.: 99,4%) em vez de inteiro.
9. Incluir tooltip com numerador/denominador (ex.: `5612 / 5684 avaliações`).
10. Destacar claramente no subtítulo qual é a unidade de cálculo (avalição vs trabalhador).

---

## Critérios de aceite
- KPI “Em Risco Alto” e gráficos demográficos usam a **mesma definição** de indicador.
- O usuário consegue identificar no card se o percentual é por avaliação ou por trabalhador.
- Após rebuild de cache, não há divergência lógica entre:
  - `% em risco` e
  - distribuição por dimensão/pergunta.
- Variações entre grupos deixam de ficar “achatadas” em 99/100 por arredondamento.
