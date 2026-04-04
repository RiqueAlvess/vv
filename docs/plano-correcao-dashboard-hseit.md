# Plano de Correção — Dashboard HSE-IT

## Objetivo
Estruturar a correção dos problemas reportados no dashboard e nos relatórios HSE-IT, garantindo:

- consistência de cálculo (Score, Probabilidade, Severidade, NR, IGRP);
- distribuição correta de risco por dimensão, questão e perfil demográfico;
- aderência às regras de polaridade (fatores positivos vs negativos);
- correção de visualização e paginação;
- limpeza de artefatos órfãos no bucket ao excluir imagens de checklist.

---

## Escopo das correções solicitadas

1. **Checklist: exclusão de imagem deve remover também do bucket** (evitar lixo órfão).
2. **Paginação em “Análise Detalhada por Cargo”** (tabela/gráfico com muitos itens).
3. **Relatório PGR com scores zerados** (corrigir pipeline de cálculo/exportação).
4. **“Risco por Faixa Etária” vazio/incoerente**.
5. **“Risco por Gênero” vazio/incoerente**.
6. **Generalização indevida em “Análise Detalhada por Cargo”** (linhas diferentes com mesmos valores).
7. **IGRP não reage a filtros de unidade/setor**.
8. **“Distribuição de Risco por Dimensão” com 100% em uma única cor**.
9. **“Score de Clima Psicossocial” sem score no gráfico**.
10. **“Distribuição de Risco por Questão” com 100% em uma única cor**.
11. **“% Trabalhadores em Risco” com 100% de criticidade**.
12. **“IGRP por Dimensão” sem dados**.

---

## Regras funcionais que devem guiar os cálculos

### 1) Estrutura de dimensões (35 itens)
- **Demandas:** 3, 6, 9, 12, 16, 18, 20, 22
- **Controle:** 2, 10, 15, 19, 25, 30
- **Apoio da chefia:** 8, 23, 29, 33, 35
- **Apoio dos colegas:** 7, 24, 27, 31
- **Relacionamentos:** 5, 14, 21, 34
- **Cargo (papel/função):** 1, 4, 11, 13, 17
- **Comunicação/Mudanças:** 26, 28, 32

### 2) Score por dimensão
- Escala Likert por item: **0 a 4**.
- **Score da dimensão = média aritmética dos itens da dimensão** (0 a 4).

### 3) Polaridade (ponto crítico)
- **Fatores negativos (alto score = pior):** Demandas, Relacionamentos.
- **Fatores positivos (baixo score = pior):** Controle, Apoio da chefia, Apoio dos colegas, Cargo, Comunicação/Mudanças.

### 4) Classificação -> Probabilidade (P)
- Alto Risco = 4
- Risco Moderado = 3
- Risco Médio = 2
- Baixo Risco = 1

### 5) Severidade (S)
- S em escala **1 a 4** (regra documentada no sistema; validar regra implementada vs definida no produto).

### 6) Nível de risco
- **NR = P × S** (1 a 16)
- Faixas finais:
  - 1–4 Aceitável (verde)
  - 5–8 Moderado (amarelo)
  - 9–12 Importante (laranja)
  - 13–16 Crítico (vermelho)

---

## Hipóteses-raiz dos problemas atuais

1. **Polaridade não aplicada** (ou aplicada invertida) em parte dos agregados.
2. **Agregação no nível errado** (média global replicada por grupo, gerando linhas idênticas).
3. **Filtros não propagados** para todos os datasets (IGRP e gráficos derivados usando cache/base sem filtro).
4. **Denominador incorreto** em percentuais (resultando 100% constante).
5. **Fallback silencioso para zero** no PGR (campos nulos/undefined virando 0).
6. **JOIN/agrupamento demográfico quebrado** para idade e gênero (labels sem correspondência).
7. **Camada de visualização esperando shape diferente** do payload (gráfico vazio).

---

## Plano técnico de execução (fases)

## Fase 0 — Diagnóstico orientado por evidências
- Mapear funções centrais de cálculo: score por dimensão, classificação, P, S, NR, IGRP.
- Mapear queries/transformações dos widgets afetados.
- Capturar payload real (antes de render) de cada gráfico problemático.
- Levantar diferenças entre:
  - cálculo no dashboard;
  - cálculo no export/relatório PGR;
  - cálculo em endpoints/serviços compartilhados.

**Entregável:** inventário de funções e fluxo de dados por widget + lista de divergências.

## Fase 1 — Unificação da engine de risco (core)
- Centralizar regras HSE-IT em um módulo único de domínio (evitar duplicação entre dashboard e relatório).
- Criar utilitários puros para:
  - score por dimensão;
  - classificação com polaridade;
  - mapeamento P/S;
  - NR e nível final;
  - percentuais por faixa de criticidade.
