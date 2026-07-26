# Módulo de Categorias (`features/categories`)

Este módulo gerencia a visualização, filtragem, criação, edição e visualização de relatórios de categorias de produtos do sistema. Ele segue o padrão **AI-First** para garantir que a lógica de negócios e as queries fiquem separadas dos componentes de apresentação.

---

## 📂 Estrutura de Arquivos

*   `components/CategoryTable.tsx`: Renderiza a listagem de categorias com pesquisa, filtro de departamento, contagem de produtos e controles de paginação.
*   `components/CategoryEditorModal.tsx`: Modal com formulário para criação e edição de categorias de produtos.
*   `components/CategoryReportModal.tsx`: Modal com o desempenho real de vendas dos produtos da categoria nos últimos 30 dias. O corpo é compartilhado com o relatório de etiquetas em `components/catalog-report-body.tsx`.
*   `hooks/useCategories.ts`: Centraliza as consultas do TanStack Query, estados de paginação/busca, mutations para criação, edição e deleção de categorias, além do carregamento sob demanda do relatório (`GET /Categories/{id}/report`).
*   `types.ts`: Definições de tipos TypeScript para formulários, filtros e relatórios.

---

## ⚙️ Regras de Negócio Importantes

### 1. Associação com Departamento
*   Toda categoria deve pertencer obrigatoriamente a um departamento do sistema (`departmentId`).

### 2. Validações de Cadastro
*   O nome da categoria é obrigatório e seus espaços em branco no início e final são removidos automaticamente (`trim`).
*   A descrição é um campo textual longo opcional.

### 3. Relatório da Categoria
*   Ao clicar em "Relatório", o sistema renderiza uma prévia com dados analíticos de faturamento, quantidade vendida, estoque e receita de produtos representativos associados a esta categoria.
