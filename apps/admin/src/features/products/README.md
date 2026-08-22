# Módulo de Produtos (`features/products`)

Este módulo gerencia a visualização, filtragem, criação, edição e controle de histórico de produtos e suas variações. Ele é projetado seguindo princípios **AI-First** para garantir desacoplamento estrito entre UI (Aparência) e Business Logic (Regras e Chamadas de API).

---

## 📂 Estrutura de Arquivos

- `components/ProductTable.tsx`: Renderiza a listagem de produtos com paginação e suporte a edição rápida inline de preço e estoque.
- `components/ProductTableFilters.tsx`: Filtros da tabela (busca por texto, select de Departamento, select de Categoria e select de Status com ordenação alfabética).
- `components/ProductEditorModal.tsx`: Formulário principal (Modal) para criação e edição de produtos simples ou com variações.
- `components/ProductHistoryModal.tsx`: Modal com a linha do tempo do histórico de auditoria (criação, edições e remoção).
- `components/CurrencyInput.tsx`: Componente de entrada controlada formatado para moeda brasileira (R$).
- `components/ProductImagesSection.tsx`: Gerencia o upload, ordenação (drag-and-drop) e exclusão de fotos do produto.
- `components/ProductImageSearchModal.tsx`: Modal para consulta, seleção, otimização e importação de imagens da internet.
- `components/ProductVariationsSection.tsx`: Tabela interativa para gerenciar variações do produto (SKUs), preços individuais e associação com grades.
- `hooks/useProductTable.ts`: Gerencia o carregamento de dados da listagem, controle de paginação, busca e filtros (departamento, categoria, status com padrão Ativo), e chamadas de mutations para edição rápida de preço/estoque.
- `hooks/mapProductTableRow.ts`: Traduz a linha que o servidor devolve para a linha que a tela usa.
- `hooks/useProductEditor.ts`: Centraliza o estado do formulário de criação/edição, geração da matriz cartesiana de variações, validações e persistência no banco.
- `types.ts`: Tipagens TypeScript estritas que modelam os dados de formulários, imagens locais e variações.

---

## ⚙️ Regras de Negócio Importantes

### 0. A listagem é UMA requisição — e precisa continuar sendo

A página da tabela vem pronta de `GET /Products/table` (hook `useGetProductTable`, no `packages/api-client`): grupo, categoria, departamento, produto representante, etiquetas e imagens numa resposta só. A ordenação padrão é por **ID decrescente** (mais recentes primeiro), e por padrão a tela inicializa filtrada por **Status: Ativo** (`PRODUCT_STATUS.Active = 2`). Todos os selects de filtro (Departamento, Categoria e Status) exibem as opções em ordem alfabética.

Antes do item 4.1 a tela montava a mesma linha em **cascata de quatro níveis**, cada um esperando o anterior terminar:

1. `/ProductGroups` paginado — a página de grupos;
2. `/Products?productGroupId=` — **uma requisição por grupo**;
3. `/ProductTags?productId=` e `/ProductImages?productId=` — **duas por produto**;
4. `/Images/{id}` — **uma por imagem distinta**.

Mais os três catálogos completos (departamentos, categorias, etiquetas), baixados inteiros só para escrever dois nomes por linha. Contando por leitura do código, com 20 grupos por página:

| Cenário                                  | Antes                       | Depois |
| ---------------------------------------- | --------------------------- | ------ |
| 20 grupos simples, 1 imagem cada         | 5 + 20 + 40 + 20 = **85**   | **2**  |
| 20 grupos com 3 variações, 1 imagem cada | 5 + 20 + 120 + 60 = **205** | **2**  |
| Idas e voltas em série antes da 1ª linha | **4**                       | **1**  |

(as duas de hoje são a página da tabela e o catálogo de status, que é compartilhado e fica 5 min em cache)

Como cada endpoint filtrava por **um id de cada vez**, não havia conserto possível só no navegador — daí o endereço agregado no backend. `useProductTable.test.tsx` conta as chamadas de `fetch` de verdade e falha se a cascata voltar: uma cascata reintroduzida não quebra nada visível, a tela só volta a levar segundos para abrir.

**Quem representa a linha.** A tabela lista GRUPOS e mostra o produto de **maior id** do grupo. Não é escolha estética: é o que o front já exibia (`/Products?productGroupId=` vem ordenado por id decrescente e ele pegava o primeiro). Trocar o critério mudaria a variação exibida — e o preço editado inline — em toda linha de grupo com variações.

