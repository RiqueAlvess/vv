# Análise de origem do erro: `Cannot read properties of undefined (reading 'demandas')`

## Erro observado

- **Mensagem:** `TypeError: Cannot read properties of undefined (reading 'demandas')`
- **Componente:** `src/components/dashboard/charts/heatmap-chart.tsx`
- **Linha crítica original:** acesso direto `row.dimensions[dim.key]`

## Origem do problema

A origem é um acesso sem validação em tempo de execução:

```ts
const cell = row.dimensions[dim.key];
```

Esse trecho assume que **todo item de `heatmap`** possui a estrutura:

```ts
{ unit: string, dimensions: Record<string, {...}> }
```

Porém, o componente recebia `heatmap` como `unknown[]` e fazia *cast* direto para `HeatmapRow[]`, sem validar os objetos. Se qualquer item vier sem `dimensions` (ou com formato inválido), `row.dimensions` vira `undefined`; ao tentar ler a chave da dimensão atual (por exemplo, `demandas`), o React lança o erro.

## Por que acontece justamente com `demandas`

`demandas` é a primeira chave iterada da lista `HSE_DIMENSIONS` (`dim.key`). Assim, o primeiro acesso inválido normalmente aparece como leitura de `demandas`, mas o defeito real é estrutural: `row.dimensions` ausente/inválido.

## Correção aplicada

Foi adicionada uma normalização defensiva no componente:

1. Validação do `heatmap` com `Array.isArray`.
2. Filtro de linhas com *type guard* para aceitar apenas itens com:
   - `unit` do tipo `string`;
   - `dimensions` existente e do tipo `object`.
3. Acesso opcional seguro:

```ts
const cell = row.dimensions?.[dim.key];
```

Com isso, dados incompletos não quebram a renderização; a célula cai no fallback visual `—`.

## Como solucionar de forma completa (frontend + backend)

### Frontend (já aplicado)

- Sanitizar dados de entrada antes do `map`.
- Evitar *type assertion* cega de `unknown[]` para tipo final.

### Backend (recomendado)

- Garantir contrato consistente no payload de `heatmap`.
- Sempre retornar `dimensions: {}` quando não houver dados da unidade.
- Evitar enviar itens parciais no array de `heatmap`.

### Contrato recomendado para cada linha

```ts
{
  unit: string,
  dimensions: {
    [dimensionKey: string]: {
      nr: number,
      color: string,
      label: string
    }
  }
}
```

## Resultado esperado após o ajuste

- O erro de runtime deixa de ocorrer mesmo com dados inválidos/parciais.
- A UI continua estável e exibe fallback `—` para células sem informação.
- Facilita rastreio de qualidade de dados sem derrubar o dashboard.
