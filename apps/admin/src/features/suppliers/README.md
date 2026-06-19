# Módulo de Fornecedores (`features/suppliers`)

Este módulo gerencia a listagem, filtros (busca e status), paginação, cadastro, edição e remoção de fornecedores no painel administrativo do sistema. Ele segue o padrão **AI-First** de separação de responsabilidades.

---

## 📂 Estrutura de Arquivos

*   `components/SuppliersTable.tsx`: Tabela de apresentação com link de redirecionamento para o WhatsApp do vendedor, avatar com coloração randômica/determinística baseada na base de dados, controles de paginação e paginação flexível (itens por página).
*   `components/SupplierEditorModal.tsx`: Modal contendo o formulário de cadastro/edição de fornecedores, gerando cores aleatórias para o avatar, opções de UF e o enum de status.
*   `hooks/useSuppliers.ts`: Centraliza consultas, controle de estados de busca debounced, limite de itens por página, mutations de persistência e acoplamento com o enum `supplier-status`.
*   `types.ts`: Tipagens e contratos locais.

---

## ⚙️ Regras de Negócio Importantes

### 1. Avatar de Fornecedor
*   Cada fornecedor tem um avatar com as duas primeiras iniciais de seu nome.
*   A cor de fundo e da borda é gerada de forma pseudo-aleatória (`avatarColor`), mas persistida no banco para se manter consistente. Há um botão na modal para gerar uma nova cor aleatória caso o usuário queira mudar.

### 2. Contato do Vendedor e Link do WhatsApp
*   Se o fornecedor possuir número de telefone, a UI exibe um link que redireciona diretamente para `https://wa.me/55<telefone>` (adicionando o código do país DDI `55` se não estiver presente).

### 3. Valor Mínimo de Compra
*   É um campo obrigatório no cadastro, representado em Reais (R$). Não pode ser negativo.