**Nome do grupo × nome do produto.** A linha exibe `name` (do grupo) e guarda `productName` (do produto) à parte. A edição rápida de preço faz `PUT /Products` e tem que devolver `productName`; mandar o nome exibido renomeia o produto silenciosamente, com registro no histórico, e o nome errado vaza para o cupom e para o PDV.

**Invalidação.** A tabela é uma query só, sob `["products","table", params]`. Quem salva, exclui ou reordena invalida `RESOURCE_KEYS.products` — o prefixo do recurso alcança a tabela. Invalidar a chave errada não quebra nada: compila, roda, e a célula mostra o valor antigo depois de salvar.

**Virtualização: avaliada e descartada.** O seletor oferece 20 (padrão), 50 e 100 linhas por página. Só o último passa da faixa em que virtualizar compensa, e cada linha carrega menu de contexto, dropdown e hover card em portal — que virtualização quebra de formas difíceis de perceber. Sem a cascata, o custo de uma linha voltou a ser só render. Se o seletor um dia oferecer 500, refaça a conta.

### 1. Produto Simples vs. Produto com Variações

- **Produto Simples**: Possui preço, estoque e status definidos no próprio produto principal.
- **Produto com Variações**: O produto principal funciona apenas como um "Grupo de Produtos" (`ProductGroup`). O preço, estoque, código de barras e imagens são definidos individualmente em cada variação (SKU). É necessário ter pelo menos 2 variações cadastradas para salvar.

### 2. Geração da Matriz Cartesiana de Grades

- Ao selecionar grades (ex: Cor, Tamanho), o hook `generateVariationsMatrix` realiza o cruzamento cartesiano de todos os variantes destas grades.
- A matriz resultante pré-popula a tabela de variações com nomes e combinações correspondentes.
- Se o usuário tentar salvar variações com combinações de grades repetidas, o sistema bloqueia e emite um erro de validação.

### 3. Associação de Imagens e Etiquetas (Tags)

- As imagens do produto podem ser ordenadas via drag-and-drop. A primeira imagem é considerada a "principal".
- Ao salvar, o sistema sincroniza de forma incremental as tags e imagens de cada variação com o servidor através das funções `syncProductTags` e `syncProductImages`.

### 4. Visibilidade Simplificada (Botão de Olho)

- Por padrão, ao abrir a modal, os campos opcionais (**Descrição**, **Estoque mínimo/atual**, **Visibilidade** e **Etiquetas**) são ocultados para focar no fluxo principal do usuário.
- O clique no botão de olho (no topo esquerdo ao lado do título da modal) alterna a visibilidade desses campos.
- Os campos **Código de Barras** e **Imagens** permanecem sempre visíveis.

### 5. Link direto do PDV (`/produtos?busca=<grupo>&editar=<id>`)

O botão de lápis do balcão do PDV abre esta tela em outra aba já na edição do produto. São dois parâmetros porque a tela faz duas coisas distintas:

- **`busca`** traz o produto para a página. A listagem é paginada e filtra por **grupo de produto** (`/Products/table?search=`, que casa com nome e descrição do GRUPO), então o termo tem que ser o nome do grupo — código de barras pertence ao produto filho e não casa com grupo nenhum. O endereço mudou no item 4.1; o critério de filtro foi mantido de propósito, porque mudá-lo mudaria a composição das páginas e o total do rodapé.
- **`editar`** escolhe a linha e é consumido pelo `hooks/useProductDeepLink.ts`.

Regras que valem a pena conhecer antes de mexer:

- Quando o id não aparece na lista mas o filtro trouxe **uma única linha**, é essa linha que abre. A tabela mostra um produto _representante_ por grupo, e o produto pedido pode ser uma variação que não é o representante — a modal edita o grupo inteiro de qualquer forma.
- Filtro sem resultado emite toast em vez de não fazer nada: a aba abriria numa lista e nada explicaria a ausência da modal.
- O `editar` sai da barra de endereços assim que é consumido. O link é instrução de uma vez só; sem isso, fechar a modal e recarregar reabriria tudo.
- Sem sessão, o guard de rota carimba o caminho em `/login?redirect=...` e o login devolve a pessoa aqui (ver `src/lib/destino-login.ts`).

### 6. Busca de Imagens na Internet

- **Pela Listagem**: Um ícone de lupa na imagem do produto abre o modal de pesquisa. Ao escolher uma imagem da internet, ela é baixada via proxy autenticado, otimizada localmente no frontend pelo motor de compressão e definida como a foto principal (índice 0) do produto, sem deletar as imagens existentes.
- **Pela Modal de Edição**: Habilita o botão "Buscar na Web" somente após o nome do produto ser preenchido. A imagem selecionada é baixada via proxy, otimizada e adicionada como uma imagem temporária na galeria do produto.
