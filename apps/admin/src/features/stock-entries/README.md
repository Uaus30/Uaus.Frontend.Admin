# Módulo de Entradas de Estoque (`features/stock-entries`)

Este módulo gerencia o recebimento de mercadorias no estoque, permitindo o registro de notas fiscais de fornecedores, atualização instantânea de custo/preço de venda de produtos e o cancelamento de lançamentos. Ele segue o padrão **AI-First**.

---

## 📂 Estrutura de Arquivos

*   `components/StockEntriesTable.tsx`: Exibe o histórico de entradas de estoque registradas com suporte a filtragem por fornecedor e controles de paginação.
*   `components/StockEntryDetailsModal.tsx`: Modal exibindo o espelho da nota fiscal, produtos recebidos com seus respectivos custos e preços, além do controle para exclusão de lançamento (cancelamento de entrada).
*   `components/NewStockEntryModal.tsx`: Modal contendo formulário de cabeçalho da nota (fornecedor, NF, data, observações) e uma grade dinâmica onde o usuário pode adicionar, configurar e remover itens recebidos.
*   `hooks/useStockEntries.ts`: Centraliza requisições paginadas (`useGetPurchaseEntries`), detalhes (`useGetPurchaseEntryDetails`), mutations de recebimento (`useReceivePurchaseEntry`), mutations de exclusão (`useDeletePurchaseEntry`), e sincronização de query strings.
*   `types.ts`: Tipagens estruturadas locais.

---

## ⚙️ Regras de Negócio Importantes

### 1. Preenchimento Automático Inteligente
*   Ao adicionar um item e selecionar um produto no select, o sistema busca automaticamente no catálogo o preço de venda (`price`) e o custo médio (`costPrice`) vigentes para preencher os respectivos campos, otimizando o fluxo de digitação.

### 2. Validações ao Salvar
*   O fornecedor é obrigatório.
*   Pelo menos um item deve ser adicionado.
*   Todos os itens devem ter um produto selecionado, quantidade maior que zero, e custos/preços não-negativos.

### 3. Cancelamento de Entrada
*   A exclusão de uma entrada é permitida (controlada pelo flag `canDelete` do backend).
*   O cancelamento remove os lotes de estoque lançados por esta entrada e atualiza/recalcula os saldos físicos vigentes dos produtos relacionados.
*   Se o estoque de algum item da entrada já tiver sido vendido/consumido abaixo da quantidade de cancelamento, o backend retornará um erro impedindo a remoção.
