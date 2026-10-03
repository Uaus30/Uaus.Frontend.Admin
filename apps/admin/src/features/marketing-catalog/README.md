# Marketing › Catálogo de divulgação (`features/marketing-catalog`)

Gera o material de divulgação da loja sem montagem manual: o sistema sorteia os
produtos e desenha a peça pronta para compartilhar. Rota `/marketing/catalogo`,
**aberta a qualquer papel** (decisão do dono, 03/10/2026: quem está no balcão
também divulga, e a tela não mostra custo, margem nem saldo).

O contrato completo — decisões, números medidos, regras do sorteio e etapas —
está em `PLANO-CATALOGO.md`, na raiz do repositório.

**Esta é a etapa 1**: um formato (banner 9:16, para o status do WhatsApp e o
story do Instagram) e um tema (novidades e promoções). A rota existe e responde,
mas fica **fora do menu** até a etapa 2.

## Regras de negócio

### 1. A peça só leva o que o cliente pode ver

`CatalogProduct` não tem custo nem saldo, e não é esquecimento: a imagem circula
em grupo de WhatsApp, fora do controle da loja. O preço impresso é o que o
cliente paga hoje — o promocional quando há oferta vigente.

### 2. Toda peça sai com o aviso, e a data vai dentro dele

> Preços de referência em dd/mm/aaaa, sujeitos a alteração sem aviso e à
> disponibilidade de estoque. Imagens meramente ilustrativas.

Texto pedido pelo dono. A data é a do **calendário da loja** (Brasília), e não a
do aparelho: quem gera é o celular de quem estiver no balcão, e um fuso errado
não pode datar a peça de ontem. Ela existe porque a imagem é vista dias depois —
sem data, o preço de hoje vira promessa sem prazo.

### 3. O preço é buscado a cada geração

O hook pede a vitrine com `staleTime: 0`. O preço vai **impresso**; servir o do
cache de dez minutos atrás colocaria no status um preço que o balcão já não
pratica.

### 4. Um selo por card, e a oferta vence

Oferta, Novidade ou Últimas unidades — nunca dois. Dois selos disputando o canto
da foto tapam o produto sem informar mais. A oferta vence porque é ela que muda
o preço impresso.

### 5. O "de" riscado e o "a partir de" convivem

Oferta de 20% num grupo com variações de R$ 10 e R$ 16 custa de R$ 8,00 a
R$ 12,80. Imprimir só "de R$ 10,00" sobre o R$ 8,00 prometeria o menor preço
para todas as variações; a peça mostra as duas legendas, como o `PriceTag` do
site.

O "de" só aparece quando a API manda.

`referencePrice` já vem ausente quando o corte é de até 5% (regra do servidor, a
mesma do site). A peça não refaz essa conta: refazer criaria um catálogo
prometendo "de R$ 5,00 por R$ 4,90" que o site não mostra.

### 6. As ofertas ocupam no máximo um terço do banner

Mesmo raciocínio da seção Novidades do site: com muitas promoções no ar, o banner
viraria só oferta e deixaria de mostrar o que chegou. Faltando produto sem oferta
para completar, as ofertas que sobraram entram.

O terço é dos **9 do banner**, e não dos candidatos com folga (regra 7): as
reservas vêm depois, e são produtos sem oferta. Somando a folga ao tamanho do
banner, o teto virava 4 em 9.

### 7. Foto fora do ar cede a vaga

O sorteio entrega candidatos **a mais** (9 + 4). O montador baixa todas as fotos
e usa as nove primeiras que vieram: o banner não sai com buraco, e uma foto
quebrada não derruba a geração. Só há erro quando nenhuma carrega.

### 8. "Sortear de novo": vale a última

Cada geração tem um número (`runRef`). Dois toques seguidos disparam duas
gerações, e a que responder atrasada é descartada — sem isso, o banner da
primeira cobriria o da segunda. Durante a geração o banner anterior continua na
tela, esmaecido.

Sair da tela no meio de uma geração também a invalida. Sem isso ela terminaria
depois, criaria a URL da prévia para uma tela que não existe mais, e o arquivo
ficaria preso na memória — não há efeito de limpeza para um estado que nunca foi
exibido.

### 9. Compartilhar baixa quando a folha do aparelho não existe

No celular, "Compartilhar" abre a folha do sistema com o arquivo (WhatsApp,
Instagram). No computador ela não aceita arquivo, e o botão nem aparece — fica o
"Baixar". Fechar a folha sem escolher é desistência; qualquer outra falha cai no
download, porque quem tocou quer o arquivo.

## O molde é desenhado pelo satori, não pelo navegador

