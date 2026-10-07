# Etiquetas de Gôndola

Geração e impressão de etiquetas de preço para fixar na gôndola, em folha A4
com duas colunas (20 etiquetas por página, 95mm × 24mm, coladas umas nas outras
e centralizadas na folha), com histórico de lotes e reimpressão.

> Não confundir com a feature `tags` (rota `/etiquetas`), que classifica
> produtos para análise. Aqui a etiqueta é o papel impresso com preço e código
> de barras.

## Fluxo

1. **Gerar Etiquetas**: busca produtos (`GET /Pdv/products/search`), digitando
   ou **lendo o código pela câmera**, monta a lista com nome, tipo, preço e
   quantidade por item e pré-visualiza as etiquetas. **A lista se salva
   sozinha no servidor** (o rascunho, abaixo).
2. **Salvar e Imprimir**: grava o lote (`POST /ProductLabelBatches`) e abre a
   caixa de impressão com a folha A4. O backend congela nome, código de barras
   e preço de cada item — a reimpressão reproduz o papel original mesmo que o
   cadastro mude depois — e **apaga o rascunho**. **A tela não se esvazia
   depois de imprimir**: o lote fica montado até alguém clicar em Limpar.
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
  a mesma regra (só dígitos = código de barras) e já devolve a URL da primeira
  imagem — que é a miniatura da lista.
- **Miniatura na listagem**: o catálogo tem muito nome parecido, e conferir
  pela foto é mais rápido do que ler o código de barras inteiro. A etiqueta
  errada só aparece depois de impressa e colada na gôndola.
- **Lápis abre o produto no cadastro, em NOVA aba** (`/produtos?busca=&editar=`,
  montado em `features/products/product-edit-link.ts`), para a pessoa não sair
  da lista no meio da montagem.
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

## Preço promocional na etiqueta (05/10/2026)

Pedido do dono: onde o sistema mostra o preço, mostrar o promocional. A regra de
anúncio é a do `@workspace/core` (`shelfPrice`), a mesma da listagem de produtos
e da busca do PDV; a lista de promoções é a do admin (`useShelfPrice`). A
etiqueta-específica mora em `promotion.ts`.

- **O tipo é a chave.** Produto em promoção entra como **Promoção** (amarela) e
  com o preço promocional. Trocar para **Normal** volta ao preço de tabela, sem
  "De" nem selo — é o caminho para a etiqueta que fica na gôndola depois do
  sábado. A Queima de Estoque também leva a promoção. Na Normal, a linha avisa que
  o produto está em promoção.
- **Relâmpago e Dia a Dia**: "DE R$ 12,90" riscado acima do preço e o selo do tipo
  embaixo. **Combo**: preço de tabela e o resumo no selo ("3 POR R$ 20,00").
- **A promoção é derivada, nunca guardada no rascunho.** O preço promocional conta
  como "não editado" (`expectedLabelPrice`): gravado como oferta digitada, a
  etiqueta continuaria com o preço da relâmpago depois do sábado. A oferta digitada
  à mão continua a dela ao trocar o tipo e quando a lista de promoções muda.
- **O lote impresso congela o "De" e o selo** (`referencePrice`, `promotionSeal`),
  e a reimpressão do histórico os repete. O "De" só sai acima de um preço MENOR
  que ele — o backend recusa o contrário.
- **No papel o preço desce de 32pt para 25pt** só nessas etiquetas, para o "De" e
  o selo caberem nos ~13,8mm abaixo do nome (`print.ts`, e a prévia em
  `LabelPreviewCard` com as mesmas medidas).

## Rascunho: a lista que se salva sozinha (30/09/2026)

Pedido do dono: montar a lista **olhando a prateleira**, no celular, e
continuar depois até imprimir. Uma lista só por usuário, não N listas.

- **Mora no servidor**, e não no navegador, porque a lista é montada no celular
  e impressa no computador — os dois precisam estar com o **mesmo login**. É a
  mesma tabela do histórico, com situação Rascunho; o histórico não a enxerga.
  Contrato em `Uaus.Backend.Api/docs/etiquetas-de-gondola.md`.
- **Salva sozinha** (`hooks/useLabelDraft.ts`): 800ms depois da última
  alteração, em fila (uma gravação por vez, para a lista velha nunca chegar
  depois da nova), na hora ao limpar, ao esconder a página e ao sair da tela. O
  cabeçalho da lista mostra "Lista salva às 14:32" — é o que deixa a pessoa
  bloquear o celular no meio da prateleira sem medo.
