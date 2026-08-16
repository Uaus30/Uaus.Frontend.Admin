# Módulo de Categorias (`features/categories`)

Este módulo gerencia a visualização, filtragem, criação, edição e visualização de relatórios de categorias de produtos do sistema. Ele segue o padrão **AI-First** para garantir que a lógica de negócios e as queries fiquem separadas dos componentes de apresentação.

---

## 📂 Estrutura de Arquivos

- `components/CategoryTable.tsx`: Renderiza a listagem de categorias com pesquisa, filtro de departamento, contagem de produtos e controles de paginação.
- `components/CategoryEditorModal.tsx`: Modal com formulário para criação e edição de categorias de produtos.
- `components/CategoryReportModal.tsx`: Modal com o desempenho real de vendas dos produtos da categoria nos últimos 30 dias. O corpo é compartilhado com o relatório de etiquetas em `@/components/catalog-report-body.tsx`.
- `hooks/useCategories.ts`: Estados de paginação/busca, formulário e o carregamento sob demanda do relatório (`GET /Categories/{id}/report`). Leitura e escrita vêm dos hooks do api-client.
- `types.ts`: Definições de tipos TypeScript para formulários, filtros e relatórios.

---

## 🔌 De onde vêm os dados

Nenhum caminho HTTP é montado nesta feature. `/Categories` mora em
`packages/api-client/src/hooks/categories.ts` e chega aqui como
`useGetCategories`, `useCreateCategory`, `useUpdateCategory` e
`useDeleteCategory`.

O que ainda passa por `@/services/categories.service` é só o catálogo completo de
departamentos, lido via `useAllDepartments` — e aquele arquivo hoje é um
reexport do api-client, não uma segunda implementação.

**Invalidação:** depois de salvar ou remover, o hook invalida
`getGetCategoriesQueryKey()`, o PREFIXO `["categories"]`. Invalidar a
combinação de parâmetros da tela alcançaria só a página aberta — as demais
páginas e buscas ficariam com o dado velho, sem erro nenhum: a listagem
simplesmente não atualiza.

---

## ⚙️ Regras de Negócio Importantes

### 1. Associação com Departamento

- Toda categoria deve pertencer obrigatoriamente a um departamento do sistema (`departmentId`).

### 2. Validações de Cadastro

- O nome da categoria é obrigatório e seus espaços em branco no início e final são removidos automaticamente (`trim`).
- A descrição é um campo textual longo opcional.

### 3. Relatório da Categoria

- Ao clicar em "Relatório", o sistema renderiza uma prévia com dados analíticos de faturamento, quantidade vendida, estoque e receita de produtos representativos associados a esta categoria.

### 4. Confirmação de exclusão

- A pergunta é do `ConfirmDialog` do `packages/ui`, renderizado pela própria `CategoryTable`. O texto diz **quantos produtos ficam sem categoria**, porque a categoria com produtos ligados e a categoria vazia custam coisas muito diferentes ao operador e o `window.confirm` não tinha como distinguir.
