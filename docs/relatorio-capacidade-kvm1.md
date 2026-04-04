# Relatório de Capacidade (Inferido) — VPS Hostinger KVM 1

## 1) Escopo da análise

Este relatório estima **quantos usuários simultâneos** sua plataforma tende a suportar na VPS **Hostinger KVM 1** para os fluxos:

- Acesso ao dashboard;
- Criação de campanhas;
- Resposta de formulário (via QR);
- Validação de QR/token público.

> Observação importante: como não foi executado teste de carga real (k6/autocannon + banco de produção), os números abaixo são **inferências técnicas** com base na arquitetura/código atual.

---

## 2) Base técnica usada para inferência

### 2.1 Características do backend

- Aplicação Next.js com rotas API em Node.
- Prisma + PostgreSQL (Supabase) para persistência.
- Sem worker ativo no fluxo atual (processo sai imediatamente).
- Rate limit em memória por processo (Map local).

### 2.2 O que impacta desempenho por fluxo

#### A) Dashboard (mais pesado)

No endpoint de dashboard da campanha:

- Carrega respostas da campanha (`findMany`) e processa em memória;
- Faz múltiplos loops e cálculos por dimensão/perfil de usuário;
- Para campanha fechada/sem filtros, tenta reaproveitar cache de métricas.

Conclusão: custo cresce com o número de respostas da campanha (CPU + memória + payload JSON).

#### B) Criação de campanha (leve)

- Validação e 1 insert principal na tabela de campanha.
- Fluxo tipicamente IO-bound (banco), baixo custo de CPU.

#### C) Resposta via QR (médio)

- Valida token da campanha;
- Faz checagem de duplicidade por fingerprint (`campaign_id + fingerprint`);
- Persiste resposta JSON;
- Tenta persistir fatos analíticos (camada extra).

Conclusão: custo moderado, com dependência direta da latência do banco.

#### D) Validação de QR / feedback público (leve-médio)

- Consulta por token + valida estado do canal/campanha;
- Pouco processamento de CPU.

---

## 3) Premissas da estimativa

Como o plano KVM 1 pode variar por período/região, usei premissas conservadoras típicas de entrada:

- 1 vCPU dedicada;
- 4 GB RAM;
- banco externo (Supabase), latência de rede estável;
- Node em modo produção com 1 processo da aplicação;
- sem CDN avançado para APIs.

Se sua KVM 1 tiver recursos diferentes, os valores abaixo mudam proporcionalmente.

---

## 4) Estimativa de capacidade por tipo de uso

### 4.1 Simultaneidade por fluxo (faixa segura)

| Fluxo | Simultâneos (faixa segura) | Observação |
|---|---:|---|
| Dashboard (campanha grande, sem cache) | **8–20** | Principal gargalo atual (CPU + leitura grande). |
| Dashboard (campanha fechada com cache válido) | **30–60** | Cache reduz muito o custo por requisição. |
| Criar campanha | **70–140** | Fluxo leve com baixo custo computacional. |
| Responder pesquisa (QR) | **25–55** | Inserção + dedupe + fato analítico. |
| Validar QR / canal feedback | **80–160** | Leitura simples por token. |

### 4.2 Visão agregada da plataforma (cenário misto realista)

Para tráfego misto típico (exemplo: 20% dashboard, 10% criação/edição, 60% respostas QR, 10% validações):

- **Capacidade simultânea recomendada sem degradação forte:** **25–45 usuários simultâneos**.
- **Ponto de atenção (degradação perceptível de latência):** acima de **~50–70 simultâneos**.
- **Risco de fila/timeouts em pico:** acima de **~80 simultâneos** (especialmente se muitos abrirem dashboard pesado ao mesmo tempo).

---

## 5) Gargalos encontrados no código atual

1. **Rate limit local em memória (não distribuído)**
   - Em escala com múltiplos processos/instâncias, o controle não é global.

2. **Dashboard com processamento em memória por resposta**
   - Para campanhas com muitas respostas, a rota de dashboard tende a consumir CPU considerável.

3. **Worker de fila não processa tarefas atualmente**
   - Como o worker atual finaliza na inicialização, qualquer trabalho pesado fica mais propenso a ocorrer no request path.

4. **Dependência alta da latência do banco externo**
   - Em VPS de entrada, variações de rede impactam muito os endpoints de escrita/leitura frequentes.

---

## 6) Recomendação prática (ordem de impacto)

1. **Pré-cálculo assíncrono das métricas do dashboard**
   - Atualizar `campaign_metrics` ao fechar campanha (ou incrementalmente), evitando recomputar tudo na leitura.

2. **Paginar/segmentar dados pesados do dashboard**
   - Evitar carregar e processar todo o conjunto quando não necessário.

3. **Rate limit centralizado em Redis**
   - Comportamento consistente em múltiplos processos e melhor proteção em pico.

