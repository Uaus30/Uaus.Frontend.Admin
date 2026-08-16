# Módulo de Entradas de Estoque (`features/stock-entries`)

Este módulo gerencia o recebimento de mercadorias no estoque, permitindo o registro de notas fiscais de fornecedores, atualização instantânea de custo/preço de venda de produtos e o cancelamento de lançamentos. Ele segue o padrão **AI-First**.

---

## 📂 Estrutura de Arquivos

- `components/StockEntriesTable.tsx`: Exibe o histórico de entradas de estoque registradas com suporte a filtragem por fornecedor e controles de paginação.
- `components/StockEntryDetailsModal.tsx`: Modal exibindo o espelho da nota fiscal, produtos recebidos com seus respectivos custos e preços, além do controle para exclusão de lançamento (cancelamento de entrada).
- `components/NewStockEntryModal.tsx`: Modal contendo formulário de cabeçalho da nota (fornecedor, NF, data, observações) e a grade dos itens recebidos. O produto entra pelo [`ProductSearchPicker`](../../components/product-search-picker.tsx) compartilhado com as baixas de estoque. A data usa o `DatePicker` do [padrão de calendário](../../components/ui/README.md); como ele abre num portal fora do modal, o `DialogContent` aplica `guardCalendarDismiss` para não fechar o formulário ao escolher um dia.
- `hooks/useStockEntries.ts`: Centraliza requisições paginadas (`useGetPurchaseEntries`), detalhes (`useGetPurchaseEntryDetails`), mutations de recebimento (`useReceivePurchaseEntry`), mutations de exclusão (`useDeletePurchaseEntry`), e sincronização de query strings.
- `types.ts`: Tipagens estruturadas locais.

---

## ⚙️ Regras de Negócio Importantes

### 1. O produto entra por busca, não por lista

- O catálogo passa de mil produtos: quem escolhe é a API, pelo `ProductSearchPicker`, que aceita **nome ou código de barras** (o backend decide qual dos dois pelo formato do termo, a mesma regra da tela de produtos e do PDV).
- Escolher o mesmo produto duas vezes **soma na linha existente**. Duas linhas do mesmo produto virariam dois lotes com o mesmo custo, e conferir a nota contra a tela ficaria mais difícil sem ganho nenhum.
- A escolha já sugere o preço de venda (`price`) e o custo (`costPrice`) vigentes no cadastro. É sugestão, não imposição: a nota manda no custo, e os dois campos seguem editáveis.

### 2. A data viaja como instante LOCAL, sem fuso

- O payload leva `2026-08-16T00:00:00` — **nunca** `toISOString()`.
- Não é preciosismo de fuso: `entry_date` é `timestamp without time zone` e o Npgsql **recusa** gravar um `DateTime` com `Kind=Utc` nessa coluna. O `...T00:00:00.000Z` que o `toISOString()` produzia derrubava a gravação com **500**. Mesmo que gravasse, a entrada do dia 16 cairia no dia 15 no Brasil.
- A convenção completa está em `docs/fuso-horario.md` do backend.

### 3. Validações ao Salvar

- O fornecedor e a data são obrigatórios.
- Pelo menos um item deve ser adicionado.
- Todos os itens precisam de quantidade maior que zero e custos/preços não-negativos.

### 4. Ordenação e recarga da listagem

- A listagem vem do backend ordenada por **data de entrada decrescente e, no empate, por ID decrescente** (`PurchaseEntryService.GetAllAsync`). O empate é o caso comum: como a data é um dia-calendário à meia-noite, tudo que foi lançado no mesmo dia empata, e aí a nota registrada por último aparece primeiro.
- **Uma nota retroativa não vai para o topo** — ela cai na posição do dia que o operador escolheu. Isso é a ordenação funcionando, não um defeito: uma entrada lançada hoje com data de três dias atrás aparece três dias atrás.
- Depois de salvar, a tela **volta para a página 1** e invalida a listagem pelo prefixo da chave (`getGetPurchaseEntriesQueryKey`). Os dois passos importam: `refetch()` sozinho atualizaria só a página aberta e deixaria as outras no cache com dados velhos, e ficar na página 2 esconderia justamente a nota que acabou de ser lançada.
- Trocar o filtro de fornecedor também volta para a página 1, senão o recorte novo — que costuma ter menos páginas — mostraria "nenhuma entrada".

### 5. Cancelamento de Entrada

- A exclusão de uma entrada é permitida (controlada pelo flag `canDelete` do backend).
- O cancelamento remove os lotes de estoque lançados por esta entrada e atualiza/recalcula os saldos físicos vigentes dos produtos relacionados.
- Se o estoque de algum item da entrada já tiver sido vendido/consumido abaixo da quantidade de cancelamento, o backend retornará um erro impedindo a remoção.
