import type { ProductAnomaliesReportDto, ProductAnomalyRowDto } from "@workspace/api-client-react";

/**
 * Linhas no formato que a API devolve. Campo nulo é OMITIDO, e não escrito como
 * `null`: a serialização usa `WhenWritingNull`, e fixture com `null` testaria um
 * caso que a tela nunca recebe.
 */
export const jarra: ProductAnomalyRowDto = {
  productGroupId: 22,
  name: "JARRA MARACATU 1,560ML",
  imageUrl: "/img/jarra.jpg",
  categoryName: "Cozinha",
  hasVariations: false,
  stock: 2,
  anomalies: [
    {
      type: "PriceBelowCost",
      productId: 30,
      productName: "JARRA MARACATU 1,560ML",
      price: 14.9,
      costPrice: 15.42,
      stock: 2,
    },
  ],
};

export const cumbuca: ProductAnomalyRowDto = {
  productGroupId: 851,
  name: "CUMBUCA TIGELA BACIA DE PLÁSTICO 1L 2 REAIS",
  categoryName: "Utilidades",
  hasVariations: false,
  stock: 3,
  anomalies: [
    {
      type: "PhantomStock",
      productId: 1021,
      productName: "CUMBUCA TIGELA BACIA DE PLÁSTICO 1L 2 REAIS",
      stock: 3,
      phantom: {
        lowStockThreshold: 10,
        lastPurchaseQuantity: 100,
        lastPurchaseAt: "2026-08-18T09:47:40",
        lastSaleAt: "2026-09-22T10:32:01",
        silenceSince: "2026-09-22T10:32:01",
        windowSales: 39,
        windowStoreSales: 401,
        storeSalesSinceSilence: 31,
        expectedSales: 3.02,
      },
    },
    { type: "MissingPhoto" },
  ],
};

export const bexiga: ProductAnomalyRowDto = {
  productGroupId: 1,
  name: "BEXIGA",
  imageUrl: "/img/bexiga.jpg",
  hasVariations: true,
  stock: 20,
  anomalies: [
    {
      type: "ZeroCost",
      productId: 10,
      productName: "BEXIGA [AZUL]",
      price: 10,
      costPrice: 0,
      stock: 10,
      lastEntryId: 1011,
      lastEntryDate: "2026-08-18T00:00:00",
      zeroCostUnits: 10,
      zeroCostEntryId: 1011,
      zeroCostEntryDate: "2026-08-18T00:00:00",
    },
    { type: "DuplicateName", duplicateGroupIds: [935, 936] },
  ],
};

/** Livro de título único: uma unidade, parada há meses. O interruptor esconde. */
export const livro: ProductAnomalyRowDto = {
  productGroupId: 402,
  name: "LIVRO O CORTIÇO",
  imageUrl: "/img/livro.jpg",
  categoryName: "Livros",
  hasVariations: false,
  stock: 1,
  anomalies: [
    {
      type: "NeverSold",
      productId: 4020,
      productName: "LIVRO O CORTIÇO",
      stock: 1,
      firstPurchaseAt: "2026-05-10T00:00:00",
      daysWithoutSales: 136,
    },
  ],
};

/** Parou de vender com 7 em estoque; a linha também está sem foto. */
export const vaso: ProductAnomalyRowDto = {
  productGroupId: 510,
  name: "VASO DE CERÂMICA",
  categoryName: "Decoração",
  hasVariations: false,
  stock: 7,
  anomalies: [
    { type: "MissingPhoto" },
    {
      type: "NoRecentSales",
      productId: 5100,
      productName: "VASO DE CERÂMICA",
      stock: 7,
      lastSaleAt: "2026-08-12T15:20:00",
      daysWithoutSales: 42,
    },
  ],
};

export const relatorio: ProductAnomaliesReportDto = {
  generatedAt: "2026-09-23T18:42:10.123",
  rules: {
    lowStockMinUnits: 5,
    lowStockEntryShare: 0.1,
    phantomMinWindowSales: 3,
    phantomMinExpectedSales: 3,
    phantomWindowDays: 90,
    idleDays: 30,
    smallPhotoMinSide: 300,
    smallPhotoSalesWindowDays: 90,
  },
  counts: [
    { type: "PriceBelowCost", groups: 1 },
    { type: "PhantomStock", groups: 1 },
    { type: "ZeroCost", groups: 1 },
    { type: "MissingPhoto", groups: 1 },
    { type: "DuplicateName", groups: 1 },
  ],
  items: [jarra, cumbuca, bexiga],
};