4. **Rodar benchmark real com cenário de negócio**
   - Simular jornada real: login → dashboard → campanhas → resposta QR, com metas de p95/p99.

5. **Escalar horizontalmente antes de escalar plano**
   - Em geral, sair de 1 para 2 processos/instâncias (com limites corretos de pool) já dá ganho significativo.

---

## 7) Conclusão executiva

Com a arquitetura atual e assumindo KVM 1 de entrada, sua plataforma tende a suportar:

- **~25–45 usuários simultâneos** em cenário misto realista com estabilidade boa;
- podendo chegar a faixas maiores em operações leves (validação QR/criação);
- e menores quando muitos usuários acessam dashboards pesados sem cache.

Se quiser, posso entregar na próxima etapa um **plano de teste de carga reproduzível** (k6) com script e meta objetiva (ex.: p95 < 1.5s, erro < 1%) para transformar esta inferência em número validado de produção.


---

## 8) Explicação técnica aprofundada dos 4 problemas

### 8.1 Rate limit local em memória (não distribuído)

**Como está hoje no código**

- O rate limit usa um `Map` em memória do processo Node (`store = new Map(...)`).
- A chave é incrementada localmente e expira por `setInterval`.

**Por que isso vira problema em produção**

1. **Cada processo tem seu próprio contador**
   - Se você rodar 2 processos (PM2 cluster, Docker replicas, etc.), cada processo terá um `Map` diferente.
   - Resultado: um usuário pode “driblar” o limite ao cair em processos distintos.

2. **Sem consistência entre instâncias**
   - Em load balancer, requisições do mesmo usuário podem alternar entre nós.
   - O limite deixa de ser global e passa a ser “por nó”, o que reduz eficácia de proteção.

3. **Perda de estado em restart/deploy**
   - Reiniciou processo? Zera o `Map`.
   - Em ataques de burst, esse reset pode abrir janela de abuso.

4. **Imprecisão em janelas de tempo**
   - Estratégia in-memory simples tende a gerar bordas com comportamento desigual em tráfego alto.

**Efeito prático para capacidade**

- Quando você tenta escalar horizontalmente, o rate limit não ajuda a estabilizar picos de forma confiável.
- Você gasta CPU com tráfego que deveria ter sido bloqueado cedo.

**Como corrigir (nível produção)**

- Migrar para rate limit centralizado em Redis (token bucket/sliding window).
- Chavear por combinação adequada: `user_id`, `ip`, `route`, e opcionalmente `company_id`.
- Definir políticas por endpoint (dashboard mais restrito que leitura simples).

---

### 8.2 Dashboard com processamento em memória por resposta

**Como está hoje no código**

- A rota busca respostas da campanha com `findMany` e depois processa tudo em loops no Node.
- Há múltiplas agregações: dimensão, gênero, idade, risco por colaborador etc.
- Mesmo com cache para cenário sem filtro, quando não há cache válido ou há filtro, o custo volta para o request.

**Resposta objetiva à dúvida: “o cálculo é em tempo real quando a API é chamada?”**

- **Sim, na maior parte dos casos o cálculo acontece durante a própria requisição da API.**
- Exceção: quando a chamada é sem filtros e existe cache válido, a rota pode devolver o agregado já pronto sem recalcular tudo.
- Em chamadas com filtro (`unit_id`/`sector_id`) ou sem cache aproveitável, o endpoint volta a consultar respostas e recalcular no momento da chamada.

**Por que isso escala mal**

1. **Complexidade cresce com N respostas**
   - Quanto maior a campanha, mais objetos JSON entram em memória e mais loops são executados.

2. **Competição por event loop/CPU**
   - Em 1 vCPU, requests concorrentes de dashboard disputam o mesmo núcleo.
   - A latência de todos os usuários sobe junto (efeito “fila”).

3. **Pressão de memória e GC**
   - Arrays grandes + objetos derivados aumentam coleta de lixo (GC), gerando pausas.

4. **Cálculo síncrono no caminho da requisição**
   - O usuário final “paga” o custo completo na hora de abrir o dashboard.

**Efeito prático para capacidade**

- Dashboard vira gargalo principal da VPS pequena.
- Picos administrativos (muitas pessoas abrindo painel ao mesmo tempo) degradam todo o sistema.

**Como corrigir (nível produção)**

- Pré-computar métricas (materialização) em tabela de analytics.
- Recalcular por job assíncrono ao fechar campanha e/ou incremental em intervalos.
- No endpoint, preferir apenas leitura de agregado pronto.
- Em filtros dinâmicos, empurrar agregação para SQL com índices e limites.

---

### 8.3 Worker de fila não processa tarefas atualmente

**Como está hoje no código**

