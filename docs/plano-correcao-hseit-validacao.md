# Validação do Relatório Técnico + Plano de Correção (HSE-IT)

## 1) Parecer técnico sobre o relatório

**Resumo do parecer:** o relatório está **majoritariamente correto** na direção técnica e metodológica, sobretudo em polaridade, escala Likert, necessidade de distribuição por faixas e risco de inflação por agregação incorreta. Porém, há pontos que precisam de **formalização de regra** para evitar ambiguidades na implementação (principalmente severidade e deduplicação por trabalhador).

### 1.1 Pontos corretos (confirmados)

1. **Polaridade é fator crítico e pode gerar falso positivo**.
   - Está correto: `Demandas` e `Relacionamentos` são fatores de polaridade negativa (score alto = pior risco).
   - Está correto: `Controle`, `Apoio chefia`, `Apoio colegas`, `Cargo`, `Mudanças` são fatores positivos (score baixo = pior risco).
   - Consequência prática correta: sem tratar polaridade, o sistema tende a classificar incorretamente grupos com score alto em dimensões positivas como “críticos”.

2. **A escala base deve ser 0–4**.
   - Está correto que a metodologia informada usa Likert 0 a 4.
   - Se o banco persistir 1–5 sem normalização, ocorre deslocamento sistemático e viés de risco.

3. **Média única não atende gráficos de distribuição**.
   - Correto: para barras empilhadas por dimensão/questão, o backend deve enviar distribuição por faixas (verde/amarelo/laranja/vermelho), e não apenas média agregada.

4. **Risco de inflar “% trabalhadores em risco” por contagem de avaliações**.
   - Correto: o indicador populacional deve usar **trabalhadores únicos** no denominador e regra explícita de deduplicação no numerador.

### 1.2 Pontos corretos com ressalva de implementação

1. **Uso da matriz NR = P × S**.
   - Correto conceitualmente.
   - **Ressalva:** o relatório aponta ausência de severidade no backend, mas isso precisa ser confirmado no código atual antes de concluir definitivamente.

2. **`if (nr >= 13)` pode estar certo ou errado dependendo da origem do `nr`**.
   - A regra de corte para “Crítico” está correta (13–16).
   - O possível erro está em **como o `nr` foi calculado antes**, não no corte em si.

3. **Inversão matemática em fatores positivos (`4 - resposta`)**.
   - Válido como estratégia de normalização para unificar interpretação.
   - Alternativa equivalente: manter score original e aplicar tabela de corte específica por polaridade.
   - Importante: escolher uma única estratégia e padronizar em toda a pipeline.

### 1.3 Lacunas no relatório que precisam virar decisão técnica

1. **Regra oficial de Severidade (S)**.
   - É necessário definir se S vem de:
     - campo explícito de avaliação clínica/ocupacional;
     - proxy por faixa de score;
     - regra contextual por dimensão/setor.
   - Sem essa decisão, NR final fica inconsistente entre telas.

2. **Critério de trabalhador “em risco alto/crítico”**.
   - Definir formalmente se o trabalhador entra no numerador quando:
     - tiver **ao menos uma dimensão** com `NR >= 9`; ou
     - média global `NR >= 9`; ou
     - percentual mínimo de dimensões críticas.

3. **Ponderação do IGRP**.
   - Definir se é média simples por dimensão, média ponderada por nº de itens, por nº de respondentes, ou matriz híbrida.

---

## 2) Regras de negócio consolidadas (baseline de correção)

## 2.1 Dimensões HSE-IT (35 itens)
- **Demandas:** 3, 6, 9, 12, 16, 18, 20, 22
- **Controle:** 2, 10, 15, 19, 25, 30
- **Apoio da chefia:** 8, 23, 29, 33, 35
- **Apoio dos colegas:** 7, 24, 27, 31
- **Relacionamentos:** 5, 14, 21, 34
- **Cargo (papel/função):** 1, 4, 11, 13, 17
- **Comunicação/Mudanças:** 26, 28, 32

## 2.2 Cálculo por dimensão
1. Normalizar escala para **0–4** (se entrada for 1–5: `valor_normalizado = valor - 1`).
2. Calcular score da dimensão: `score = soma_respostas / número_de_itens`.
3. Classificar conforme polaridade:
   - **Negativas (Demandas/Relacionamentos):**
     - 3,1–4,0 = Alto risco
     - 2,1–3,0 = Moderado
     - 1,1–2,0 = Médio
     - 0–1,0 = Baixo
   - **Positivas (demais):**
     - 0–1,0 = Alto risco
     - 1,1–2,0 = Moderado
     - 2,1–3,0 = Médio
     - 3,1–4,0 = Baixo

