# Módulo de Etiquetas (`features/tags`)

Este módulo gerencia a visualização, ordenação, criação, edição e relatórios analíticos de etiquetas (tags) de produtos no painel administrativo do sistema. Ele segue o padrão **AI-First** para garantir que a lógica de negócios e as consultas fiquem separadas dos componentes de apresentação.

---

## 📂 Estrutura de Arquivos

- `components/TagTable.tsx`: Renderiza a listagem de etiquetas com pesquisa, cabeçalhos clicáveis para ordenação por nome, quantidade de produtos ou data de cadastro, controles de paginação e botões de ação (editar, deletar, abrir relatório).
- `components/TagEditorModal.tsx`: Modal contendo o formulário para criação e edição de etiquetas, incluindo picker de cor e opção de definir como pública.
- `components/TagReportModal.tsx`: Modal com o desempenho real de vendas dos produtos da etiqueta nos últimos 30 dias (`GET /Tags/{id}/report`). O corpo é compartilhado com o relatório de categorias em `@/components/catalog-report-body.tsx`.
- `hooks/useTags.ts`: Estados de paginação, busca e ordenação, formulário e exibição do relatório. Leitura e escrita vêm dos hooks do api-client.
- `types.ts`: `TagForm` (formulário) e `EnrichedTag`, que DERIVA de `TagDto` em vez de repetir seus campos.

---

## 🔌 De onde vêm os dados

`/Tags` mora em `packages/api-client/src/hooks/tags.ts` e chega aqui como
`useGetTags`, `useCreateTag`, `useUpdateTag` e `useDeleteTag`.

**Invalidação:** o prefixo `["tags"]` (de `getGetTagsQueryKey()`) cobre três
consultas de telas diferentes — a tabela desta feature, o catálogo completo lido
por `useAllTags` e a busca do autocomplete de etiquetas do editor de produtos.
Por isso a invalidação é do prefixo: criar uma etiqueta pelo editor de produtos
já a fazia aparecer na tabela, mas não na busca da própria tela em que foi
criada, e o operador criava a duplicata.

**`createTag` devolve a etiqueta criada**, diferente das outras criações do
pacote, que devolvem `null`. O autocomplete precisa do id recém-gerado para
vincular a etiqueta ao produto na mesma interação.

---

## ⚙️ Regras de Negócio Importantes

### 1. Dados de Identificação da Etiqueta

- **Nome**: Campo obrigatório com espaços desnecessários removidos via `trim()`.
- **Cor**: Representada em formato hexadecimal (`#HEX`), utilizada na visualização no admin e catálogo de produtos. Há um botão para gerar cor aleatória.
- **Pública (Exibir no site)**: Flag que determina se a etiqueta é exibida publicamente no site para os clientes finais.

### 2. Ordenação na Tabela

- A listagem local permite ordenação pelas colunas:
  - **Nome**: Ordem alfabética ascendente/descendente usando `localeCompare`.
  - **Quantidade de Produtos**: Comparação numérica, usando o `productCount` devolvido pela própria listagem da API.
  - **Data de Cadastro**: Comparação cronológica dos registros.

### 3. Confirmação de exclusão

- A pergunta é do `ConfirmDialog` do `packages/ui`, renderizado pela própria `TagTable`. O texto diz de quantos produtos a etiqueta é retirada e, quando ela é pública, avisa que sai também da vitrine do site — informação que o `window.confirm` não tinha como dar.

### 4. Relatório da Etiqueta

- Exibe métricas consolidadas (faturamento, lucro, vendas e estoque) e a listagem de produtos que possuem a etiqueta. Produtos sem venda no período aparecem zerados em vez de sumirem: o relatório também serve para descobrir o que está parado na prateleira.
