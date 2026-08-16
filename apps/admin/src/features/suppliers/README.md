# Módulo de Fornecedores (`features/suppliers`)

Este módulo gerencia a listagem, filtros (busca e status), paginação, cadastro, edição e remoção de fornecedores no painel administrativo do sistema. Ele segue o padrão **AI-First** de separação de responsabilidades.

---

## 📂 Estrutura de Arquivos

- `components/SuppliersTable.tsx`: Tabela de apresentação com link de redirecionamento para o WhatsApp do vendedor, avatar com coloração randômica/determinística baseada na base de dados, controles de paginação e paginação flexível (itens por página).
- `components/SupplierEditorModal.tsx`: Modal contendo o formulário de cadastro/edição de fornecedores, gerando cores aleatórias para o avatar, opções de UF e o enum de status.
- `hooks/useSuppliers.ts`: Busca com debounce, filtro de status, paginação, formulário e a regra de status padrão. Leitura e escrita vêm dos hooks do api-client.
- `constants.ts`: Paleta do avatar, lista de UFs, `whatsappUrl` e `normalizeStatusName`. Saíram do hook para o arquivo caber em 300 linhas e para um componente não precisar importar o hook só por causa da lista de UFs.
- `types.ts`: `SupplierForm` e o reexport de `EnumOptionDto`.

---

## 🔌 De onde vêm os dados

`/Suppliers` e `/Suppliers/enums/supplier-status` moram em
`packages/api-client/src/hooks/suppliers.ts` e chegam aqui como
`useGetSuppliers`, `useGetSupplierStatusOptions`, `useCreateSupplier`,
`useUpdateSupplier` e `useDeleteSupplier`.

**Invalidação:** o prefixo `["suppliers"]` (de `getGetSuppliersQueryKey()`)
cobre a listagem paginada desta tela e o catálogo completo lido pelo lançamento
de estoque. A chave antiga era `["suppliers-page"]`, particular desta feature —
renomear um fornecedor aqui deixava o nome antigo no combo da outra tela.

---

## ⚙️ Regras de Negócio Importantes

### 1. Avatar de Fornecedor

- Cada fornecedor tem um avatar com as duas primeiras iniciais de seu nome.
- A cor de fundo e da borda é gerada de forma pseudo-aleatória (`avatarColor`), mas persistida no banco para se manter consistente. Há um botão na modal para gerar uma nova cor aleatória caso o usuário queira mudar.

### 2. Contato do Vendedor e Link do WhatsApp

- Se o fornecedor possuir número de telefone, a UI exibe um link que redireciona diretamente para `https://wa.me/55<telefone>` (adicionando o código do país DDI `55` se não estiver presente).

### 3. Valor Mínimo de Compra

- É um campo obrigatório no cadastro, representado em Reais (R$). Não pode ser negativo.

### 4. Filtro de Status

- O status escolhido vai para o **servidor**, dentro dos parâmetros da consulta. Filtrar no cliente, sobre a página já recortada, mostrava só os inativos que por acaso caíram nos 20 itens da página corrente — e o contador de páginas continuava contando todos, produzindo páginas vazias no fim da lista.
- Trocar o filtro volta para a página 1 na própria função que troca, e não num efeito: a página 3 do conjunto anterior pode nem existir no novo.

### 5. Confirmação de exclusão

- A pergunta é do `ConfirmDialog` do `packages/ui`, renderizado pela `SuppliersTable`. O `window.confirm` que existia no hook travava a thread do navegador, ignorava o tema e obrigava o teste de exclusão a dublar `window.confirm` para chegar até a chamada.
