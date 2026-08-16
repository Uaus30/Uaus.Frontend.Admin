# Módulo de Clientes (`features/customers`)

Este módulo gerencia a listagem, busca debounced, paginação, cadastro, edição e estatísticas de vendas por cliente no painel administrativo do sistema. Ele segue o padrão **AI-First** de separação de responsabilidades.

---

## 📂 Estrutura de Arquivos

- `components/CustomersTable.tsx`: Tabela de apresentação da base de clientes com controles de paginação e botões de ação (editar e deletar). Exibe estatísticas consolidadas de compras.
- `components/CustomerEditorModal.tsx`: Modal contendo o formulário de cadastro/edição de clientes com auto-formatação do telefone onBlur.
- `hooks/useCustomers.ts`: Centraliza consultas, controle de estados de busca debounced, mutations de persistência e acoplamento com estatísticas (`buildCustomerStats`).
- `types.ts`: Tipagens e contratos locais.

---

## ⚙️ Regras de Negócio Importantes

### 1. Formato de Dados

- **Telefone**: É formatado automaticamente ao perder o foco (blur) no formulário, mantendo apenas dígitos limpos na base de dados e máscara legível na UI.
- **Estatísticas de Compra**: Mapeia todas as vendas resolvidas na base para calcular o total gasto e quantidade de compras de cada cliente.

### 2. Ações

- A remoção física/lógica do cliente deve ser confirmada pelo usuário.
