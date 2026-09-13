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
   * Preço de venda VIGENTE do produto vinculado, só para a tela mostrar
   * "Preço atual do produto: R$ X" ao lado do sugerido. Nulo em produto novo,
   * onde não há preço atual a comparar.
   */
  productPrice: number | null;
  /**
   * Categoria do produto, como string do `<Select>`. Obrigatória na compra de
   * produto novo — é ela que o cadastro gerado no recebimento recebe pronto.
   * Com produto vinculado vem do GRUPO e o campo fica travado.
   */
  categoryId: string;
  /**
   * Departamento, como string do `<Select>`. **Não é gravado**: serve para
   * filtrar as categorias, como no editor de produto — quem guarda a relação é
   * `categories.departmentId`.
   */
  departmentId: string;
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
  /**
   * As fotos.
   *
   * Com produto vinculado são a GALERIA DO GRUPO: a modal exibe e edita a
   * galeria do produto, e salvar replica lá. Em produto novo são só da compra,
   * e viram a galeria do cadastro quando ele nascer.
   */
  images: PurchaseFormImage[];
};

/**
 * Formulário de recebimento — que é também a CONFERÊNCIA do que chegou.
 *
 * A grade vem preenchida com o que foi pedido; o operador ajusta quando a caixa
 * traz outra coisa. O que se ajusta é a DISTRIBUIÇÃO, não o valor pago: a soma
 * tem que fechar com o total da compra, ou o operador confirma um total novo.
 */
export type ReceiveForm = {
  /** `yyyy-MM-dd`. */
  entryDate: string;
  invoiceNumber: string;
  notes: string;
  /** Preço de venda a aplicar no cadastro. */
  price: number;
  /** A grade conferida. Vazia em compra de produto simples. */
  items: PurchaseFormItem[];
  /** O total pago, que o operador pode confirmar como novo. */
  finalTotal: number;
};
