# Módulo Fechamentos Financeiros (Admin)

Fechamento financeiro **mensal** (rota `/financeiro/fechamentos`): o documento oficial que congela os números do mês e o rateio de lucros entre os sócios. Relatórios são prévias ao vivo; o fechamento é o que vale.

---

## Estrutura de Arquivos

- `components/FinancialClosingsTable.tsx`: Tabela dos fechamentos confirmados; a linha abre o detalhe. Não há edição — fechamento se refaz excluindo.
- `components/NewClosingDialog.tsx`: Diálogo em dois passos: competência (mês/ano) → prévia calculada no servidor + observações + confirmação.
- `components/CompetencePicker.tsx`: Selects de ano e mês do passo 1, com o atalho "Último mês" e o travamento dos meses já fechados.
- `components/ClosingDetailsDialog.tsx`: Detalhe com os números congelados, rateio, observações, autoria e o botão de exclusão.
- `components/ClosingSummary.tsx`: Resumo financeiro compartilhado entre a prévia e o detalhe (cards, custos fixos por competência, rateio e warnings).
- `month-selection.ts`: Domínio da competência — conversão mês/ano ↔ período, meses fechados do ano, estados do select e rótulo do período na tela. Puro e testado.
- `hooks/useFinancialClosings.ts`: Hook controlador único — listagem paginada sem filtro, mutações de prévia/confirmação/exclusão e estado dos diálogos. A confirmação envia sempre o período **congelado junto com a prévia** exibida, nunca a competência atual do formulário.
- `__tests__/month-selection.test.ts` e `hooks/__tests__/useFinancialClosings.test.tsx`: Testes (Vitest + React Testing Library).
- `types.ts`: Tipos locais (`NewClosingStep`, `ClosingNumbers`), re-export dos tipos de competência + DTOs do api-client.

---

## Regras de Negócio

### 0. A unidade é o mês, não o período (06/09/2026)

- A escolha do que fechar é **mês + ano**, não mais um calendário de período livre: um select de ano (o atual pré-selecionado) e um select de mês. O atalho, antes "Mês anterior", agora se chama **"Último mês"** e seleciona o último mês-calendário encerrado.
- Isso alinha a tela ao que o cálculo já fazia: custos fixos entram por **competência mensal**, com o valor cheio de cada mês tocado. Fechar "01/08 a 15/08" lançava agosto inteiro de custo fixo contra meio mês de faturamento.
- **A listagem não tem mais filtro.** Fechamento é um documento por mês; com paginação e ordem decrescente, o mais recente já está na primeira linha. Filtrar por período o que já vem ordenado por período era um campo a preencher para não mudar nada.
- O período continua sendo o que o backend grava e valida (a API não mudou): `monthRange` converte a competência escolhida em `periodStart`/`periodEnd`, e `describePeriod` faz o caminho de volta na exibição.
- **Fechamentos antigos, de período livre, continuam válidos.** Onde eles não cobrem um mês cheio, a tela mostra o intervalo de datas em vez da competência — dizer "Agosto de 2026" num documento de 15/07 a 10/08 esconderia justamente o que ele tem de diferente.

### 0.1. Cores dos meses no select

Psicologia das cores, com ícone e texto redundantes (cor sozinha não informa quem não a distingue):

| Estado       | Cor               | Ícone         | Selecionável                   |
| ------------ | ----------------- | ------------- | ------------------------------ |
| Disponível   | verde (`emerald`) | check         | sim                            |
| Em andamento | âmbar (`amber`)   | círculo traço | sim, com aviso de dado parcial |
| Fechado      | cinza (`muted`)   | cadeado       | **não**                        |
| Não iniciado | cinza (`muted`)   | calendário ✗  | **não**                        |

- "Fechado" sai da **sobreposição** com fechamentos existentes, não da igualdade de período: um fechamento antigo de 15/07 a 10/08 trava julho **e** agosto, que é exatamente o que a confirmação recusaria.
- O atalho "Último mês" não passa pelo select e pode cair num mês já fechado. Quando isso acontece, o aviso vermelho aparece embaixo dos selects e "Calcular prévia" fica travado — em vez de deixar o usuário descobrir na recusa do servidor.

### 1. Fechamento congela tudo

- Na confirmação o servidor **recalcula** os números do período (nunca confia nos valores da prévia exibida no cliente) e grava faturamento, CMV, lucro bruto, custos fixos, lucro líquido e o rateio por sócio (nome, percentual e valor **congelados**).
- Editar um sócio ou um custo fixo depois **não** altera fechamentos existentes — o histórico mora no próprio fechamento.

### 2. Sem status

- Fechamento não tem rascunho nem aprovação: **só existe depois de confirmado**. A prévia (`POST /financialclosings/preview`) não persiste nada; soma de percentuais ≠ 100 e período parcial de mês viram _warnings_ na prévia (a confirmação é que recusa).

### 3. Validações da confirmação

- O servidor recusa: período inválido, sobreposição com fechamento existente e soma dos percentuais dos sócios ativos ≠ 100. As mensagens chegam ao usuário via `describeApiError`.

### 4. Competência mensal dos custos fixos

- Cada mês-calendário tocado pelo período lança o valor mensal **cheio** de cada custo vigente (sem pró-rata) — é a razão de a tela ter passado a trabalhar por mês, e não por período livre (regra 0).

### 5. Compras e perdas são informativas

- Aparecem no resumo mas **não** entram no lucro líquido: o CMV já cobre o custo FIFO dos itens vendidos.

### 6. Lucro negativo distribui prejuízo

- O rateio aceita lucro líquido negativo — os valores por sócio saem negativos, e a UI os destaca em vermelho.

### 7. Excluir permite refazer — e é logado

- Excluir um fechamento libera o período para fechar de novo. É ação destrutiva de documento: o backend grava log (`LogType.FinancialClosingDeleted`) com período, lucro líquido e usuário.
- O aviso disso é o `ConfirmDialog` do `ClosingDetailsDialog`, e ele cita o período e o lucro líquido da tela. Mora ali, e não no hook, porque é no detalhe que esses números estão visíveis — e porque um diálogo declarativo precisa de alguém que o renderize.
- O que o aviso precisa dizer, e o `window.confirm` anterior não dizia: **refazer o fechamento pode dar outro número.** O novo cálculo usa os sócios, percentuais e custos fixos de hoje, não os que estavam vigentes quando o período foi fechado.
- `handleDeleteClosing` devolve a Promise da mutação. O diálogo só fecha quando ela resolve; falhando, ele permanece aberto com o erro no toast, em vez de sumir sem dizer se o documento saiu.
