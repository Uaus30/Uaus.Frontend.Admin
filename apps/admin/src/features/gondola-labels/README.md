# Etiquetas de Gôndola

Geração e impressão de etiquetas de preço para fixar na gôndola, em folha A4
com duas colunas (20 etiquetas por página, ~95mm × 24mm), com histórico de lotes e
reimpressão.

> Não confundir com a feature `tags` (rota `/etiquetas`), que classifica
> produtos para análise. Aqui a etiqueta é o papel impresso com preço e código
> de barras.

## Fluxo

1. **Gerar Etiquetas**: busca produtos (`GET /Pdv/products/search`), monta a
   lista com nome, tipo, preço e quantidade por item e pré-visualiza as
   etiquetas.
2. **Salvar e Imprimir**: grava o lote (`POST /ProductLabelBatches`) e abre a
   caixa de impressão com a folha A4. O backend congela nome, código de barras
   e preço de cada item — a reimpressão reproduz o papel original mesmo que o
   cadastro mude depois. **A tela não se esvazia depois de imprimir**: o lote
   fica montado até alguém clicar em Limpar.
3. **Histórico**: lista paginada dos lotes (`GET /ProductLabelBatches`), com
   detalhes, reimpressão fiel (valores congelados) e exclusão
   (`DELETE /ProductLabelBatches/{id}` — só remove o registro do histórico).

## Regras de negócio

- **A busca abre vazia e é a mesma do balcão.** A lista só aparece depois de
  uma busca: a partir de 3 caracteres com 400ms sem digitar, ou no Enter (que
  é a única saída para termo mais curto que isso). Antes ela abria com os 8
  primeiros produtos do catálogo — uma lista que não responde pergunta nenhuma
  e faz parecer que já há um filtro aplicado.
- **Por que `/Pdv/products/search` e não `/Products`**: interpreta o termo com
  a mesma regra (só dígitos = código de barras), já devolve a URL da primeira
  imagem — que é a miniatura da lista — e é liberado para `Seller`, enquanto a
  listagem do cadastro não é.
- **Miniatura na listagem**: o catálogo tem muito nome parecido, e conferir
  pela foto é mais rápido do que ler o código de barras inteiro. A etiqueta
  errada só aparece depois de impressa e colada na gôndola.
- **Lápis abre o produto no cadastro, em NOVA aba** (`/produtos?busca=&editar=`,
  montado em `features/products/product-edit-link.ts`). Nova aba porque o lote
  montado até ali só existe em memória e some se a tela sair.
- **Tipos de etiqueta** (enum `ProductLabelType` do backend): Normal = branca,
  Promoção = amarela, Queima de Estoque = vermelha — texto preto em todas,
  como nos cartazes de oferta de mercado.
- **Preço editável por item**: a etiqueta de promoção sai com o valor da
  oferta sem alterar o preço de venda do produto.
- **Nome editável por item** (21/09/2026): na gôndola cabe menos texto do que
  no cadastro, e o nome grande encolhe a fonte de todas as etiquetas.
  "COPO AMERICANO [ORIGINAL]" vira "COPO AMERICANO" **só no papel** — o cadastro
  não muda. O texto vai no `productName` do item, e o backend congela o nome
  recebido; campo vazio volta para o nome do cadastro (é o placeholder). O
  envio **omite** o nome quando ele não foi alterado: para variação, o nome
  composto ("PRODUTO - AZUL") é montado no backend e a busca não o devolve —
  mandar o texto da tela sempre apagaria essa composição.
- **Imprimir não limpa a tela** (21/09/2026): quem imprime costuma reimprimir na
  hora (papel torto, etiqueta faltando, folha presa), e antes disso a seleção
  tinha que ser remontada do zero. Cada clique em "Salvar e Imprimir" grava um
  lote novo no histórico — dois cliques são duas impressões, e lote é documento
  descartável. "Limpar" zera a lista **e** a identificação do lote.
- O mesmo produto pode entrar duas vezes com **tipos diferentes** (preço
  normal + oferta); repetir o mesmo tipo é bloqueado — para mais cópias existe
  a quantidade.
- Produto **sem código de barras** imprime a etiqueta sem as barras. Depois de 21/09/2026 isso só acontece com lote congelado antigo: o cadastro não deixa mais um produto ficar sem código.

## Impressão

- `print.ts` monta o documento A4 (medidas em mm, `@page size: A4`,
  `print-color-adjust: exact` para os fundos coloridos) e imprime via
  `printReceiptHtml` do `@workspace/receipt` (iframe fora da tela, cleanup por
  `afterprint`).