- Garantir tipagem forte para evitar fallback em 0 por ausência de campo.

**Entregável:** serviços/funções únicas reaproveitáveis por todos os gráficos e relatório PGR.

## Fase 2 — Correções por feature

### 2.1 Checklist (bucket cleanup)
- Ao excluir imagem do checklist:
  1. remover referência no banco;
  2. remover objeto físico no bucket;
  3. tratar idempotência (se arquivo já não existir, não quebrar fluxo);
  4. registrar log de sucesso/falha para rastreio.

### 2.2 Análise Detalhada por Cargo
- Corrigir agregação por **cargo + setor + unidade** com métricas próprias por grupo.
- Evitar reutilização de média global em cada linha.
- Implementar paginação (server-side ou client-side conforme volume).
- Preservar paginação ao aplicar filtros.

### 2.3 Relatório PGR
- Reapontar cálculo do PGR para engine unificada.
- Corrigir mapeamento de campos no template/export.
- Adicionar validação: impedir emissão com score total zerado sem justificativa (ex.: sem respostas).

### 2.4 Risco por Faixa Etária e por Gênero
- Garantir normalização de categorias (ex.: “Masculino”, “Feminino”, “Não informado”; faixas etárias padronizadas).
- Validar base populacional por filtro ativo.
- Exibir estado vazio somente quando realmente não houver dados.
- Calcular “maior exposição” sobre percentual correto de alto/crítico, não sobre total bruto.

### 2.5 IGRP (geral e por dimensão)
- Recalcular com base na seleção ativa (empresa/unidade/setor/cargo/período).
- Garantir atualização reativa ao mudar filtros.
- Definir claramente ponderação (por n de respondentes) e documentar.

### 2.6 Distribuição de risco por dimensão e por questão
- Corrigir cálculo de distribuição em 4 classes (verde/amarelo/laranja/vermelho).
- Aplicar polaridade por dimensão/pergunta antes da classificação.
- Garantir que barras empilhadas somem 100% **por dimensão/pergunta**, não em dataset inteiro.

### 2.7 % Trabalhadores em Risco
- Critério: respondente com **NR >= 9** em ao menos uma dimensão.
- Corrigir numerador/denominador por universo filtrado.
- Evitar duplicidade por respondente em agregações.

### 2.8 Score de Clima Psicossocial (radar)
- Corrigir fonte e shape do dataset para o componente.
- Exibir top 5 críticos por recorte selecionado (empresa/unidade/setor/cargo), quando aplicável.
- Garantir presença de labels e valores numéricos válidos.

---

## Fase 3 — Qualidade, testes e validação

### Testes unitários (core de cálculo)
- Casos para fatores positivos/negativos (limites 0, 1, 2, 3, 4).
- Casos de NR em todas as faixas finais.
- Casos com dados faltantes e comportamento esperado.

### Testes de integração
- Mesmo dataset deve produzir valores coerentes entre dashboard e relatório PGR.
- Filtros (unidade/setor/cargo) alteram IGRP e gráficos dependentes.

### Testes de regressão visual
- Conferir gráficos empilhados com múltiplas cores.
- Conferir estados vazios e mensagens quando sem dados.

### Critérios de aceite (DoD)
- Nenhum gráfico-chave com 100% fixo indevido.
- PGR não sai zerado quando há respostas válidas.
- Análise por cargo apresenta variabilidade real entre grupos.
- Exclusão de imagem remove objeto do bucket.
- IGRP e widgets respondem corretamente a filtros.

---

## Estratégia de rollout
- Entregar em PRs menores por bloco funcional:
  1. core de cálculo;
  2. gráficos/indicadores;
  3. relatório PGR;
  4. checklist bucket cleanup.
- Habilitar logs temporários de auditoria para comparar antes/depois.
- Validar com massa real e massa sintética controlada.

---

## Riscos de implementação
- Divergência entre regra técnica e interpretação de negócio da severidade (S).
- Dados históricos com inconsistência de categorias demográficas.
- Componentes de gráfico com suposições rígidas de formato.

**Mitigação:** validação conjunta com produto/negócio e snapshots comparativos por versão.

---

## Próximos passos imediatos
1. Mapear arquivos e funções afetadas no código atual.
2. Criar suíte de testes para regras HSE-IT (antes de refatorar).
3. Corrigir primeiro a engine de cálculo e reaproveitar em dashboard + PGR.
4. Ajustar widgets com maior impacto gerencial (IGRP, distribuição por dimensão/questão, % em risco).
5. Implementar limpeza de bucket no fluxo de exclusão de checklist.
