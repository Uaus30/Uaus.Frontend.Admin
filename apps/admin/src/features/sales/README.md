# Módulo de Vendas (`features/sales`)

Este módulo gerencia o histórico de faturamento e registro de novas vendas (Checkout) no painel administrativo. Ele segue a metodologia **AI-First**.

---

## 📂 Estrutura de Arquivos

- `components/SalesTable.tsx`: Lista o histórico de vendas realizadas, exibindo o ID da nota, data, cliente, badge do método de pagamento e valor total. A barra de filtros (busca, período, forma e status de pagamento) usa o `DateRangePicker` do [padrão de calendário](../../components/ui/README.md) e filtra na hora, sem botão de buscar.
- `components/NewSaleModal.tsx`: Interface de checkout contendo formulário para selecionar cliente, campo de pesquisa e adição dinâmica de produtos com cálculo de subtotal, descontos, seleção de método/status de pagamento e observações.
- `components/SaleDetailsModal.tsx`: Visualizador contendo o espelho de faturamento da venda, observações e tabela com detalhamento de itens.
- `hooks/useSales.ts`: Gerencia o fluxo de checkout, seleção de produtos e quantidades, remoção de itens, cálculo de totais, mutations de inserção e exclusão, além de consultas TanStack Query para carregar clientes, métodos de pagamento, enums de status e produtos enriquecidos.
- `types.ts`: Tipagens estruturadas locais.

---

## ⚙️ Regras de Negócio Importantes

### 1. Relação Cliente / Consumidor Final

- O cliente é opcional. Se não for selecionado, a venda é atribuída ao "Consumidor Final".

### 2. Validações do Checkout

- Não é permitido finalizar vendas vazias (sem itens).
- Ao selecionar um produto para adicionar, o sistema valida que a quantidade seja positiva e o produto esteja em estoque (maior que 0) e ativo.
- Se um produto for adicionado mais de uma vez, a quantidade é incrementada na linha correspondente na tabela de itens em vez de criar uma linha duplicada.

### 3. Integração de Descontos e Cálculos

- Os descontos são descontados diretamente sobre o valor do subtotal de itens. O total a pagar é blindado para não ficar negativo (`Math.max(0, subtotal - discount)`).

### 4. Paginação do histórico

- `SALES_PAGE_SIZE` (15) é exportado pelo hook e é o mesmo número usado no `limit` da consulta e no rodapé. Enquanto era um literal no hook e outro de reserva na tabela, mudar um dos dois desalinhava a contagem sem quebrar nada visível.
- O rodapé antigo decidia o "Próxima" por `data.length < limit`. Isso **erra** quando o total é múltiplo exato da página: com 30 vendas em páginas de 15, a página 2 vem cheia, o botão continua liberado e o operador cai numa página vazia. O `TablePagination` decide pelo total.

### 5. Desconto de item no detalhe da venda

- A API grava o item com `unitPrice` **líquido** e o desconto unitário à parte (`discount`); o `discount` do cabeçalho da venda não inclui esse abatimento. Por isso o rodapé do `SaleDetailsModal` soma os dois com `computeSaleDiscountTotal` do `@workspace/core` — a mesma conta do histórico e do cupom do PDV. Antes o modal dizia "sem desconto" para a venda remarcada só no item.
- Para a conta fechar de cima para baixo, o "Subtotal Itens" sai a preço de **tabela** (`unitPrice + discount`, vezes a quantidade): `22,00 − 2,00 = 20,00`. Na tabela, o item com desconto mostra o preço de tabela riscado abaixo do praticado, como o carrinho do PDV faz.
- O lucro continua sendo o subtotal líquido menos o custo: é a semântica do backend (`Profit = Subtotal − TotalCost`), bruta de desconto de cabeçalho.
