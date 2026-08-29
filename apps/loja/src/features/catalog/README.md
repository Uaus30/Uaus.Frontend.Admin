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

## Decisões de implementação

- **Scroll infinito com `useInfiniteQuery`** (páginas de 24) em vez de baixar
  tudo: visitante típico vê a primeira dúzia e vai embora. O sentinela usa
  `IntersectionObserver` com folga de 600px (`useInfiniteScrollSentinel`) e há
  um botão "Carregar mais" como caminho acessível equivalente.
- **Cards sem framer-motion.** Hover por transição CSS: numa grade que cresce,
  motion por card paga JavaScript por frame; CSS anima na composição.
- **404 do detalhe não distingue motivo** (oculto/excluído/inexistente) — o
  backend responde igual de propósito, para não vazar existência de cadastro
  oculto a anônimos.

## Artefatos

Hooks testados em `hooks/__tests__/` (a página nunca contém query — regra do
CLAUDE.md §4). Modelos de dados em `types.ts`, aliases dos DTOs públicos do
`@workspace/api-client-react`.
