# Módulo de Relatórios Financeiros (Admin)

Prévia ao vivo do resultado financeiro de um período: faturamento, CMV, lucro bruto, custos fixos, lucro líquido e a distribuição prevista entre os sócios. A tela é **somente leitura** — nada aqui persiste dados.

## Estrutura de Arquivos

- `components/FinancialReportKpis.tsx`: Grade com os oito indicadores do período (faturamento, CMV, lucro bruto com margem, custos fixos, lucro líquido em destaque, compras, perdas e ticket médio).
- `components/FinancialReportWarnings.tsx`: Banner amber com os avisos do backend (período parcial de mês, distribuição não configurada etc.).
- `components/FixedCostsCard.tsx`: Tabela dos custos fixos considerados no período (nome, valor mensal, meses de competência, total).
- `components/WriteOffsByReasonCard.tsx`: Perdas do período agrupadas por motivo (quantidade e custo FIFO).
- `components/PartnerDistributionCard.tsx`: Distribuição prevista do lucro líquido entre os sócios ativos (nome, percentual, valor).
- `hooks/useFinancialReports.ts`: Hook controlador — período filtrado (strings `yyyy-MM-dd`), consulta `useGetFinancialReportSummary`, toast de erro com `describeApiError` e exposição de `isError`/`error` para o estado de erro da página.
- `hooks/__tests__/useFinancialReports.test.tsx`: Testes unitários do hook controlador (Vitest + React Testing Library).
- `types.ts`: Filtro de período + re-export dos DTOs do resumo.

## Regras de Negócio

### 1. O relatório é uma PRÉVIA

- Todos os números são recalculados ao vivo pelo backend a cada consulta; nada é persistido por esta tela.
- O documento oficial do período é o **fechamento financeiro** (feature `financial-closings`), que congela números e rateio na confirmação.

### 2. Fórmula do resultado

- `Faturamento − CMV = Lucro Bruto` e `Lucro Bruto − Custos Fixos = Lucro Líquido`.
- O lucro bruto é **exatamente a conta do Dashboard** (fonte única no backend) — as duas telas nunca divergem.

### 3. Compras e perdas são informativas

- Aparecem como cards e na tabela de perdas por motivo, mas **não entram no lucro líquido**: o CMV já cobre o custo FIFO dos itens vendidos.

### 4. Custos fixos por competência mensal

- Cada mês-calendário tocado pelo período lança o **valor mensal cheio** de cada custo vigente naquele mês, sem pró-rata.
- Período que não começa no dia 1 ou não termina no último dia do mês gera *warning* do backend (exibido no banner).

### 5. Distribuição prevista

- Calculada com os percentuais **atuais** dos sócios ativos; lista vazia (com warning) quando a distribuição não foi configurada.
- Lucro líquido negativo distribui prejuízo — os valores aparecem em vermelho.

### 6. Período padrão e filtro

- Padrão: primeiro dia do mês atual até hoje. Com o filtro limpo, o backend assume os últimos 30 dias.
- As datas trafegam como string `yyyy-MM-dd` no hook; a conversão para `Date` do calendário fica na página (padrão da tabela de vendas).

### 7. Falha da consulta tem estado visível

- Erro na consulta troca o conteúdo por um estado de erro com a mensagem do backend (`describeApiError`) e o botão "Tentar novamente" (`refetch`) — sem isso os skeletons dos indicadores ficariam girando para sempre.
