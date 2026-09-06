# Home (vitrine institucional)

Seções da página inicial, portadas do site original (`Front-Loja`) com as
regras abaixo.

## Regras de negócio e decisões

- **Fidelidade textual, com uma exceção autorizada.** Os textos do hero são
  copiados verbatim do site que estava no ar — eles carregam a voz da marca. A
  regra segue valendo: mudança de copy é decisão do dono, não refactor. A
  exceção é o cartão do meio da grade de destaques, cujo "Se encontrar um
  produto caro, reclame ;D" foi trocado em 29/08/2026 por decisão do dono (ver
  `PLANO-DESIGN-LOJA.md`, Fase 4): a piada tirava credibilidade justamente no
  bloco que promete o preço.
- **Novidades do catálogo.** A seção `FeaturedProducts` ("Novidades") é a única
  da home que consulta a API, e ela **não tem query própria**: consome
  `useFeaturedProducts` da feature `catalog`, que é a dona dos dados de
  produto. O card é o mesmo `ProductCard` da vitrine — preço, selo e link de
  detalhe iguais, por construção. Quantos produtos aparecem é configurável em
  Admin > Configurações (do mais novo para o mais antigo); até 05/09/2026 eram
  8 fixos. **No celular em pé o hook corta em 8** de qualquer jeito — ver
  `MOBILE_FEATURED_COUNT` no README do `catalog`. Os links dizem só "Ver todos
  os produtos": o tamanho do catálogo não vai para a tela — a regra e o motivo
  estão no README do `catalog`.
- **O link para a vitrine aparece duas vezes, de propósito.** Um no alto da
  seção, para quem já decidiu antes de olhar os cards, e um centralizado
  DEPOIS da grade (06/09/2026, pedido do dono), para quem rolou até o fim: lá
  o de cima já saiu da tela e abaixo dos cards só vinha o rodapé. O
  `AllProductsLink` é o mesmo componente nos dois, com a variação visual vindo
  por `className` — o de baixo é sólido porque ali ele é a única saída.
  Falha ou catálogo vazio fazem a seção **sumir**, não mostrar erro: destaque é
  conteúdo acessório, e uma caixa de "não foi possível carregar" no meio da
  home dá a impressão de site quebrado por algo que o visitante nem sabia que
  existia.
- **A faixa escura não é mais a inauguração.** O site original fazia contagem
  regressiva para 07/03/2026 e o componente devolvia `null` depois da data —
  desde março a seção renderizava um cartão de evento passado. `VisitBanner`
  mantém o visual (cartão laranja sobre faixa escura) com conteúdo perene:
  endereço, o horário de funcionamento e a promessa do preço máximo. O horário
  chegou do dono em 29/08/2026 e vive em `SITE_OPENING_HOURS` (`lib/site.ts`),
  não na API — o `StorefrontCompanyDto` não tem o campo. Ele vem em segundo no
  cartão, entre "onde" e "quanto custa": é a ordem em que a decisão de sair de
  casa acontece.
- **Carrossel pausa no hover e aceita swipe** — melhorias sobre o original,
  que só tinha autoplay de 5 s. A justificativa está no JSDoc de
  `hooks/useCarousel.ts`; o timer reinicia após interação manual para o
  autoplay não "roubar" o slide recém-escolhido. As setas ficam **sempre
  visíveis abaixo de `md`**: elas apareciam só no `group-hover`, e hover não
  existe em toque.
- **Nenhuma imagem remota.** A textura da faixa escura era uma foto hotlinkada
  do Pixabay; aqui todas as imagens (7 fotos da loja + logo) saem do bundle.
- **Movimento com freio.** Toda seção animada com `motion.*` lê
  `useReducedMotion()` e entra sem deslocamento quando o visitante pediu menos
  movimento no sistema. O CSS tem o bloco equivalente em `src/index.css`.

## Fora do escopo desta feature

Query de produto. `FeaturedProducts` é composição: o hook mora em `catalog`.
