# Módulo Fechamentos Financeiros (Admin)

Fechamento financeiro **mensal** (rota `/financeiro/fechamentos`): o documento oficial que congela os números do mês, o rateio de lucros entre os sócios, as retiradas e **o saldo que fica para a loja** — que abre o mês seguinte. Relatórios são prévias ao vivo; o fechamento é o que vale. Contrato da conta nova em `PLANO-FINANCEIRO.md` (seções 3, 6.1 e 7.5).

---

## Estrutura de Arquivos

- `hooks/useFinancialClosings.ts`: listagem paginada sem filtro, detalhe e exclusão.
- `hooks/useNewClosing.ts`: o diálogo de novo fechamento em três passos — prévia, recálculos, retiradas, saldo e confirmação.
- `hooks/useClosingCompetence.ts`: a competência — ano, mês, o `next` e o estado de cada mês no select.
- `components/NewClosingDialog.tsx`: os três passos (competência → resultado e caixa → retiradas e saldo).
- `components/CompetencePicker.tsx`: passo 1 — selects de ano e mês, legenda dos estados e o atalho "Mês sugerido".
- `components/ResultAndCashStep.tsx`: passo 2 — avisos, resultado, custos variáveis, custos fixos e caixa.
- `components/BalanceStep.tsx`: passo 3 — saldo inicial da implantação, retiradas, saldo confirmado e observações.
- `components/ClosingResultBlock.tsx`, `ClosingCashBlock.tsx`, `ClosingSharesBlock.tsx`: os três blocos da conta, os mesmos na prévia e no documento. `StatementRow.tsx` é a linha da conta.
- `components/ClosingDetailsDialog.tsx`: o documento congelado e a exclusão (só no último).
- `components/VariableCostsTable.tsx`, `FixedCostItemsTable.tsx`, `FinancialClosingsTable.tsx`.
- `month-selection.ts`: domínio da competência (mês/ano ↔ período, meses fechados, estados do select). Puro e testado.
- `closing-balance.ts`: leitura dos campos do passo 3 e a conferência do saldo. Puro e testado.
- `closing-statement.ts`: fechamento da conta antiga e o "—" dos campos novos.
- `financial-closings-route.ts`: o caminho da tela (o botão da faixa provisória leva para cá).

---

## Regras de Negócio

### 0. A unidade é o mês, não o período (06/09/2026)

- A escolha do que fechar é **mês + ano**. O período continua sendo o que o backend grava e valida: `monthRange` converte a competência em `periodStart`/`periodEnd`, e `describePeriod` faz o caminho de volta.
- **Fechamentos antigos, de período livre, continuam válidos.** Onde não cobrem um mês cheio, a tela mostra o intervalo de datas.
- A listagem não tem filtro: um documento por mês, do mais recente para o mais antigo.

### 1. A corrente de saldos (23/11/2026)

- **O saldo confirmado de um mês é o saldo inicial do seguinte.** Por isso **só se fecha M com M−1 fechado no fluxo novo**; a exceção é a **implantação** (o primeiro fechamento do fluxo novo), em que o saldo inicial é opcional.
- O diálogo abre no mês que `GET /FinancialClosings/next` aponta, já escolhido; os outros aparecem travados com o motivo. Se o `next` falhar, a sugestão cai no último mês encerrado e o select volta à regra antiga — o servidor recusa o que estiver fora da corrente.
- **Só o último fechamento pode ser excluído**: excluir um do meio deixaria o seguinte com um saldo inicial que não existe mais. O botão só aparece no último (`isLatest`); nos outros, a tela diz por quê. Excluir o último devolve o mês seguinte ao estado "aguardando".

### 1.1. Cores dos meses no select

Psicologia das cores, com ícone e texto redundantes (cor sozinha não informa quem não a distingue):

| Estado                     | Cor               | Ícone         | Selecionável                   |
| -------------------------- | ----------------- | ------------- | ------------------------------ |
| Disponível                 | verde (`emerald`) | check         | sim — é o mês que aguarda      |
| Em andamento               | âmbar (`amber`)   | círculo traço | sim, com aviso de dado parcial |
| Fechado                    | cinza (`muted`)   | cadeado       | **não**                        |
| Não iniciado               | cinza (`muted`)   | calendário ✗  | **não**                        |
| Aguardando (mês anterior)  | cinza (`muted`)   | ampulheta     | **não** — "Aguardando outubro" |
| Antes do último fechamento | cinza (`muted`)   | histórico     | **não**                        |

- "Fechado" sai da **sobreposição** com fechamentos existentes, não da igualdade de período: um fechamento antigo de 15/07 a 10/08 trava julho **e** agosto.

### 2. Os três passos

