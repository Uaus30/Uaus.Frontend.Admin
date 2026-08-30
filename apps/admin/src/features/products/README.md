# Módulo de Produtos (`features/products`)

Este módulo gerencia a visualização, filtragem, criação, edição e controle de histórico de produtos e suas variações. Ele é projetado seguindo princípios **AI-First** para garantir desacoplamento estrito entre UI (Aparência) e Business Logic (Regras e Chamadas de API).

---

## 📂 Estrutura de Arquivos

- `components/ProductTable.tsx`: Renderiza a listagem de produtos com paginação e suporte a edição rápida inline de preço e estoque.
- `components/ProductTableFilters.tsx`: Filtros da tabela (busca por texto, select de Departamento, select de Categoria e select de Status com ordenação alfabética).
- `components/detail/ProductDetailScreen.tsx`: Tela de detalhe do produto, em três abas — orquestra o formulário, as confirmações e o salvar. Substituiu a modal de edição.
- `components/detail/ProductGeneralTab.tsx`: Aba **Dados** (obrigatórios + código de barras + imagens + variações).
- `components/detail/ProductStockTab.tsx`: Aba **Estoque** (histórico de entradas do produto e lançamento simplificado).
- `components/detail/ProductEditorDialogs.tsx`: Confirmações de fora do formulário (configurar grades, excluir variação, regerar matriz).
- `components/detail/ProductWebImageSearch.tsx`: Liga a busca de imagem na web à galeria do produto em edição.
- `components/editor/`: Os grupos de campos que as abas montam — `ProductBasicInfo` (obrigatórios), `ProductPricing` (preço e status do produto simples), `ProductOptionalFields` (aba **Opcionais**), `ProductImageGallery` e `ProductVariationsManager`.
- `components/ProductHistoryModal.tsx`: Modal com a linha do tempo do histórico de auditoria (criação, edições e remoção).
- `lib/barcode.ts`: Validação de EAN, dígito verificador, código de prévia e impressão da etiqueta de 80mm.
- `hooks/editor/useBarcodeLookup.ts`: Reconhece, enquanto o código é bipado ou digitado, que ele já pertence a um produto — e carrega esse produto na tela. Ver seção 4.2.
- `lib/validateProductForm.ts`: Validação de preenchimento antes de gravar; devolve o mapa de erros e o primeiro campo a focar.
- `lib/pasteProductImages.ts`: Coleta e comprime as imagens coladas com Ctrl+V.
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

### 4. A tela de detalhe e suas três abas (30/08/2026)

O cadastro era uma **modal** sobre a lista. Virou tela, com abas, porque a modal
cobrava dois pedágios no fluxo mais comum da loja — cadastrar o produto e lançar
o que chegou dele:

- os campos opcionais (**Descrição**, **Etiquetas**, **Estoque mínimo/atual** e
  **Visibilidade**) ficavam atrás de um botão de olho que nada na tela
  anunciava. Quem não conhecia o ícone nunca marcava "exibir no site", e o
  produto não aparecia na loja sem ninguém entender por quê;
- o estoque ficava a uma navegação de distância (`/estoque/entradas?productId=`),
  que tirava a pessoa de dentro do cadastro.

As abas separam por **frequência de uso**, não por assunto:

| Aba           | O que tem                                                                                |
| ------------- | ---------------------------------------------------------------------------------------- |
| **Dados**     | Código de barras, nome, departamento, categoria, preço, status, imagens e variações.     |
| **Estoque**   | Histórico de entradas do produto e o lançamento simplificado. Ver abaixo.                |
| **Opcionais** | Descrição, etiquetas, estoque mínimo, estoque atual (só leitura) e visibilidade no site. |

Regras que valem a pena conhecer antes de mexer:

- **A troca é de RENDERIZAÇÃO, não de rota.** `pages/products.tsx` mostra a
  tela no lugar da listagem quando `editor.modalOpen` está ligado. A lista fica
  montada por trás com filtro, página e busca intactos, e voltar devolve a
  pessoa exatamente onde ela estava. Uma rota `/produtos/:id` remontaria a
  listagem do zero a cada volta e obrigaria a reescrever o link direto do PDV
  (seção 5) sem devolver nada em troca.
- **O `<form>` envolve as três abas.** O salvar do cabeçalho vale de qualquer
  aba, e trocar de aba com alteração pendente não perde nada. As modais são
  portais do Radix e ficam **fora** do form — o lançamento de estoque tem
  `<form>` próprio, e aninhar os dois seria HTML inválido.
- **Validação reprovada traz a aba Dados para a frente.** Todo campo obrigatório
  mora lá; focar um elemento de aba fechada não faz nada, e o salvar pareceria
  simplesmente não responder.
- O estado do editor ainda se chama `modalOpen`/`openModal` no
  `useProductEditor`. É nome histórico: significa "o editor está aberto".

#### A aba Estoque, em detalhe

- Lista as **notas** que trouxeram o produto (`GET /PurchaseEntries?productId=`),
  da mais recente para a mais antiga. A ordenação é do backend (data de entrada
  decrescente e, no empate, id decrescente) — a tela não reordena nada.
