# Módulo de Visão Geral (`features/dashboard`)

Painel de indicadores da loja. Consome os endpoints de `/Dashboard` no backend e
não tem nenhum dado simulado: todos os números vêm de vendas reais.

---

## 📂 Estrutura de Arquivos

### Hooks

- `hooks/useDashboard.ts`: período exibido, base de comparação dos cards e visão geral do intervalo (KPIs, quebras, ranking). O período vive aqui, e não em cada painel, para que os cards e as quebras nunca mostrem recortes diferentes lado a lado.
- `hooks/useLiveToday.ts`: faturamento do dia corrente, com atualização automática a cada minuto.
- `hooks/useMonthlyComparison.ts`: mês atual e anterior dia a dia, projeção do mês e régua do dia "normal" (`reference`).
- `hooks/useChampions.ts`: produtos campeões numa janela fixa de 30 dias, com o "Ver mais" (+10 por clique, até 100).
- `hooks/useSalesPatterns.ts`: padrões históricos, **carregados sob demanda**.
- `hooks/useSalesIntelligence.ts`: reposição e análise de cesta, **carregadas sob demanda**.

### Componentes

- `components/PeriodSelector.tsx`: cabeçalho com o período em vigor e os controles que o mudam (ver [padrão de calendário](../../components/ui/README.md)).
- `components/StatTile.tsx` / `components/DashboardKpis.tsx`: cards de faturamento, lucro, vendas e ticket médio.
- `components/LiveTodayCard.tsx`: número em destaque do dia, comparativos e faturamento por hora.
- `components/MonthHeatmap.tsx`: matriz de faturamento por dia do mês (calendário de segunda a sábado) com o total de cada semana.
- `components/MonthComparisonCard.tsx`: "Ritmo do mês" — curva acumulada do mês atual contra o anterior.
- `components/DepartmentBreakdownCard.tsx`: faturamento por departamento, com variação contra a base e as categorias de cada um ao clicar.
- `components/RevenueBreakdownCard.tsx`: quebra do faturamento por forma de pagamento.
- `components/ChampionsTable.tsx`: produtos campeões — top por lucro dos últimos 30 dias, estoque como alerta e "Ver mais".
- `components/PatternsPanel.tsx` + `components/PatternChart.tsx`: padrões por dia da semana, hora do dia e dia do mês.
- `components/IntelligencePanel.tsx` + `components/RestockList.tsx` + `components/BasketInsights.tsx`: inteligência comercial.
- `components/chart-primitives.tsx`: moldura, tooltip, legenda e especificações visuais compartilhadas.

### Apoio

- `types.ts`: contratos espelhando os DTOs de `/Dashboard`.
- `utils.ts`: resolução de períodos e da base de comparação, variação percentual e formatadores.
- `breakdowns.ts`: linhas do card de departamentos (sete + "Demais") e leituras dos campeões (mudança de posição, duração do estoque).
- `heatmap.ts`: regras da matriz — faixa de cor, seta de fora do normal e comparação semanal.

---

## ⚙️ Regras de Negócio Importantes

### 1. Definição de faturamento e lucro

- **Faturamento** é a soma de `sales.total`, que já está **líquido** do desconto da venda.
- **Lucro** é a soma do lucro dos itens **menos** o desconto do cabeçalho. `sale_items.profit` é calculado sobre o preço cheio e não enxerga o abatimento dado no fechamento; sem essa subtração o painel reportaria lucro maior que o real em toda venda com desconto.
- Vendas canceladas (`PaymentStatus.Cancelled`) ficam fora de todos os números, o mesmo critério do resumo de caixa.

### 2. Períodos

Presets: **Este mês** (padrão, do dia 1 até hoje), **Mês passado**, **7 dias**, **30 dias**, **90 dias** e **1 ano**; as janelas móveis contam o dia de hoje. Não há "Hoje": o card do dia corrente já responde isso. O intervalo personalizado é aplicado assim que as duas pontas são escolhidas no calendário — por isso `handleApplyCustom` recebe as datas explicitamente, já que o estado do rascunho ainda guarda o valor anterior.

As datas são formatadas com `formatDateInput` (`yyyy-MM-dd` local) e **nunca** com `toISOString()`: o backend grava e compara datas no horário de Brasília, e uma data em UTC deslocaria o recorte (ver `docs/fuso-horario.md` no backend).

### 3. Comparativos recortados no mesmo horário

O card do dia compara o acumulado de hoje com **ontem até o mesmo horário** e com a **média do mesmo dia da semana até o mesmo horário**. Confrontar o acumulado das dez da manhã com o fechamento do dia anterior produziria uma queda que não existe.

### 3.1. Base de comparação dos cards (`resolveComparison`)

- **Este mês:** os mesmos dias da semana, **quatro semanas antes** (cinco depois do dia 28, para as janelas não se sobreporem). O "mesmo dia do mês anterior" mistura dias da semana: em 04/10/2026, 1 a 3/10 (qui a sáb) contra 1 a 3/09 (ter a qui) dava +72%; alinhado, +21%. Nesta loja o sábado fatura em média 2,3 vezes a segunda.
- **Mês passado:** o mês anterior inteiro.
- **Janelas móveis e intervalo livre:** o período imediatamente anterior, de mesma duração.
- **Período que termina hoje:** o último dia da base conta só até o horário atual (corte feito no backend). Sem isso, às 10h o parcial de hoje era comparado com um dia já fechado e os cards abriam o dia em queda — em 01/10/2026 às 10h, R$ 40 contra R$ 328 dava −88%. Vale também para a variação dos departamentos.