1. **Competência**: o mês e o cálculo da prévia. Nada é gravado.
2. **Resultado e caixa**: as contas das seções 3.1 e 3.2 do plano, com os custos variáveis editáveis; descontos por origem e baixas por motivo.
3. **Retiradas e saldo**: a retirada de cada sócio ao lado do que o rateio dá a ele; o saldo confirmado; a observação da diferença; e, na implantação, o saldo no início do mês (opcional).

**Toda entrada que muda a conta refaz a prévia no servidor** — gasto eventual, retirada, saldo inicial — e a tela vive da resposta: nada é somado no cliente. A retirada vai à conta ao sair do campo; enquanto há retirada digitada fora da conta (ou recálculo em voo), "Confirmar" fica travado — confirmar ali gravaria um saldo que a tela não mostrou. Clicar nele com a retirada ainda fora leva à conta primeiro.

### 3. O resultado (o lucro, que é rateado)

```
  Vendas brutas − descontos concedidos = vendas líquidas
− custo das vendas = lucro bruto
− baixas a custo + sobras de estoque − custos fixos − custos variáveis = lucro líquido
```

- **Descontos por origem**: no item (com a promoção como parcela) e na venda (com o cupom como parcela). Parcela nunca se soma de novo.
- **Baixas entram no lucro** pelo custo FIFO congelado — é o produto que saiu sem virar dinheiro. Continuam fora do faturamento, do caixa e da faixa. **Sobras** (entradas de ajuste manual) somam.
- O lucro líquido é rateado pelos percentuais dos sócios; lucro negativo distribui prejuízo, em vermelho.

### 4. O caixa (o saldo, que abre o mês seguinte)

```
  Saldo inicial + vendas + aportes − compras pagas − fixos − variáveis − retiradas
= saldo calculado
  saldo confirmado (digitado)   →   diferença = confirmado − calculado
```

- **O saldo confirmado nasce igual ao calculado e o acompanha** a cada recálculo, até alguém mexer nele.
- **Diferença acima de R$ 1,00, para mais ou para menos, exige observação** (até 300 caracteres): taxa de cartão, venda no cartão que não caiu, despesa fora do sistema, erro de lançamento. Saldo chutado carregaria o erro para todos os meses seguintes.
- **Implantação sem saldo inicial**: não há calculado nem diferença; registra-se só o confirmado, que então é digitado.
- **Avisos, nunca bloqueio** (decisão F): retirada acima do que o rateio dá, retiradas acima do caixa do mês (vendas + aportes − compras pagas − fixos − variáveis) e saldo confirmado negativo.
- "Entradas de estoque" (o antigo "Compras", pela data de entrada) aparece só como informação; o dinheiro que saiu é "Compras pagas".

### 5. A conta antiga não é recalculada

- Os fechamentos de março a outubro/2026 têm `calculationVersion` 1: a tela diz "fechado com a conta antiga: baixas fora do lucro e só o desconto da venda", e mostra "—" nos campos novos (vendas brutas, descontos por origem, sobras, aportes, compras pagas, retiradas, saldos) — nunca o zero da API, que pareceria dado.

### 6. Fechamento congela tudo

- Na confirmação o servidor **recalcula** tudo e recusa o que a prévia só avisava: período que não começa depois do último fechamento, mês anterior sem fechamento no fluxo novo (fora da implantação), saldo confirmado ausente e diferença sem observação. A confirmação envia a entrada **congelada com a prévia exibida** (período, gastos eventuais, retiradas — uma por sócio do rateio — e o saldo inicial), mais o saldo confirmado e as observações.
- Editar um sócio ou um custo fixo depois não altera fechamentos existentes.
- Confirmar ou excluir invalida os fechamentos (o prefixo alcança o `next`), a faixa de compras e os aportes: o saldo abre o mês seguinte, e o mês fechado deixa de aceitar aporte.

### 7. Custos variáveis: o que o operador digita (06/09/2026)

- Gastos eventuais do mês (a conta do contador, o conserto do freezer) que descem do lucro bruto como os fixos. **A tabela lista o eco do servidor**, não o estado local: falha de rede não deixa a linha na tela com o valor fora da conta.
- Voltar ao passo da competência **mantém** os gastos e as retiradas digitados; só a prévia é descartada.
- Descrição obrigatória e valor maior que zero.

### 8. Excluir é logado

- O `ConfirmDialog` do detalhe cita o período e o lucro líquido, e avisa: o mês volta a aguardar e o seguinte volta a esperar por ele; refazer pode dar outro número (sócios, percentuais e custos fixos de hoje). O backend grava log com o usuário.
- `handleDeleteClosing` devolve a Promise da mutação: falhando, o diálogo permanece aberto com o erro no toast.
