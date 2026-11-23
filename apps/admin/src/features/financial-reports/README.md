# Módulo de Relatórios Financeiros (Admin)

Prévia ao vivo do resultado financeiro de um período: vendas brutas, descontos por origem, vendas líquidas, CMV, lucro bruto, baixas, sobras, custos fixos, lucro líquido e a distribuição prevista entre os sócios. A tela é **somente leitura** — nada aqui persiste dados. Menu: "Resumo Financeiro", logo abaixo do Painel Financeiro.

## Estrutura de Arquivos

- `components/FinancialReportKpis.tsx`: Grade com os doze indicadores do período, na conta do resultado do fechamento (ver regra 2).
- `components/FinancialReportWarnings.tsx`: Banner amber com os avisos do backend (período parcial de mês, distribuição não configurada etc.).
- `components/FixedCostsCard.tsx`: Tabela dos custos fixos considerados no período (nome, valor mensal, meses de competência, total).
- `components/WriteOffsByReasonCard.tsx`: Baixas do período agrupadas por motivo (quantidade e custo FIFO).
- `components/PartnerDistributionCard.tsx`: Distribuição prevista do lucro líquido entre os sócios ativos (nome, percentual, valor).
- `hooks/useFinancialReports.ts`: Hook controlador — período filtrado (strings `yyyy-MM-dd`), consulta `useGetFinancialReportSummary`, toast de erro com `describeApiError` e exposição de `isError`/`error` para o estado de erro da página.
- `hooks/__tests__/useFinancialReports.test.tsx`: Testes unitários do hook controlador (Vitest + React Testing Library).
- `types.ts`: Filtro de período + re-export dos DTOs do resumo.

## Regras de Negócio

### 1. O relatório é uma PRÉVIA

- Todos os números são recalculados ao vivo pelo backend a cada consulta; nada é persistido por esta tela.
- O documento oficial do período é o **fechamento financeiro** (feature `financial-closings`), que congela números e rateio na confirmação.

### 2. A mesma conta do fechamento (23/11/2026)

- `Vendas brutas − descontos = vendas líquidas`, `vendas líquidas − CMV = lucro bruto` e `lucro bruto − baixas + sobras − custos fixos = lucro líquido` — a conta da versão 2 do fechamento, sem os custos variáveis (que só existem no fechamento). Sem a mesma conta, o resumo e o fechamento do mesmo mês dariam lucros diferentes (`PLANO-FINANCEIRO.md`, seção 3.1).
- O lucro bruto continua **exatamente a conta do Dashboard** (fonte única no backend).
- **Descontos por origem**: no item (com a promoção como parcela) e na venda (com o cupom como parcela). Parcela nunca se soma de novo: a promoção já está dentro do desconto no item, e o cupom, dentro do da venda.

### 3. Baixas e sobras entram no lucro; compras são informativas

- **Baixas** (perda, doação, consumo, inventário) descontam do lucro líquido pelo custo FIFO congelado; **sobras** (entradas de ajuste manual) somam. Até 23/11/2026 as baixas eram só informativas.
- O antigo "Compras" somava ENTRADAS de estoque pela data de entrada, inclusive o ajuste manual: virou **"Entradas de estoque"**, ao lado das **"Compras pagas"** — o dinheiro que saiu, pela data da compra, que é o que a faixa de compras usa. Os dois são informativos: o custo do vendido já está no CMV.
- Os **aportes** do período aparecem à parte: entram no caixa, não no lucro.

### 4. Custos fixos por competência mensal

- Cada mês-calendário tocado pelo período lança o **valor mensal cheio** de cada custo vigente naquele mês, sem pró-rata.
- Período que não começa no dia 1 ou não termina no último dia do mês gera _warning_ do backend (exibido no banner).

### 5. Distribuição prevista

- Calculada com os percentuais **atuais** dos sócios ativos; lista vazia (com warning) quando a distribuição não foi configurada.
- Lucro líquido negativo distribui prejuízo — os valores aparecem em vermelho.

### 6. Período padrão e filtro

- Padrão: primeiro dia do mês atual até hoje. Com o filtro limpo, o backend assume os últimos 30 dias.
- As datas trafegam como string `yyyy-MM-dd` no hook; a conversão para `Date` do calendário fica na página (padrão da tabela de vendas).

### 7. Falha da consulta tem estado visível

- Erro na consulta troca o conteúdo por um estado de erro com a mensagem do backend (`describeApiError`) e o botão "Tentar novamente" (`refetch`) — sem isso os skeletons dos indicadores ficariam girando para sempre.
