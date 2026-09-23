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

export const relatorio: ProductAnomaliesReportDto = {
  generatedAt: "2026-09-23T18:42:10.123",
  rules: {
    lowStockMinUnits: 5,
    lowStockEntryShare: 0.1,
    phantomMinWindowSales: 3,
    phantomMinExpectedSales: 3,
    phantomWindowDays: 90,
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
