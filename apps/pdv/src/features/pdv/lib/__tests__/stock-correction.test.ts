import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STOCK_CORRECTION_WATCH_MS,
  canCorrectStock,
  openStockCorrection,
  takeStockCorrectionsToRefresh,
  useStockCorrectionStore,
} from "../stock-correction";

const CANECA = { id: 7, name: "CANECA PORCELANA", barcode: "7891234567895" };

describe("stock-correction — o atalho do balcão para o admin", () => {
  beforeEach(() => {
    useStockCorrectionStore.setState({ pending: {} });
    vi.stubEnv("VITE_ADMIN_URL", "https://admin-dev.uaus.com.br");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("abre o admin na aba Estoque da variação, com a contagem aberta, e anota o produto", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);

    openStockCorrection(CANECA);

    expect(open).toHaveBeenCalledWith(
      "https://admin-dev.uaus.com.br/produtos?editar=7&aba=estoque&variacao=7&corrigir=1",
      "_blank",
      "noopener,noreferrer",
    );
    expect(takeStockCorrectionsToRefresh()).toEqual([CANECA]);
  });

  it("sem saber onde o admin está, não abre nada nem anota", () => {
    vi.stubEnv("VITE_ADMIN_URL", "");
    const open = vi.spyOn(window, "open").mockReturnValue(null);

    // jsdom serve em localhost sem a porta do PDV: não há admin a derivar.
    openStockCorrection(CANECA);

    expect(open).not.toHaveBeenCalled();
    expect(takeStockCorrectionsToRefresh()).toEqual([]);
    expect(canCorrectStock(true)).toBe(false);
  });

  it("sem internet o atalho não aparece: o admin não abriria", () => {
    expect(canCorrectStock(false)).toBe(false);
    expect(canCorrectStock(true)).toBe(true);
  });

  it("a anotação vence em meia hora: o PDV não relê para sempre o que ninguém corrigiu", () => {
    const agora = 1_000_000;
    useStockCorrectionStore.getState().watch(CANECA, agora);

    expect(takeStockCorrectionsToRefresh(agora + STOCK_CORRECTION_WATCH_MS)).toHaveLength(1);
    expect(takeStockCorrectionsToRefresh(agora + STOCK_CORRECTION_WATCH_MS + 1)).toEqual([]);
    expect(useStockCorrectionStore.getState().pending).toEqual({});
  });
});
