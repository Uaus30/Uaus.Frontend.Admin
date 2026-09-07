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
