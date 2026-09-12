import type { PurchaseDto, PurchaseImageDto } from "@workspace/api-client-react";

export type { PurchaseDto, PurchaseImageDto };

/** Foto já enviada ao catálogo de imagens, como o formulário a guarda. */
export type PurchaseFormImage = {
  imageId: number;
  /** URL pública, pronta para `<img src>`. */
  url: string;
  name: string;
};

/**
 * Uma linha da grade de variações.
 *
 * A grade nasce com TODAS as variações do grupo, e não só as compradas: é ela
 * que responde "o que existe para eu escolher". Quantidade zero é "não comprei
 * esta" e o backend descarta a linha — por isso a grade da tela e os itens
 * gravados não têm o mesmo tamanho.
 */
export type PurchaseFormItem = {
  productId: number;
  /** Nome COMPOSTO da variação ("CAMISETA [AZUL]"), como a grade exibe. */
  name: string;
  barcode: string | null;
  /** Saldo atual, para a linha mostrar "2 → 5". */
  stock: number;
  quantity: number;
  /**
   * Bruto e final DESTA variação. Em rateio são derivados e só aparecem como
   * prévia; em modo manual são o que o operador digitou — e aí é o cabeçalho que
   * vira a soma.
   */
  grossTotal: number;
  finalTotal: number;
};

/**
 * Valores do formulário da compra.
 *
 * Os totais são NÚMEROS porque vêm do `CurrencyInput`, que já devolve número;
 * o fornecedor e a situação são string porque vêm de `<Select>`. Unitários e
 * percentual não moram aqui — são derivados na tela (`derivePurchaseTotals`) e
 * pelo backend, nunca digitados.
 */
export type PurchaseForm = {
  supplierId: string;
  /** Produto já cadastrado (reposição). Nulo em produto novo. */
  productId: number | null;
  /**
   * Grupo do produto escolhido. É por ele que a grade de variações é carregada:
   * escolher uma cor no seletor abre o produto inteiro.
   */
  productGroupId: number | null;
  /**
   * A grade. Vazia em produto simples e em produto novo — aí a quantidade
   * continua sendo um campo só, como sempre foi.
   */
  items: PurchaseFormItem[];
  /**
   * `false` (padrão) = rateio: os totais do pedido são digitados e a fatia de
   * cada variação é derivada. `true` = o inverso.
   *
   * Exatamente UM lado é digitado. Com os dois, a tela se contradiz — e foi por
   * isso que o flag também é gravado no banco.
   */
  costSplitManual: boolean;
  productName: string;
  /** Código de barras do produto vinculado, só para conferência na tela. */
  productBarcode: string | null;
  details: string;
  purchaseLink: string;
  /** Dia da compra, `yyyy-MM-dd`. Nasce hoje. */
  purchaseDate: string;
  quantity: number;
  grossTotal: number;
  finalTotal: number;
  /**
   * Preço de venda pretendido. Zero é "não informei" — é como o `CurrencyInput`
   * representa campo em branco, e é o que faz o recebimento manter o preço
   * atual do produto.
   */
  suggestedPrice: number;
  /** Código de PurchaseStatus como string do `<Select>`: "1" Pendente, "2" A caminho. */
  status: string;
  images: PurchaseFormImage[];
};

/** Formulário de recebimento de compra com produto vinculado. */
export type ReceiveForm = {
  /** `yyyy-MM-dd`. */
  entryDate: string;
  invoiceNumber: string;
  notes: string;
  /** Preço de venda a aplicar no cadastro. */
  price: number;
};
