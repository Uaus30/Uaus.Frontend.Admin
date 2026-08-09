export type {
  ReceiptData,
  ReceiptItem,
  ReceiptPayment,
  ReceiptStore,
  StoreInfo,
} from "./types";
export type { SaleItemLike, SaleLike, SaleReceiptContext } from "./from-sale";
export type {
  SalesReportData,
  SalesReportPaymentTotal,
  SalesReportSale,
  SalesReportSummary,
} from "./sales-report";

export { STORE_LOGO_DATA_URI } from "./logo";
export { RECEIPT_FOOTER_MESSAGE, STORE_INFO, resolveStoreInfo } from "./store-info";
export { formatReceiptCurrency } from "./document";
export { buildReceiptHtml, computeItemsSubtotal } from "./render";
export { buildSalesReportHtml, printSalesReport } from "./sales-report";
export { buildReceiptFromSale } from "./from-sale";
export { printReceipt, printReceiptHtml } from "./print";
