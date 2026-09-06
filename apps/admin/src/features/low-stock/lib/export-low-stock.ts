import { formatShortDate } from "@workspace/core";
import type { LowStockItem } from "../types";

/** Uma coluna da planilha: rótulo, largura e como tirar o valor do item. */
type Coluna = {
  header: string;
  width: number;
  /** Valor da célula. Número sai como NÚMERO, para o Excel somar e ordenar. */
  value: (item: LowStockItem) => string | number | Date | null;
  /** Formato do Excel, quando o valor é número ou data. */
  numFmt?: string;
};

const COLUNAS: Coluna[] = [
  { header: "Produto", width: 42, value: (item) => item.productName },
  { header: "Código de barras", width: 18, value: (item) => item.barcode },
  { header: "Categoria", width: 22, value: (item) => item.categoryName },
  { header: "Fornecedor", width: 22, value: (item) => item.supplierName ?? "" },
  { header: "Estoque", width: 10, value: (item) => item.stock, numFmt: "0" },
  { header: "Mínimo", width: 10, value: (item) => item.minStock, numFmt: "0" },
  { header: "Preço", width: 12, value: (item) => item.price, numFmt: '"R$" #,##0.00' },
  { header: "Custo", width: 12, value: (item) => item.costPrice, numFmt: '"R$" #,##0.00' },
  {
    header: "Última venda",
    width: 14,
    // Sai como TEXTO no formato brasileiro: a data vem em horário da loja e
    // convertê-la para o serial do Excel arriscaria o deslocamento de fuso que
    // o repositório já pagou uma vez.
    value: (item) => (item.lastSaleAt ? formatShortDate(item.lastSaleAt) : "Nunca vendido"),
  },
  { header: "Vendas 30d", width: 12, value: (item) => item.recentSales ?? 0, numFmt: "0" },
  {
    header: "Média/dia (90d)",
    width: 15,
    value: (item) => item.averageDailySales ?? 0,
    numFmt: "0.00",
  },
  {
    header: "Dura (dias)",
    width: 12,
    value: (item) => item.daysOfCover ?? null,
    numFmt: "0.0",
  },
  {
    header: "Compra em aberto",
    width: 17,
    value: (item) => (item.hasOpenPurchase ? "Sim" : "Não"),
  },
  {
    header: "Situação",
    width: 14,
    value: (item) => (item.isResolved ? "Resolvido" : "Pendente"),
  },
];

/**
 * Exporta o relatório de estoque baixo em XLSX, com cabeçalho formatado.
 *
 * XLSX de verdade (ExcelJS), e não CSV renomeado como o inventário faz: o
 * pedido é cabeçalho formatado, e CSV não carrega formato nenhum — quem abre
 * ainda precisa acertar separador e largura à mão.
 *
 * A biblioteca entra por `import()` dinâmico: ela é grande e só serve a este
 * botão, então fica fora do pacote inicial do admin e só baixa quando alguém
 * exporta.
 *
 * O cabeçalho é negrito sobre fundo escuro, com painel congelado e autofiltro:
 * a planilha abre pronta para filtrar e ordenar, que é o que se faz com um
 * relatório de reposição.
 */
export async function exportLowStockToXlsx(items: LowStockItem[], fileName: string): Promise<void> {
  const ExcelJS = await import("exceljs");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Uaus Admin";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Estoque baixo", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = COLUNAS.map((coluna) => ({ header: coluna.header, width: coluna.width }));

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  header.alignment = { vertical: "middle", horizontal: "center" };
  header.height = 22;

  for (const item of items) {
    const row = sheet.addRow(COLUNAS.map((coluna) => coluna.value(item)));

    COLUNAS.forEach((coluna, index) => {
      if (coluna.numFmt) row.getCell(index + 1).numFmt = coluna.numFmt;
    });

    // O que já está abaixo do mínimo sai com o saldo em vermelho — a planilha
    // é lida de cima a baixo, e a cor é o que separa urgência de contexto.
    if (item.stock <= item.minStock) {
      row.getCell(5).font = { color: { argb: "FFB91C1C" }, bold: true };
    }
  }

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUNAS.length } };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