## 2.3 Probabilidade, Severidade e NR
- **Probabilidade (P):** Alto=4, Moderado=3, Médio=2, Baixo=1.
- **Severidade (S):** 1 a 4 (fonte deve ser explicitada e única no sistema).
- **Nível de Risco:** `NR = P × S`.
- **Faixa final:**
  - 1–4 Aceitável
  - 5–8 Moderado
  - 9–12 Importante
  - 13–16 Crítico

---

## 3) Plano de correção (execução)

## Fase 0 — Diagnóstico e congelamento de regra
**Objetivo:** eliminar ambiguidade antes de refatorar.

### Entregáveis
- Matriz oficial de regra por indicador (fórmula, denominador, deduplicação).
- Decisão formal sobre Severidade (S).
- Lista de endpoints e componentes que consomem cada indicador.

## Fase 1 — Refatoração da engine de risco (backend)
**Objetivo:** centralizar cálculo em um único serviço de domínio.

### Ações
1. Criar/ajustar `constants` de dimensões com metadado `polarity`.
2. Reescrever função de score para:
   - normalização 1–5 → 0–4 (quando aplicável);
   - classificação por polaridade;
   - retorno rico: `score`, `classificacao`, `P`, `S`, `NR`, `nivelFinal`.
3. Remover lógica duplicada de cálculo em rotas/serviços paralelos.

### Critério de aceite
- Mesmo input gera mesmos resultados em dashboard, APIs e exportações.

## Fase 2 — Correção dos agregadores por indicador
**Objetivo:** garantir coerência estatística por gráfico.

### 2.1 Gênero/Faixa etária
- Calcular percentual por grupo com base em trabalhadores únicos.
- Normalizar rótulos demográficos (`masculino/feminino/outros/não informado`).

### 2.2 Distribuição por dimensão e questão
- Enviar buckets por cor/nível (não média única).
- Garantir soma de 100% por barra (com tolerância de arredondamento).

### 2.3 IGRP e IGRP por dimensão
- Recalcular com filtros ativos (empresa/unidade/setor/cargo/período).
- Definir ponderação oficial e aplicar de forma única.

### 2.4 % trabalhadores em risco
- Aplicar regra de deduplicação por trabalhador.
- Numerador = trabalhadores com regra-alvo (`NR >= 9`, conforme decisão oficial).

## Fase 3 — Frontend e contrato de dados
**Objetivo:** alinhar shape esperado pelos componentes.

### Ações
- Versionar payloads dos gráficos (schema explícito).
- Tratar estado vazio (sem dados) separado de erro de cálculo.
- Bloquear renderização quando houver `NaN` e registrar telemetria.

## Fase 4 — Qualidade e validação
**Objetivo:** impedir regressão.

### Testes mínimos
1. Unitários de polaridade (positivo/negativo, limites 0 e 4).
2. Unitários de normalização de escala (0–4 vs 1–5).
3. Unitários de NR e classificação final (1–16).
4. Integração: consistência entre dashboard e relatório/PGR.
5. Contrato API ↔ frontend para cada indicador crítico.

### Critérios de pronto
- Nenhum gráfico com 100% “travado” sem respaldo dos dados.
- IGRP responde a todos os filtros.
- `% trabalhadores em risco` reflete população única e regra aprovada.
- Indicadores por questão/dimensão exibem distribuição multifaixa quando houver variabilidade.

---

## 4) Priorização sugerida (ordem de implementação)

1. **Engine central de cálculo** (maior impacto sistêmico).
2. **% trabalhadores em risco + gênero/faixa etária** (indicadores executivos mais sensíveis).
3. **Distribuições por dimensão e questão** (diagnóstico operacional).
4. **IGRP e IGRP por dimensão** (visão consolidada da gestão).
5. **Ajustes finos de frontend e telemetria**.

---

## 5) Conclusão

O relatório recebido é uma **boa base técnica** e identifica corretamente os principais vetores de erro. Para execução segura, faltam apenas três definições formais: **origem da Severidade (S)**, **regra de deduplicação do indicador populacional** e **ponderação oficial do IGRP**. Com essas decisões fechadas, a refatoração pode seguir em trilha única e auditável.
