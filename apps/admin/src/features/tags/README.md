# Módulo de Etiquetas (`features/tags`)

Este módulo gerencia a visualização, ordenação, criação, edição e relatórios analíticos de etiquetas (tags) de produtos no painel administrativo do sistema. Ele segue o padrão **AI-First** para garantir que a lógica de negócios e as consultas fiquem separadas dos componentes de apresentação.

---

## 📂 Estrutura de Arquivos

*   `components/TagTable.tsx`: Renderiza a listagem de etiquetas com pesquisa, cabeçalhos clicáveis para ordenação por nome, quantidade de produtos ou data de cadastro, controles de paginação e botões de ação (editar, deletar, abrir relatório).
*   `components/TagEditorModal.tsx`: Modal contendo o formulário para criação e edição de etiquetas, incluindo picker de cor e opção de definir como pública.
*   `components/TagReportModal.tsx`: Modal exibindo o relatório mockado de faturamento e vendas por etiqueta.
*   `hooks/useTags.ts`: Centraliza as consultas do TanStack Query, estados de paginação, busca e ordenação, mutations para salvar e remover etiquetas, além do gerenciamento de exibição do relatório.
*   `types.ts`: Definições de tipos TypeScript para formulários, etiquetas e relatórios.

---

## ⚙️ Regras de Negócio Importantes

### 1. Dados de Identificação da Etiqueta
*   **Nome**: Campo obrigatório com espaços desnecessários removidos via `trim()`.
*   **Cor**: Representada em formato hexadecimal (`#HEX`), utilizada na visualização no admin e catálogo de produtos. Há um botão para gerar cor aleatória.
*   **Pública (Exibir no site)**: Flag que determina se a etiqueta é exibida publicamente no site para os clientes finais.

### 2. Ordenação na Tabela
*   A listagem local permite ordenação pelas colunas:
    *   **Nome**: Ordem alfabética ascendente/descendente usando `localeCompare`.
    *   **Quantidade de Produtos**: Comparação numérica (mockado).
    *   **Data de Cadastro**: Comparação cronológica dos registros.

### 3. Relatório da Etiqueta
*   Exibe métricas consolidadas (Faturamento total, Vendas e Estoque) bem como a listagem de produtos que possuem a etiqueta. Atualmente utiliza dados mockados via helper.
