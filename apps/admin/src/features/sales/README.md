# Módulo de Vendas (`features/sales`)

Este módulo gerencia o histórico de faturamento e registro de novas vendas (Checkout) no painel administrativo. Ele segue a metodologia **AI-First**.

---

## 📂 Estrutura de Arquivos

*   `components/SalesTable.tsx`: Lista o histórico de vendas realizadas, exibindo o ID da nota, data, cliente, badge do método de pagamento e valor total.
*   `components/NewSaleModal.tsx`: Interface de checkout contendo formulário para selecionar cliente, campo de pesquisa e adição dinâmica de produtos com cálculo de subtotal, descontos, seleção de método/status de pagamento e observações.
*   `components/SaleDetailsModal.tsx`: Visualizador contendo o espelho de faturamento da venda, observações e tabela com detalhamento de itens.
*   `hooks/useSales.ts`: Gerencia o fluxo de checkout, seleção de produtos e quantidades, remoção de itens, cálculo de totais, mutations de inserção e exclusão, além de consultas TanStack Query para carregar clientes, métodos de pagamento, enums de status e produtos enriquecidos.
*   `types.ts`: Tipagens estruturadas locais.

---

## ⚙️ Regras de Negócio Importantes

### 1. Relação Cliente / Consumidor Final
*   O cliente é opcional. Se não for selecionado, a venda é atribuída ao "Consumidor Final".

### 2. Validações do Checkout
*   Não é permitido finalizar vendas vazias (sem itens).
*   Ao selecionar um produto para adicionar, o sistema valida que a quantidade seja positiva e o produto esteja em estoque (maior que 0) e ativo.
*   Se um produto for adicionado mais de uma vez, a quantidade é incrementada na linha correspondente na tabela de itens em vez de criar uma linha duplicada.

### 3. Integração de Descontos e Cálculos
*   Os descontos são descontados diretamente sobre o valor do subtotal de itens. O total a pagar é blindado para não ficar negativo (`Math.max(0, subtotal - discount)`).
