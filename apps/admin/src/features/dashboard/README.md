# Módulo de Visão Geral (`features/dashboard`)

Painel de indicadores da loja. Consome os endpoints de `/Dashboard` no backend e
não tem nenhum dado simulado: todos os números vêm de vendas reais.

---

## 📂 Estrutura de Arquivos

### Hooks

- `hooks/useDashboard.ts`: período exibido e visão geral do intervalo (KPIs, série diária, quebras, ranking). O período vive aqui, e não em cada painel, para que os cards e os gráficos nunca mostrem recortes diferentes lado a lado.
- `hooks/useLiveToday.ts`: faturamento do dia corrente, com atualização automática a cada minuto.
- `hooks/useMonthlyComparison.ts`: mês atual contra o anterior e histórico dos meses fechados.
- `hooks/useWeekComparison.ts`: semana atual contra a anterior — o mesmo `/Dashboard/performance` que o PDV consome via `/Pdv/performance`.
- `hooks/useSalesPatterns.ts`: padrões históricos, **carregados sob demanda**.
- `hooks/useSalesIntelligence.ts`: reposição e análise de cesta, **carregadas sob demanda**.

### Componentes

- `components/PeriodSelector.tsx`: cabeçalho com o período em vigor e os controles que o mudam (ver [padrão de calendário](../../components/ui/README.md)).
- `components/StatTile.tsx` / `components/DashboardKpis.tsx`: cards de faturamento, lucro, vendas e ticket médio.
- `components/LiveTodayCard.tsx`: número em destaque do dia, comparativos e faturamento por hora.
- `components/RevenueProfitChart.tsx`: faturamento e lucro dia a dia no período.
- `components/MonthComparisonCard.tsx`: curva acumulada do mês atual contra o anterior.
- `components/WeekComparisonCard.tsx`: curva acumulada da semana atual contra a anterior, no mesmo formato do card mensal. A soma vem de `accumulateWeekComparison` (`@workspace/core`), compartilhada com o gráfico do PDV.
- `components/RevenueBreakdownCard.tsx`: quebra do faturamento por categoria e por forma de pagamento.
- `components/TopProductsTable.tsx`: ranking de produtos com margem e estoque.
- `components/PatternsPanel.tsx` + `components/PatternChart.tsx`: padrões por dia da semana, hora do dia e dia do mês.
- `components/IntelligencePanel.tsx` + `components/RestockList.tsx` + `components/BasketInsights.tsx`: inteligência comercial.
- `components/chart-primitives.tsx`: moldura, tooltip, legenda e especificações visuais compartilhadas.

### Apoio

- `types.ts`: contratos espelhando os DTOs de `/Dashboard`.
- `utils.ts`: resolução de períodos, variação percentual e formatadores.

---

## ⚙️ Regras de Negócio Importantes

### 1. Definição de faturamento e lucro

- **Faturamento** é a soma de `sales.total`, que já está **líquido** do desconto da venda.
- **Lucro** é a soma do lucro dos itens **menos** o desconto do cabeçalho. `sale_items.profit` é calculado sobre o preço cheio e não enxerga o abatimento dado no fechamento; sem essa subtração o painel reportaria lucro maior que o real em toda venda com desconto.
- Vendas canceladas (`PaymentStatus.Cancelled`) ficam fora de todos os números, o mesmo critério do resumo de caixa.

### 2. Períodos

Presets: **Hoje**, **7 dias** (padrão), **30 dias**, **90 dias** e **1 ano**; todos contam o dia de hoje dentro da janela. O intervalo personalizado é aplicado assim que as duas pontas são escolhidas no calendário — por isso `handleApplyCustom` recebe as datas explicitamente, já que o estado do rascunho ainda guarda o valor anterior.

As datas são formatadas com `formatDateInput` (`yyyy-MM-dd` local) e **nunca** com `toISOString()`: o backend grava e compara datas no horário de Brasília, e uma data em UTC deslocaria o recorte (ver `docs/fuso-horario.md` no backend).

### 3. Comparativos recortados no mesmo horário

O card do dia compara o acumulado de hoje com **ontem até o mesmo horário** e com a **média do mesmo dia da semana até o mesmo horário**. Confrontar o acumulado das dez da manhã com o fechamento do dia anterior produziria uma queda que não existe.

O comparativo mensal segue a mesma ideia: além do total do mês anterior fechado, mostra o mês anterior recortado no dia de hoje e a projeção do mês corrente pelo ritmo observado.

### 4. Três camadas de carregamento

1.  **Imediata** — dia corrente e totais do período.
2.  **Em paralelo** — comparativo mensal, que não depende do período escolhido.
3.  **Sob demanda** — padrões históricos e inteligência comercial. São as consultas caras; abri-las junto com a tela faria todo acesso pagar por um dado que muda uma vez por dia.

Os padrões ainda são amortizados no servidor pela tabela `dashboard_sales_hourly`, recalculada sozinha a cada doze horas. Quando entram vendas depois do último processamento, a resposta traz `isStale` e o painel oferece o botão de recalcular.

### 5. Cores dos gráficos

A paleta categórica vive em `--chart-1..5` (`src/index.css`) e é atribuída **em ordem fixa**, nunca ciclada. Os passos foram verificados para separação sob protanopia e deuteranopia e para contraste mínimo contra a superfície do card. Trocar um valor exige revalidar a paleta inteira: o que garante a leitura é a distância entre vizinhos, não a cor isolada.

Quebras nominais (categoria, forma de pagamento) usam **um único matiz** com o nome ao lado — colorir cada linha de um jeito gastaria o canal de cor para repetir o que o comprimento da barra já diz.