- **Só nome e preço EDITADOS ficam guardados**; o resto segue o cadastro e vem
  atualizado a cada abertura (`draft.ts`). Decisão do dono: a lista fica dias
  aberta, e a etiqueta não pode sair com o preço do dia em que o produto entrou
  nela. Preço igual ao do cadastro conta como não editado.
- **Lista travada até o rascunho ser lido.** Alterar antes e gravar
  sobrescreveria o rascunho do servidor com a lista vazia da tela.
- **Relê ao voltar para a tela** (foco da janela, página visível de novo): é o
  que faz o computador aberto desde ontem mostrar o que o celular acabou de
  adicionar. Nunca troca uma alteração local ainda não salva, nem aplica
  resposta que saiu antes de uma alteração (contador de alterações).
- **Imprimir encerra o rascunho**, mas a lista fica na tela para reimprimir; a
  releitura que volta vazia depois disso não esvazia a tela.
- **Concorrência**: vale a última gravação. Celular e computador mexendo na
  lista AO MESMO TEMPO podem se sobrescrever; a releitura ao voltar para a tela
  cobre o uso normal, um aparelho de cada vez.

## Leitura pela câmera (30/09/2026)

- O botão ao lado da busca abre `@/components/barcode-scanner-dialog` (o mesmo
  da listagem de Produtos). **Cada produto encontrado vibra o aparelho e fecha
  a câmera** — para o próximo, toca-se no botão de novo (pedido do dono depois
  do primeiro uso na loja; a primeira versão deixava a câmera aberta). O aviso
  da tela diz o nome do produto — a conferência de que leu a etiqueta certa — e
  as cópias. "Não encontrado" deixa a câmera aberta, com o aviso, para tentar
  de novo. O iPhone não vibra: o Safari não implementa a vibração.
- **Só entra sozinho o produto com o código EXATO** (`barcode-lookup.ts`). Mais
  de um produto com o mesmo código vai para a busca, e a escolha é da pessoa.
- Ler de novo o mesmo produto soma uma cópia, mas só depois de o código sair de
  vista por 2,5 s: a câmera vê o mesmo código várias vezes por segundo. O
  filtro **sobrevive ao fechamento**: ao reabrir ao lado da etiqueta que acabou
  de ser lida, ela não entra de novo como segunda cópia enquanto estiver na
  mira (achado da revisão depois que a câmera passou a fechar a cada produto). O motor
  (leitor nativo ou ZXing, recorte da mira, foco e zoom) está em
  `@/lib/barcode-scanner.ts`.
- **Serve para a etiqueta antiga colada na prateleira**: desde a padronização
  de 21/09/2026 o código do cadastro pode não ser o da embalagem de fábrica,
  mas é o da etiqueta de gôndola.

## Celular

A tela é montada no celular desde 30/09/2026: a lista de itens vira cartões
abaixo de `md` (nome em cima, tipo numa linha, preço, cópias e lixeira na de
baixo) e a grade de duas colunas só entra no `lg`. Mexeu no layout? Confira em
375px — a primeira versão deixava o select do tipo com largura zero.

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
- **Coladas, como células do Excel, e centralizadas na folha** (07/10/2026,
  pedido do dono para facilitar o recorte). Até aqui havia um vão de 3mm × 4mm
  entre as etiquetas: cada uma pedia quatro cortes e sobrava uma tira de papel
  entre vizinhas. Agora não há vão, e vizinhas dividem **uma** linha só — cada
  etiqueta desenha a borda da direita e a de baixo, e a grade, a de cima e a da
  esquerda (borda inteira nas duas sairia como linha dupla). Um corte reto
  separa as duas.
  - **A paginação é do `print.ts`, não do navegador**: folhas de 20
    (`LABELS_PER_PAGE`), cada uma numa `.page` com o bloco centralizado na
    horizontal e na vertical — a última também, mesmo com poucas etiquetas.
    Deixando a quebra para o navegador, a borda de cima da folha seguinte
    ficaria na anterior, e sem o vão cabem 11 linhas: a folha sairia com 22,
    encostada no topo.
  - A `.page` tem 280mm: a área útil (297mm − 2 × 8mm de margem) menos 1mm de
    folga, porque no limite exato o arredondamento empurra folha em branco
    entre as outras.
  - Folha com **uma** etiqueta só usa uma coluna: em duas, a borda de cima da
    grade passaria sobre a célula vazia.
  - Conferido em 07/10/2026 imprimindo em PDF pelo Edge (23 etiquetas: folha
    de 20 e folha de 3, as duas centralizadas, sem traço na célula vazia).
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