O card mostra só o rótulo curto ("vs 4 semanas antes"); as datas exatas e o porquê ficam na dica que abre ao passar o mouse. A "Projeção do mês" aparece no card de faturamento só quando o período é o mês corrente.

### 3.2. Matriz de faturamento diário

- Calendário de **segunda a sábado** — a loja não abre aos domingos; a coluna de domingo só aparece se o mês tiver venda num domingo.
- **Cor pela régua de um dia normal**: a média dos dias **com venda** dos três meses fechados (`reference` em `/Dashboard/monthly`), numa **escala contínua** (`heatPosition`): cada valor ganha o seu tom, interpolado entre pontos em 0×, 0,5×, 0,9×, 1,1×, 1,5× e 2× a régua (de 2× para cima, o tom máximo). Com faixas fixas, R$ 15 e R$ 42 — ou R$ 445 e R$ 859 — saíam do mesmo tom, e o dono pediu ver a diferença (04/10/2026). Não é o maior dia do mês (um dia fora da curva apagaria o resto) nem quantis (que pintariam um mês fraco tão colorido quanto um forte). A régua é a mesma ao alternar para o mês anterior, para as cores serem comparáveis.
- **Seta ▲▼**: o dia ficou 30% acima ou abaixo da média daquele dia da semana (com pelo menos 3 ocorrências). A cor deixa o sábado sempre escuro; a seta mostra o sábado fraco ou a terça excelente. Hoje e dias sem venda não ganham seta.
- **Coluna "Semana"**: total da semana e variação contra os mesmos dias da semana anterior (que podem estar no mês anterior). Substitui o antigo card "semana atual x anterior".

A curva acumulada ("Ritmo do mês") não escreve percentual: compararia pelo dia do mês e contradiria os cards no começo de todo mês.

### 3.3. Faturamento por departamento

Substituiu o card por categoria, que não se lia: em 04/10/2026, 59 categorias venderam em 30 dias e a maior tinha 6,8% — a cauda agrupada em "Outros" ficava com 62%. Por departamento (21 na loja), os sete primeiros cobrem 91%; o card mostra sete e junta o resto em "Demais (n)" (só se sobrar mais de um). Cada linha traz a variação contra a mesma base dos cards e, ao clicar, as cinco maiores categorias do departamento (`parentId` em `byCategory`). O backend agrupa direto por departamento: somar as categorias contaria duas vezes a venda com itens de duas delas.

### 3.4. Produtos campeões

- Ranking por **lucro** (decisão do dono), depois do rateio do desconto manual — ordenar pelo lucro bruto poria na frente o produto caro que, descontado, lucrou menos. `/Dashboard/champions`.
- Janela **fixa de 30 dias**, fora do seletor: no começo do mês o "Este mês" tem poucos dias para um ranking. O card diz a janela no título.
- Estoque como **alerta ativo**: só o problema ganha cor. A régua é a duração no ritmo de venda (esgotado; menos de 7 dias em vermelho; menos de 15 dias ou no mínimo em âmbar) — em 04/10/2026 os dez campeões tinham `min_stock` zero, e "12 un" não dizia se durava dois dias ou dois meses. Controle de estoque desligado não gera alerta. "A caminho" segue a mesma regra do relatório de estoque baixo (itens da compra em aberto).
- Mudança de posição contra os 30 dias anteriores ("novo", ▲, ▼) e participação no lucro total. "Ver mais" pede de novo com +10, até 100.

### 4. Três camadas de carregamento

1.  **Imediata** — dia corrente e totais do período.
2.  **Em paralelo** — mês corrente e anterior (matriz e curva), que não dependem do período escolhido.
3.  **Sob demanda** — padrões históricos e inteligência comercial. São as consultas caras; abri-las junto com a tela faria todo acesso pagar por um dado que muda uma vez por dia.

Os padrões ainda são amortizados no servidor pela tabela `dashboard_sales_hourly`, recalculada sozinha a cada doze horas. Quando entram vendas depois do último processamento, a resposta traz `isStale` e o painel oferece o botão de recalcular.

### 5. Cores dos gráficos

A paleta categórica vive em `--chart-1..5` (`src/index.css`) e é atribuída **em ordem fixa**, nunca ciclada. Os passos foram verificados para separação sob protanopia e deuteranopia e para contraste mínimo contra a superfície do card. Trocar um valor exige revalidar a paleta inteira: o que garante a leitura é a distância entre vizinhos, não a cor isolada.

A matriz diária usa a escala verde `--heat-0..5`, do **verde claro (dia fraco) ao verde escuro e saturado (dia forte)** — a leitura que o dono pediu em 04/10/2026; a primeira versão seguia a convenção de tema escuro (mais forte = mais claro) e foi invertida. A cor intermediária sai de `color-mix` em OKLab. A escala foi validada contra o fundo do card (o tom mais escuro fica a 3,35:1 dele); a tinta do número é verde-escura sobre os tons claros e branca a partir do meio entre `--heat-3` e `--heat-4`.

Quebras nominais (categoria, forma de pagamento) usam **um único matiz** com o nome ao lado — colorir cada linha de um jeito gastaria o canal de cor para repetir o que o comprimento da barra já diz.