- O worker inicializa, loga mensagem e encerra com `process.exit(0)`.
- Ou seja: não existe processamento assíncrono contínuo ativo no momento.

**Por que isso é um risco de desempenho**

1. **Sem “válvula de desacoplamento”**
   - Tarefas pesadas (cálculo, geração PDF, consolidação analytics, envio etc.) tendem a ficar no request path.

2. **Piora de p95/p99**
   - Mesmo tarefas ocasionais aumentam latência das rotas críticas sob carga.

3. **Menor resiliência a pico**
   - Com fila ativa, você absorve burst e processa no ritmo do servidor.
   - Sem fila, o pico atinge diretamente a API online.

4. **Menos controle operacional**
   - Sem retries, backoff e DLQ bem configurados, falhas transitórias viram erro para usuário final.

**Efeito prático para capacidade**

- Capacidade útil cai porque a API precisa fazer tudo “na hora”.
- A concorrência máxima segura diminui.

**Como corrigir (nível produção)**

- Reativar worker real (BullMQ) para tarefas pesadas e não-críticas ao request imediato.
- Definir prioridade, concorrência por tipo de job, retry com backoff e observabilidade.
- Garantir idempotência para reprocessamento seguro.

---

### 8.4 Dependência alta da latência do banco externo

**Como está hoje no código/arquitetura**

- A aplicação está na VPS e o PostgreSQL fica externo (Supabase).
- Rotas de negócio fazem múltiplas operações de leitura/escrita por requisição.

**Por que isso pesa tanto em VPS de entrada**

1. **Cada roundtrip de rede custa**
   - Se uma rota faz várias queries sequenciais, a latência se soma.

2. **Jitter de rede impacta diretamente p95/p99**
   - Pequenas oscilações de internet/roteamento aumentam tempo de resposta em cascata.

3. **Conexões e pool mal dimensionados agravam filas**
   - Em pico, falta de conexões disponíveis aumenta tempo de espera.

4. **Throughput limitado por I/O remoto**
   - Mesmo com CPU livre, o app pode ficar bloqueado esperando banco.

**Efeito prático para capacidade**

- Limite de usuários simultâneos cai antes de saturar CPU local.
- Endpoints de escrita frequente (ex.: respostas de pesquisa) sentem primeiro.

**Como corrigir (nível produção)**

- Reduzir número de queries por request (batching/joins úteis/evitar N+1).
- Otimizar índices críticos (`campaign_id`, `token`, `campaign_id+fingerprint`, datas).
- Ajustar pool/concurrency de conexão para o tamanho real da VPS.
- Medir e monitorar separadamente: tempo de app vs tempo de banco.

---

## 9) Checklist de validação em produção (próximo passo)

Para transformar inferência em número comprovado:

1. Definir SLO: `p95 < 1.5s`, `erro < 1%`.
2. Rodar carga por fluxo (dashboard, criação, resposta QR, validação token).
3. Capturar métricas: CPU, RAM, event loop lag, latência DB, RPS, taxa de erro.
4. Repetir após cada melhoria estrutural (cache/materialização, worker, rate limit Redis).
5. Fixar capacidade oficial por ambiente (ex.: KVM 1 single node).


---

## 10) Se este é o principal gargalo: plano fácil e eficaz (sem reescrever tudo)

Se o gargalo principal hoje é o **dashboard recalculando em tempo real**, a forma mais simples de ganhar desempenho rápido é:

### Passo 1 — “Congelar” o cálculo ao fechar campanha (maior ganho / menor risco)

- No momento de fechamento da campanha, calcule uma vez as métricas completas.
- Grave o resultado em `campaign_metrics`.
- Na rota de dashboard, para campanha fechada, retorne sempre os dados materializados.

**Por que funciona:**
- Troca custo de CPU por leitura simples no banco.
- Remove quase todo processamento pesado do request path.

### Passo 2 — Cache com invalidação simples para campanha ativa

- Para campanhas ativas, manter TTL curto (ex.: 1–5 min) já reduz picos.
- Invalidação simples: ao entrar nova resposta, marcar cache da campanha como “stale”.

**Por que funciona:**
- Evita recalcular a cada F5/abertura do painel.
- Mantém o dado “quase em tempo real” com custo previsível.

### Passo 3 — Limitar filtros caros no curto prazo

- Aplicar limites de janela/filtros (ex.: máximo de respostas por consulta analítica).
- Se filtro for pesado, responder com agregado parcial e aviso de processamento.

**Por que funciona:**
- Evita explosão de custo quando usuário aplica filtros muito amplos.

### Meta prática (1 sprint)

- Objetivo: reduzir p95 do endpoint de dashboard em **40–70%** em campanhas grandes.
- Sem necessidade de migrar toda arquitetura.

### Ordem de implementação recomendada

