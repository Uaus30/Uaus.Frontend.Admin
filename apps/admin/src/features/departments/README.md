# Módulo de Departamentos (`features/departments`)

Este módulo gerencia a visualização, filtragem, criação, edição e exclusão de departamentos organizacionais que servem para agrupar categorias de produtos.

---

## 📂 Estrutura de Arquivos

- `components/DepartmentTable.tsx`: Renderiza a listagem de departamentos com pesquisa, contagem de categorias vinculadas e paginação.
- `components/DepartmentEditorModal.tsx`: Modal contendo o formulário para criação e edição de departamentos.
- `hooks/useDepartments.ts`: Hook central que encapsula as requisições (Queries/Mutations) do TanStack Query, paginação, busca e contagem relacional de categorias vinculadas por departamento.
- `types.ts`: Definições de tipos TypeScript para os formulários e modelos de departamentos.

---

## ⚙️ Regras de Negócio Importantes

### 1. Hierarquia de Agrupamento

- Os departamentos representam o agrupamento primário do catálogo. Toda categoria criada deve apontar obrigatoriamente para um departamento existente.

### 2. Validações e Persistência

- O nome do departamento é de preenchimento obrigatório e seus espaços no início/fim são removidos (`trim`).
- A descrição do departamento é opcional.
- Ao criar ou editar um departamento, o sistema invalida as consultas locais para atualizar a contagem de categorias de produtos de forma reativa.
