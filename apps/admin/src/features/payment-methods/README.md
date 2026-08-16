# Módulo de Formas de Pagamento (Admin)

Este módulo é responsável pela administração das Formas de Pagamento e suas respectivas taxas de transação por parcelamento no painel administrativo.

## Estrutura de Arquivos

- `types.ts`: Tipagens estritas para formulários, DTOs e parcelamentos.
- `hooks/usePaymentMethods.ts`: Hook customizado responsável pela busca paginada, filtros, formulário de adição/edição de parcelas e envio das mutations do React Query.
- `components/PaymentMethodsTable.tsx`: Tabela de exibição das formas de pagamento cadastradas, badges de parcelas com taxas e ações rápidas.
- `components/PaymentMethodEditorModal.tsx`: Modal para cadastro e edição de formas de pagamento com inclusão e remoção dinâmica de parcelas (com taxa percentual).
- `hooks/__tests__/usePaymentMethods.test.tsx`: Testes unitários do hook controlador usando Vitest e React Testing Library.

## Regras de Negócio

- Todo cadastro de forma de pagamento exige um nome válido.
- Se nenhuma parcela for informada, o sistema assume o padrão **1x (à vista)** com **0% de taxa**.
- O usuário pode adicionar múltiplas parcelas (ex: 1x, 2x, 3x... 12x) e associar uma taxa percentual para cada uma.
- É mantida a obrigatoriedade de no mínimo 1 parcela ativa na lista.

### Excluir ≠ desativar

- Excluir apaga a forma **e todos os parcelamentos com as taxas configuradas neles**. É o dado que o operador não tem como recuperar depois, e é isso que o `ConfirmDialog` da tabela cita — o `window.confirm` anterior perguntava "Tem certeza?" e não dizia o que sumia junto.
- Para tirar a forma de circulação sem perder as taxas, o caminho é **desativar** pela edição. Vendas já registradas com ela continuam como estão nos dois casos.
- `handleDelete` relança o erro depois de mostrar o toast: o diálogo decide ficar aberto pela rejeição da Promise. Engolindo o erro ali, ele fecharia como se a exclusão tivesse dado certo, com o aviso de falha aparecendo por trás.

### Tamanho da página

- `PAGE_SIZE` é exportado pelo hook e usado tanto no `size` pedido à API quanto no rodapé. Eram dois literais `10` em arquivos diferentes — um no hook, outro na conta `page * 10 >= filteredItems` da página — que precisavam concordar sem nada garantindo que concordassem.