1. Materialização no fechamento de campanha.
2. Reuso obrigatório do materializado para campanha fechada.
3. Invalidação de cache para ativa + TTL curto.
4. Só depois: otimizações SQL finas e refator de agregações.

> Em resumo: **a correção mais fácil e eficaz é parar de calcular tudo no request e servir agregado pronto**.


---

## 11) Plano de ação proposto (modelo estrela + worker + cache + exports assíncronos)

### 11.1 Sua ideia funciona?

**Sim, funciona e é o caminho certo**, com um ajuste importante:

- Materializar métricas ao fechar campanha em modelo estrela + processar no worker: **excelente**.
- Servir do cache e deixar filtros no client-side: **funciona bem para filtros leves e payload controlado**.
- Para filtros muito combinatórios ou bases muito grandes, manter estratégia **híbrida** (parte client-side, parte server-side agregado) evita payload gigante.

### 11.2 Arquitetura alvo

1. **Fechamento da campanha** dispara job `campaign.metrics.rebuild`.
2. **Worker** calcula e persiste:
   - fatos (`fact_responses`),
   - agregados por dimensão,
   - agregados por recortes (gênero, idade, unidade, setor, cargo),
   - snapshot final em `campaign_metrics`.
3. API de dashboard retorna **somente dados pré-agregados**.
4. Cache (Redis) por campanha/versão para leitura rápida.
5. Filtros no front trabalham sobre dataset agregado (não resposta crua).
6. PDF/XLSX viram jobs assíncronos (`report.pdf.generate`, `report.xlsx.generate`).

### 11.3 Plano de implementação (4 fases)

#### Fase 1 — Base assíncrona (sem quebrar o atual)

- Reativar worker BullMQ real.
- Criar filas:
  - `campaign.metrics.rebuild`
  - `report.pdf.generate`
  - `report.xlsx.generate`
- Adicionar tabela de controle de jobs (status, progress, error, artifact_url, expires_at).
- Endpoint de fechamento da campanha apenas enfileira job e responde rápido.

**Entrega da fase:** request path mais leve imediatamente.

#### Fase 2 — Materialização de métricas

- Definir contrato de agregados para dashboard:
  - KPIs principais,
  - séries por dimensão,
  - distribuições por perfil,
  - top críticos (setor/cargo),
  - heatmap já calculado.
- Persistir resultado versionado (ex.: `payload_version`, `computed_at`).
- Implementar invalidação por versão da campanha.

**Entrega da fase:** dashboard sem cálculo pesado no GET.

#### Fase 3 — Cache + filtros no client (híbrido)

- Cache Redis por chave: `dashboard:{campaignId}:v{version}`.
- TTL longo para campanha fechada; curto para ativa.
- Front aplica filtros simples em memória no dataset agregado.
- Se filtro exigir granularidade alta, chamar endpoint agregado específico server-side.

**Entrega da fase:** ótima UX com custo previsível.

#### Fase 4 — Exportações 100% assíncronas (PDF/XLSX)

- Trocar geração síncrona por job:
  1. usuário solicita export,
  2. API retorna `job_id`,
  3. worker gera artefato,
  4. usuário acompanha status e baixa ao concluir.
- Armazenar artefatos com expiração (S3/Supabase Storage) e link assinado.
- Reaproveitar agregados materializados para não recomputar no export.

**Entrega da fase:** elimina picos de CPU e timeout por export no request path.

### 11.4 Regras de ouro para essa estratégia dar certo

1. **Não enviar resposta individual para o client** (privacidade + payload).
2. **Filtros client-side só em agregado compacto**.
3. **Versionar payload** para cache seguro.
4. **Jobs idempotentes** para retry sem duplicidade.
5. **Observabilidade obrigatória** (tempo de job, falhas, fila, hit de cache).

### 11.5 SLOs e metas de capacidade após implementação

Metas iniciais realistas:

- Dashboard GET p95: **< 400ms** (campanha fechada, cache hit).
- Dashboard GET p95: **< 900ms** (cache miss com leitura materializada).
- Export request API p95: **< 200ms** (apenas enqueue).
- Taxa de erro geral: **< 1%**.

Impacto esperado (KVM 1, cenário misto):

- capacidade simultânea tende a subir de ~25–45 para **~50–90** usuários,
- pois o principal gargalo sai do caminho síncrono.

### 11.6 Backlog técnico objetivo (próximas tarefas)

1. Reativar processo worker contínuo e healthcheck.
2. Criar producers/consumers das 3 filas.
3. Implementar persistência de job status + endpoint de polling.
4. Materializar todos os blocos do dashboard em `campaign_metrics`.
5. Introduzir Redis cache por versão de campanha.
6. Migrar rotas de export para job assíncrono.
7. Instrumentar métricas (Prometheus/OpenTelemetry).
8. Rodar teste de carga comparativo antes/depois.
