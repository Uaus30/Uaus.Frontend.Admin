# Catálogo (vitrine pública)

A vitrine e o detalhe de produto do site — a única feature do monorepo que
consome a API **como visitante anônimo**.

## Regras de negócio

- **O card é o grupo de produto, não o produto.** O que aparece no site é o
  `ProductGroup` com "Exibir no site" ligado no admin (`ShowOnSite`) e ao menos
  um produto ativo. Produto simples é grupo de um; grupo com variações vira um
  card só com preço "A partir de" (o `priceMax` do DTO indica a faixa).
- **A curadoria é 100% do admin.** Flag de grupo (`ShowOnSite`), etiquetas
  públicas (`Tag.IsPublic` → selos coloridos do card, sucessores do "Super
  Oferta" fixo do site antigo) e fotos (S3, via cadastro de produto). O site
  não decide nada — só exibe.
- **Toda chamada é anônima** (`auth: false` nos hooks do api-client). Isso
  também desliga o redirect global de 401 para `/login`, rota que não existe
  aqui. Não adicione chamadas autenticadas nesta feature.
- **Busca no servidor, com o debounce padrão do repositório.** O site antigo
  baixava o catálogo inteiro e filtrava no cliente; com scroll infinito o
  cliente não tem o universo completo, então quem filtra é o endpoint.
- **Reserva = WhatsApp.** O botão do detalhe abre o wa.me da loja com mensagem
  contendo nome, preço, variação escolhida e o LINK do produto — o link é o que
  permite à lojista achar o cadastro certo (nome repete, URL não). Nada é
  enviado sem o cliente confirmar no próprio WhatsApp.

- **A cor do selo vem do cadastro; a cor do texto, não.** A lojista escolhe a
  cor da etiqueta no admin, e etiqueta clara (amarelo, bege) com texto branco
  fixo saía ilegível sobre a foto. `TagRibbons` calcula por luminância qual
  texto ler — ver `lib/contrast.ts`. O front não pode pedir para ela escolher
  outra cor: ele se adapta.

- **A contagem do filtro obedece à busca.** A árvore de departamentos vem de
  `/Storefront/departments` com o MESMO `search` da grade, e o backend a monta
  com o mesmo predicado de visibilidade da listagem. É o que impede a faceta de
  mentir: sem isso, "Cozinha (7)" apareceria ao lado de três cards, e o
  desencontro não geraria erro nenhum — só um número errado na cara do cliente.

- **Departamento e categoria filtram por E, não por OU.** Vindo os dois, o
  backend aplica os dois; categoria de outro departamento devolve vitrine
  vazia, de propósito. A tela nunca monta essa combinação — trocar de
  departamento limpa a categoria —, então o vazio só aparece para link
  adulterado, e escondê-lo seria esconder o link errado.

- **Filtro que leva a lugar nenhum não é oferecido.** Departamento sem grupo
  visível não entra na árvore; categoria idem.

## Decisões de implementação

- **Scroll infinito com `useInfiniteQuery`** (páginas de 24) em vez de baixar
  tudo: visitante típico vê a primeira dúzia e vai embora. O sentinela usa
  `IntersectionObserver` com folga de 600px (`useInfiniteScrollSentinel`) e há
  um botão "Carregar mais" como caminho acessível equivalente.
- **`useFeaturedProducts` é uma página só**, e mora aqui — não na feature
  `home`, que é quem a renderiza. Dado de produto é desta feature; a home
  compõe. O hook usa `useGetStorefrontProducts` (query simples) em vez do
  infinito: a faixa da home pede oito produtos e nada mais.
- **Cards sem framer-motion.** Hover por transição CSS: numa grade que cresce,
  motion por card paga JavaScript por frame; CSS anima na composição. O card
  usa `object-contain` sobre fundo branco, e não `object-cover`: foto de
  produto vertical era decapitada pelo recorte quadrado.
- **404 do detalhe não distingue motivo** (oculto/excluído/inexistente) — o
  backend responde igual de propósito, para não vazar existência de cadastro
  oculto a anônimos.
- **A URL é o estado do filtro** (`?departamento=2&categoria=10&busca=panela`,
  em `useCatalogFilters`). Com `useState` o filtro morreria em três gestos que
  o visitante dá o tempo todo: compartilhar o link, recarregar e voltar do
  detalhe do produto — o último é o pior, porque quem abre um produto e volta
  espera a lista como deixou. Departamento e categoria navegam com **push** (o
  Voltar tem que desfazer o filtro); a busca grava com **replace**, senão cada
  letra digitada vira uma entrada de histórico.
- **Quem navega entre filtros são links, não botões** (`catalogPath` em
  `routes.ts` monta o `href`). Link é rastreável pelo buscador, abre em aba
  nova e empilha histórico sozinho. É também o que faz a trilha do detalhe e os
  chips falarem o mesmo dialeto de query string que a vitrine lê.
- **Sem slug nas URLs de filtro.** Não existe coluna `Slug` em lugar nenhum, e
  derivar do nome resolve a ida e não a volta — além de quebrar todo link salvo
  quando a lojista corrigir um acento no nome. Slug é trabalho próprio (coluna,
  unicidade, redirect do slug antigo) e vale junto com slug de produto.
- **A troca de filtro sobe a página na mão.** O `ScrollToTop` global não cobre
  esse caso: o `useLocation` do wouter lê só o pathname, e filtro mexe na query
  string — sem o `scrollTo` da página de produtos, quem filtra no meio da lista
  continua no meio, agora olhando outra categoria.
- **A árvore é lida duas vezes, com papéis diferentes.** Com a busca, é a lista
  que a tela mostra (contagem coerente com a grade). Sem a busca, é o retrato do
  catálogo: quais filtros existem e como se chamam. O segundo existe porque uma
  busca estreita pode tirar da lista justamente a categoria escolhida — sem ele,
  o chip ficaria sem rótulo e a tela acusaria "filtro inexistente" para um
  cadastro que existe. Sem busca as duas leituras dividem a chave de cache e
  viram uma requisição só.

## Artefatos

Hooks testados em `hooks/__tests__/` (a página nunca contém query — regra do
CLAUDE.md §4). Modelos de dados em `types.ts`, aliases dos DTOs públicos do
`@workspace/api-client-react`.

A vitrine consome **um** hook: `useCatalog` compõe `useCatalogFilters` (URL),
`useDepartmentTree` (árvore + nomes) e a grade infinita, e a página só desenha.
A trilha do detalhe (`ProductBreadcrumb`) é visual; o `BreadcrumbList` de dados
estruturados sai da própria página, via `lib/structured-data.ts`, no mesmo
lugar de onde o `usePageTitle` escreve.
