# Módulo Fechamentos Financeiros (Admin)

Fechamento financeiro por período (rota futura `/financeiro/fechamentos`): o documento oficial que congela os números do período e o rateio de lucros entre os sócios. Relatórios são prévias ao vivo; o fechamento é o que vale.

---

## Estrutura de Arquivos

*   `components/FinancialClosingsTable.tsx`: Tabela dos fechamentos confirmados; a linha abre o detalhe. Não há edição — fechamento se refaz excluindo.
*   `components/NewClosingDialog.tsx`: Diálogo em dois passos: período (com atalho "Mês anterior") → prévia calculada no servidor + observações + confirmação.
*   `components/ClosingDetailsDialog.tsx`: Detalhe com os números congelados, rateio, observações, autoria e o botão de exclusão.
*   `components/ClosingSummary.tsx`: Resumo financeiro compartilhado entre a prévia e o detalhe (cards, custos fixos por competência, rateio e warnings).
*   `hooks/useFinancialClosings.ts`: Hook controlador único — listagem paginada com filtro de período, mutações de prévia/confirmação/exclusão e estado dos diálogos. A confirmação envia sempre o período **congelado junto com a prévia** exibida, nunca o estado atual do calendário.
*   `hooks/__tests__/useFinancialClosings.test.tsx`: Testes unitários do hook controlador (Vitest + React Testing Library).
*   `types.ts`: Tipos locais (`NewClosingStep`, `ClosingNumbers`) + re-export dos DTOs do api-client.

---

## Regras de Negócio

### 1. Fechamento congela tudo
*   Na confirmação o servidor **recalcula** os números do período (nunca confia nos valores da prévia exibida no cliente) e grava faturamento, CMV, lucro bruto, custos fixos, lucro líquido e o rateio por sócio (nome, percentual e valor **congelados**).
*   Editar um sócio ou um custo fixo depois **não** altera fechamentos existentes — o histórico mora no próprio fechamento.

### 2. Sem status
*   Fechamento não tem rascunho nem aprovação: **só existe depois de confirmado**. A prévia (`POST /financialclosings/preview`) não persiste nada; soma de percentuais ≠ 100 e período parcial de mês viram *warnings* na prévia (a confirmação é que recusa).

### 3. Validações da confirmação
*   O servidor recusa: período inválido, sobreposição com fechamento existente e soma dos percentuais dos sócios ativos ≠ 100. As mensagens chegam ao usuário via `describeApiError`.

### 4. Competência mensal dos custos fixos
*   Cada mês-calendário tocado pelo período lança o valor mensal **cheio** de cada custo vigente (sem pró-rata) — por isso o atalho "Mês anterior" e a recomendação de fechar o mês-calendário completo.

### 5. Compras e perdas são informativas
*   Aparecem no resumo mas **não** entram no lucro líquido: o CMV já cobre o custo FIFO dos itens vendidos.

### 6. Lucro negativo distribui prejuízo
*   O rateio aceita lucro líquido negativo — os valores por sócio saem negativos, e a UI os destaca em vermelho.

### 7. Excluir permite refazer — e é logado
*   Excluir um fechamento libera o período para fechar de novo. É ação destrutiva de documento: o backend grava log (`LogType.FinancialClosingDeleted`) com período, lucro líquido e usuário, e o `window.confirm` avisa isso antes.
