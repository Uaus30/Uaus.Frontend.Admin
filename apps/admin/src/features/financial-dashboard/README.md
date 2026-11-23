# Painel Financeiro (`features/financial-dashboard`)

O financeiro do mês numa tela só (rota `/financeiro/painel`, primeiro item do grupo Financeiro, desde 23/11/2026): se o mês aguenta as compras, de onde veio o dinheiro e o que ficou em cada fechamento. Contrato em `PLANO-FINANCEIRO.md` (seções 2, 6.1 e 7.1). A tela é **somente leitura**.

## Estrutura de Arquivos

- `hooks/useFinancialDashboard.ts`: o mês escolhido (o corrente por padrão, sem passar dele) e as cinco leituras — a faixa (`useGetPurchaseBudget`), o resumo do mês (`useGetFinancialReportSummary`, do dia 1 ao último dia), os aportes do mês, o acumulado por sócio e os últimos 12 fechamentos.
- `components/BudgetBandCard.tsx`: a faixa de compras — cor, ícone, frase, o "pode comprar", o aporte que volta ao verde, as pendentes simuladas e o aviso de faixa provisória com o botão do fechamento.
- `components/MonthNumbersCard.tsx`: "O mês em números", cada linha levando à tela de origem.
- `components/StockAtCostCard.tsx`: estoque de hoje a custo e dias de estoque.
- `components/ContributionsCard.tsx`: aportes do mês, acumulado por sócio e o atalho "Lançar aporte".
- `components/ClosingsHistoryCard.tsx`: os meses fechados, um por linha.
- `financial-dashboard-route.ts`: o caminho da tela, usado pelo menu, pela faixa de Compras e pelo cartão do Dashboard.
- O seletor de mês é o `components/month-switcher.tsx` do app (também usado em Aportes); a cor, o ícone e as frases da faixa moram em `lib/purchase-band.ts`, os mesmos de Compras e do Dashboard.

## Regras de Negócio

### 1. A faixa de compras

- Verde: compras pagas no mês (K) ≤ custo das vendas (C) + saldo inicial (S) + aportes (A). Amarelo: passou do verde, mas vendas + S + A − custos fixos ainda cobrem as compras. Vermelho: nem isso. **O verde é testado primeiro** (decisão 7): no começo do mês as vendas ainda não cobrem os fixos, e comprar dentro do custo vendido não pode dar vermelho.
- A faixa vem do servidor; se não vier, sai das duas linhas pela mesma regra do core (`purchaseBandFor`).
- **"Pode comprar R$ X no verde · R$ Y até o vermelho"**. O "até o vermelho" só aparece quando há amarelo pela frente: com a linha vermelha abaixo da verde (começo do mês), passar do verde já é vermelho, e mostrar as duas folgas seria contraditório. Fora do verde: "Volta ao verde com R$ Z de aporte".
- **"Com saldo" / "com aporte"**: quando a faixa só é aquela por causa de S + A (`reliesOnBalance`), a frase diz. Verde com saldo é estoque crescendo — por isso o cartão de estoque a custo fica ao lado.
- **Provisória**: com o mês anterior sem fechamento no fluxo novo, S fica fora; o aviso diz qual mês fechar e o botão leva aos Fechamentos.
- Compras **Pendentes** não contam em K: aparecem como planejadas ("Se fizer as pendentes (R$ 600), o mês vai para amarelo"); as sem valor são contadas à parte.

### 2. O mês em números

- Saldo inicial, aportes, vendas brutas, descontos (no item com a promoção como parcela, na venda com o cupom como parcela), vendas líquidas, custo das vendas, compras pagas (com as planejadas), custos fixos, baixas e sobras. **Cada linha leva à tela de origem**: conferir, em vez de acreditar.
- S, A, V, C, K e F vêm da faixa; vendas brutas, descontos, baixas e sobras vêm do resumo do mês. No backend os dois saem do mesmo serviço de totais — "uma conta só" —, então o V e o K das duas respostas são o mesmo número.

### 3. Aportes

- Os do mês e o acumulado de cada sócio desde a abertura. **Aporte não é dívida** (decisão 9): não há saldo devedor nem devolução para mostrar.
- "Lançar aporte" abre a tela de Aportes com a modal já aberta (`?novo=1`). Em mês fechado o atalho some.

### 4. Histórico dos meses fechados

- Vendas líquidas, descontos, compras pagas, baixas, lucro líquido, retiradas, saldo final e a faixa do fim do mês.
- **Os fechamentos da conta antiga** (`calculationVersion` 1, março a outubro/2026) não são recalculados: mostram "—" no que não tinham (descontos por origem, compras pagas, retiradas, saldo, faixa) — e não o zero da API, que pareceria dado.
- No celular ficam mês, lucro, saldo e faixa; o resto está a um toque, nos Fechamentos (tabela larga perde coluna, nunca rola).

### 5. Mês e fuso

- O mês é `"yyyy-MM"` dos componentes **locais** (`toMonthKey`, do core), nunca `toISOString()`: às 22h do dia 30 em Brasília o UTC já está no mês seguinte. O teste do hook roda também com o processo em UTC.
- Mês futuro não existe: o seletor para no corrente.