- **A borda da etiqueta é a linha de corte, e por isso o canto é vivo.** A folha
  é recortada com tesoura na loja; com o canto arredondado que existia até
  18/09/2026 não havia o que seguir na curva, e a mão cortava reto de qualquer
  jeito — sobrava rebarba de fora da linha. A prévia em tela
  (`LabelPreviewCard`) usa o mesmo contorno, senão ela deixa de valer como
  prévia.
- **Código reto, mais largo e com número maior** (21/09/2026). Três decisões que
  se puxam e por isso vivem juntas em `print.ts`:
  - **desenho reto** (`flat: true`): o EAN-13 padrão sai com barras de guarda
    mais compridas e o primeiro dígito solto na lateral; na gôndola vale o
    formato do CODE128 — todas as barras na mesma altura e o número inteiro
    centralizado embaixo. É também o que solta o corpo da fonte: no desenho
    guardado a jsbarcode corta a fonte em `width * 10` (`EAN.js`).
  - **largura**: `LABEL_BARCODE_MODULE_WIDTH` = 2.25 dá **42.1mm** de EAN-13
    impresso (o desenho antigo dava 39.3mm), e o `max-width: 50%` do
    `.label-barcode` é o teto: as barras nunca passam da **metade** da etiqueta,
    porque a outra metade é do preço — que é o que se lê de longe na gôndola.
    Código comprido (CODE128 de lote antigo) e preço de quatro dígitos apertam a
    largura até caber.
  - **altura fixa**: `LABEL_BARCODE_HEIGHT_MM` = 12.6 vale para **toda** etiqueta
    da folha, repartida pelo `LABEL_BARCODE_BAR_HEIGHT` (37) em 7.3mm de barra e
    4.7mm de número. Quem garante isso é a opção `stretch` do `buildBarcodeSvg`,
    que desenha com `preserveAspectRatio` em `none`: no padrão, apertar a largura
    encolhe o desenho inteiro, e a mesma folha saía com barras de 9.1mm, 7.3mm e
    6.3mm conforme o código e o preço ao lado. Agora o aperto é só horizontal —
    o leitor tolera, porque a proporção **entre** as barras não muda.
  - **folga embaixo do número** (`LABEL_BARCODE_BOTTOM_MARGIN` = 2): a jsbarcode
    encosta a **linha de base** do texto na borda do SVG, e o SVG recorta o que
    passa dela — a barriga do 8, do 9 e do 5 saía cortada. Os 2 entram na conta
    da altura, e é por isso que ela é 12.6 e não 12.2.
  - **número**: `LABEL_BARCODE_FONT_SIZE` = 24 faz o código ocupar ~80% da
    largura das barras, contra menos da metade antes.
  - Medir tudo junto não é zelo: o SVG escala pelo viewBox, então mexer no corpo
    do número ou na folga muda a **largura** impressa na mesma altura. Mudou um,
    confira os quatro na folha, não no olho.
- **Preço na meia-altura das barras**: a linha de baixo alinha por `center`.
  Antes o preço apoiava na base do código, na linha dos dígitos, e a etiqueta
  ficava pesada embaixo. O preço tem `flex: 0 0 auto` e as barras `0 1 auto` —
  num preço de cinco dígitos as barras cedem espaço, porque preço cortado é
  etiqueta refeita e barra menor o leitor ainda bipa.
- As barras saem do `buildBarcodeSvg` de `@/lib/barcode-svg`: **jsbarcode
  local** (sem CDN, funciona offline), com a simbologia escolhida pelo
  `resolveBarcodeFormat` do `@workspace/core`. O módulo era daqui, foi para
  `features/products` em 07/09/2026 e subiu para o `lib` do app em 21/09/2026 —
  feature importando de feature é o que o CLAUDE.md proíbe, e eram duas
  consumindo o mesmo desenho.
- **Desde 21/09/2026 todo produto do catálogo é EAN-13 válido** (item 4.5 do
  README de produtos), então a etiqueta nova sempre sai com barras. O CODE128
  continua no caminho porque o lote **congela** o código impresso: reimprimir um
  lote anterior à padronização ainda desenha o código velho, às vezes com
  verificador torto.

## Arquitetura

- `hooks/useLabelComposer.ts` — estado da aba de geração (itens, totais,
  gravar → imprimir).
- `hooks/useLabelProductSearch.ts` — a busca de produtos: gatilhos, termo em
  vigor e resultados.
- `hooks/useLabelBatchHistory.ts` — listagem paginada, detalhes, reimpressão e
  exclusão.
- `components/` — subcomponentes puros ligados pela página
  `@/pages/gondola-labels.tsx` (rota `/etiquetas-gondola`).
- Contratos da API em `@workspace/api-client-react` (módulo "Etiquetas de
  gôndola"); desenho do backend em
  `Uaus.Backend.Api/docs/etiquetas-de-gondola.md`.