`template/` é JSX comum, mas quem o transforma em imagem é o **satori** (layout e
SVG) seguido do **resvg** (pixels). É o que faz o banner sair igual no Android,
no iPhone e no computador. O preço disso é um subconjunto do CSS:

- só **flexbox** (sem grid), e todo `div` com mais de um filho precisa de
  `display: flex`;
- estilo **inline** — classe do Tailwind não chega ao arquivo;
- `<img>` com largura e altura declaradas;
- fonte embutida: Montserrat (a do logotipo) em WOFF. WOFF2 o satori não lê.

O navegador renderiza o mesmo JSX sem reclamar, então o erro só aparece ao
gerar. Por isso `template/__tests__/StoryBanner.render.test.tsx` passa o molde
pelo satori **de verdade**, com todas as variações de card e de grade.

**Satori fixado em 0.32.0.** A 0.33 passou a carregar o HarfBuzz por caminho
relativo de WebAssembly, que não resolve dentro do bundle.

### O peso fica fora do resto do admin

Satori e resvg somam 515 KB de JavaScript (~170 KB comprimidos) e 2,4 MB de
WebAssembly (~950 KB comprimidos). Três cuidados, os três conferidos no build de
03/10/2026:

- entram por `import()` dinâmico, e o `manualChunks` do `vite.config.ts` os põe
  no chunk `vendor-catalogo` — sem isso cairiam no `vendor` comum, que todo
  mundo baixa no primeiro paint (o `vendor` ficou com os mesmos 414 KB);
- a lista de pacotes do `vite.config.ts` é o fecho de dependências do satori
  0.32. **Atualizou o satori? Refaça a lista e confira o tamanho do `vendor`**;
- a tela chama `preloadStoryBanner()` ao abrir: o download acontece enquanto a
  pessoa lê, e não com o botão "Gerar" já apertado.

### Conferir uma mudança de desenho sem abrir o navegador

```bash
cd apps/admin
CATALOG_PREVIEW_DIR=../../../TEMP/catalogo npx vitest run StoryBanner.render
```

Grava `banner-story.png` com produtos reais da vitrine pública.
`CATALOG_PREVIEW_SEED` fixa o sorteio; `CATALOG_PREVIEW_API` troca a API.

### As fotos passam por um canvas antes do molde

O bucket tem JPEG, PNG e WebP, e a extensão mente (há `.jpg` que é WebP por
dentro — foi o que derrubou a primeira prévia). O canvas devolve sempre um JPEG
comum, já reduzido a 640 px e com fundo branco no lugar da transparência.

A foto é buscada com `cache: "no-store"`. O admin já mostrou a mesma URL num
`<img>` comum, e o navegador guardou a resposta **sem** o cabeçalho de CORS; lida
do cache, ela seria recusada mesmo com o bucket liberado.

### A arte do cabeçalho

`assets/story-header.jpg` e `story-footer.jpg` saem de
`C:\Projects\Uaus\Artes\catalogo\gerador\gerar_fundos.py --publicar`, que recorta
o logotipo da arte da marca e estende a textura. As medidas de lá são as de
`template/geometry.ts`: mudou a posição do logotipo num, mude no outro, senão o
título passa por cima dele.

## O que é provisório na etapa 1

`lib/pickProducts.ts` sorteia da **vitrine pública** (`/Storefront/products`): as
ofertas e os 60 cadastros mais recentes. A vitrine não expõe saldo nem dias de
loja, então o banner pode trazer produto esgotado e "novidade" é só a ordem do
cadastro. A etapa 2 troca esse arquivo pelo sorteio do servidor.

`lib/storeContact.ts` repete o contato do site (`apps/loja/src/lib/site.ts`). O
cadastro de Configurações não serve: é o do cupom — caixa alta e o celular de um
sócio. É a segunda cópia; na terceira os valores sobem para o `packages/core`.

## Estrutura

- `template/geometry.ts`: medidas do banner e a grade conforme a quantidade.
- `template/text.ts`: preço partido, data da loja, aviso, corpo do título.
- `template/StoryBanner.tsx` e `ProductCard.tsx`: o molde.
- `lib/renderer.ts`: satori + resvg, carregados sob demanda.
- `lib/photos.ts`: fotos e artes em data URL; pixels em JPEG.
- `lib/fonts.ts`: os cinco pesos da Montserrat.
- `lib/buildStoryBanner.ts`: junta tudo e devolve o arquivo.
- `lib/share.ts`: folha de compartilhamento, download e nome do arquivo.
- `hooks/useCatalogGenerator.ts`: estado e ações da tela.
- `components/CatalogBannerPreview.tsx`: a moldura da prévia — que mostra o
  próprio arquivo, e não uma simulação.
