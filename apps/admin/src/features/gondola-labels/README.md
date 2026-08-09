# Etiquetas de Gôndola

Geração e impressão de etiquetas de preço para fixar na gôndola, em folha A4
com duas colunas (16 etiquetas por página), com histórico de lotes e
reimpressão.

> Não confundir com a feature `tags` (rota `/etiquetas`), que classifica
> produtos para análise. Aqui a etiqueta é o papel impresso com preço e código
> de barras.

## Fluxo

1. **Gerar Etiquetas**: busca produtos (`GET /Products`), monta a lista com
   tipo, preço e quantidade por item e pré-visualiza as etiquetas.
2. **Salvar e Imprimir**: grava o lote (`POST /ProductLabelBatches`) e abre a
   caixa de impressão com a folha A4. O backend congela nome, código de barras
   e preço de cada item — a reimpressão reproduz o papel original mesmo que o
   cadastro mude depois.
3. **Histórico**: lista paginada dos lotes (`GET /ProductLabelBatches`), com
   detalhes, reimpressão fiel (valores congelados) e exclusão
   (`DELETE /ProductLabelBatches/{id}` — só remove o registro do histórico).

## Regras de negócio

- **Tipos de etiqueta** (enum `ProductLabelType` do backend): Normal = branca,
  Promoção = amarela, Queima de Estoque = vermelha — texto preto em todas,
  como nos cartazes de oferta de mercado.
- **Preço editável por item**: a etiqueta de promoção sai com o valor da
  oferta sem alterar o preço de venda do produto.
- O mesmo produto pode entrar duas vezes com **tipos diferentes** (preço
  normal + oferta); repetir o mesmo tipo é bloqueado — para mais cópias existe
  a quantidade.
- Produto **sem código de barras** imprime a etiqueta sem as barras.

## Impressão

- `print.ts` monta o documento A4 (medidas em mm, `@page size: A4`,
  `print-color-adjust: exact` para os fundos coloridos) e imprime via
  `printReceiptHtml` do `@workspace/receipt` (iframe fora da tela, cleanup por
  `afterprint`).
- `barcode.ts` gera o SVG com a **jsbarcode local** (sem CDN, funciona
  offline): EAN-13/EAN-8 quando o dígito verificador fecha, senão CODE128.

## Arquitetura

- `hooks/useLabelComposer.ts` — estado da aba de geração (busca, itens,
  totais, gravar → imprimir).
- `hooks/useLabelBatchHistory.ts` — listagem paginada, detalhes, reimpressão e
  exclusão.
- `components/` — subcomponentes puros ligados pela página
  `pages/gondola-labels.tsx` (rota `/etiquetas-gondola`).
- Contratos da API em `@workspace/api-client-react` (módulo "Etiquetas de
  gôndola"); desenho do backend em
  `Uaus.Backend.Api/docs/etiquetas-de-gondola.md`.