- A coluna de valor é o total da **nota inteira**, não o deste produto: a
  listagem de notas não quebra por item. Quantidade e custo deste produto saem
  nos detalhes, pelo olho da linha.
- **Produto novo não tem aba de estoque útil**: sem id gravado não há lote para
  lançar, e a aba explica isso em vez de abrir um formulário que falharia.
- **Grupo com variações ganha um seletor de variação**, porque estoque é do SKU,
  não do grupo. A modal antiga mandava sempre a variação ativa para
  `/estoque/entradas` — na prática, a primeira da lista.
- O lançamento em si mora na feature de entradas
  (`features/stock-entries/hooks/useProductStockEntries.ts`), junto das regras de
  data e validação que ele compartilha com a nota completa.

#### 4.2. Código de barras já cadastrado carrega o produto existente

Bipar, digitar ou colar no campo de código de barras um código que **já
pertence a outro produto**, durante um cadastro NOVO, carrega esse produto na
tela e emite um toast âmbar de aviso.

Antes disso o operador só descobria a duplicata ao salvar: preenchia nome,
departamento, categoria, preço e foto, clicava em Salvar e recebia o
`Já existe um produto cadastrado com este código de barras!` do backend
(`EnsureBarcodeIsAvailableAsync`) — com o cadastro certo em algum lugar da lista
e o trabalho todo para refazer. O caso é comum porque bipar é justamente o
primeiro gesto de quem vai cadastrar: é assim que se descobre se o item já
existe.

O que vale a pena saber antes de mexer:

- **Só em cadastro novo.** Na edição o operador já escolheu o produto; trocá-lo
  no meio da digitação jogaria fora o que ele preencheu. Duplicata na edição
  continua sendo recusada pelo backend ao salvar.
- **Só termo todo numérico, com 8 dígitos ou mais.** É a regra do backend:
  `GET /Products?search=` decide entre buscar por código e buscar por NOME
  olhando se o termo é numérico (`IsBarcodeSearch`). Mandar "COPO" carregaria um
  produto que ninguém pediu. O 8 é o EAN-8, o menor código de verdade.
- **A comparação é de IGUALDADE, não de semelhança.** O backend filtra por
  `Contains`, então buscar `78912345678` também traz o EAN-13 que o contém.
  Quem decide é a comparação exata no cliente.
- **Espera 400ms antes de consultar.** O leitor de código não "bipa": ele digita
  caractere por caractere em milissegundos, e sem a espera um EAN-13 dispararia
  treze consultas — doze delas por prefixos que não são código de ninguém.
- **A consulta é reação a um evento, não efeito.** Num efeito, além do
  `setState` síncrono que o lint recusa, seria preciso guardar "já carreguei
  este" para não reabrir o mesmo produto a cada render.
- **Erro de rede é silencioso de propósito.** A busca é conveniência; o backend
  continua recusando código repetido ao salvar, e quem está apenas digitando não
  deve receber aviso de servidor fora do ar.

### 5. Link direto do PDV (`/produtos?busca=<grupo>&editar=<id>`)

O botão de lápis do balcão do PDV abre esta tela em outra aba já na edição do produto. São dois parâmetros porque a tela faz duas coisas distintas:

- **`busca`** traz o produto para a página. A listagem é paginada e filtra por **grupo de produto** (`/Products/table?search=`, que casa com nome e descrição do GRUPO), então o termo tem que ser o nome do grupo — código de barras pertence ao produto filho e não casa com grupo nenhum. O endereço mudou no item 4.1; o critério de filtro foi mantido de propósito, porque mudá-lo mudaria a composição das páginas e o total do rodapé.
- **`editar`** escolhe a linha e é consumido pelo `hooks/useProductDeepLink.ts`.

Regras que valem a pena conhecer antes de mexer:

- Quando o id não aparece na lista mas o filtro trouxe **uma única linha**, é essa linha que abre. A tabela mostra um produto _representante_ por grupo, e o produto pedido pode ser uma variação que não é o representante — a tela de detalhe edita o grupo inteiro de qualquer forma.
- Filtro sem resultado emite toast em vez de não fazer nada: a aba do navegador abriria numa lista e nada explicaria por que o detalhe não veio.
- O `editar` sai da barra de endereços assim que é consumido. O link é instrução de uma vez só; sem isso, fechar o detalhe e recarregar reabriria tudo.
- Sem sessão, o guard de rota carimba o caminho em `/login?redirect=...` e o login devolve a pessoa aqui (ver `src/lib/destino-login.ts`).

### 6. Busca de Imagens na Internet

- **Pela Listagem**: Um ícone de lupa na imagem do produto abre o modal de pesquisa. Ao escolher uma imagem da internet, ela é baixada via proxy autenticado, otimizada localmente no frontend pelo motor de compressão e definida como a foto principal (índice 0) do produto, sem deletar as imagens existentes.
- **Pela Tela de Detalhe**: Habilita o botão "Buscar na Web" somente após o nome do produto ser preenchido. A imagem selecionada é baixada via proxy, otimizada e adicionada como uma imagem temporária na galeria do produto.
