# Módulo de Fornecedores (`features/suppliers`)

Este módulo gerencia a listagem, filtros (busca e status), paginação, cadastro, edição e remoção de fornecedores no painel administrativo do sistema. Ele segue o padrão **AI-First** de separação de responsabilidades.

---

## 📂 Estrutura de Arquivos

- `components/SuppliersTable.tsx`: Tabela de apresentação com link de redirecionamento para o WhatsApp do vendedor, avatar com coloração randômica/determinística baseada na base de dados, controles de paginação e paginação flexível (itens por página).
- `components/SupplierEditorModal.tsx`: Modal contendo o formulário de cadastro/edição de fornecedores, gerando cores aleatórias para o avatar, opções de UF e o enum de status.
- `hooks/useSuppliers.ts`: Busca com debounce, filtro de status, paginação, formulário e a regra de status padrão. Leitura e escrita vêm dos hooks do api-client.
- `components/SupplierTypeField.tsx`: O seletor "Tipo de fornecedor", com a frase que diz o efeito de cada tipo.
- `components/SupplierFlagsFields.tsx`: A chave "Fornecedor de compra recorrente".
- `constants.ts`: Paleta do avatar, lista de UFs, `whatsappUrl`, `normalizeStatusName`, o formulário em branco (`emptySupplierForm`) e a frase de cada tipo (`SUPPLIER_TYPE_HINTS`). Saíram do hook para o arquivo caber em 300 linhas e para um componente não precisar importar o hook só por causa da lista de UFs.
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

### 4.1. Status chega pelo nome (15/10/2026)

- A API manda o status pelo **nome** do enum (`"Active"`, `"Inactive"`), e as opções do select são **códigos** (`"1"`, `"2"`). Quem lê passa por `enumCode(status, SUPPLIER_STATUS)`; quem envia manda o código (`SupplierStatusCode`).
- Sem isso, a modal de um fornecedor inativo abria com **Ativo** — e salvar de novo o reativava sem ninguém ter escolhido. Foi o defeito de 15/10/2026, o mesmo que a tela de usuários já tinha tido.
- Na listagem, o `SupplierStatusBadge` pinta **Ativo de verde e Inativo de vermelho** (vocabulário de cores do `Uaus.Docs`). Antes o selo era verde para qualquer status.

### 5. Confirmação de exclusão

- A pergunta é do `ConfirmDialog` do `packages/ui`, renderizado pela `SuppliersTable`. O `window.confirm` que existia no hook travava a thread do navegador, ignorava o tema e obrigava o teste de exclusão a dublar `window.confirm` para chegar até a chamada.

### 6. Tipo de fornecedor (14/10/2026)

- Seis tipos, na ordem do seletor: **Atacado, Distribuidor, Fábrica, Marketplace, Varejo, Outros** (`SUPPLIER_TYPE_OPTIONS`, no api-client). Substituiu a chave "É um marketplace": o `isMarketplace` continua na resposta, **derivado** de `type === "Marketplace"` no servidor, e quem o lê (compras, desempenho de fornecedores) não mudou. No cadastro ele não vai mais — vai o `type`.
- **Obrigatório no cadastro novo**, que nasce **sem tipo pré-escolhido**: um padrão seria aceito sem ler, e o tipo muda regra de outras telas. Sem tipo, o hook avisa em português antes de ir à rede (a API responderia 400). Na **edição** é opcional: fornecedor sem tipo (backend anterior) salva sem mandar o campo, e o servidor mantém o gravado.
- O seletor mora na caixa dos campos obrigatórios, e não em "Informações opcionais". A frase embaixo muda com o tipo:
  - **Marketplace**: as compras exigem o link do anúncio para sair de Pendente.
  - **Atacado e Varejo**: a entrada de compra com poucas unidades de um produto (limite em Configurações › Estoque, 5 de fábrica) desliga o controle de estoque dele com o motivo "Planejar viagem" — repor exige ir até lá. Ele aparece na Lista de Compras quando tiver boa saída. É a compra de variedade em pouca quantidade (Master, Nossa Casa).
  - **Fábrica**: compra direta (pedido por WhatsApp, entrega por transportadora), fora da regra da compra pequena.
  - **Distribuidor e Outros**: sem efeito em outras telas.
- A listagem mostra o tipo num selo discreto embaixo do nome — a tabela já tem oito colunas.
- A **cidade** do cadastro passou a ter uso: é por ela que a Lista de Compras filtra a viagem (grafias com e sem acento viram uma opção só).
