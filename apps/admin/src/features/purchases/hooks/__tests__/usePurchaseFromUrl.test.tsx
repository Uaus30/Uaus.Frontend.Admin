import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PurchaseDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  getPurchase: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  getPurchase: mocks.getPurchase,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { usePurchaseFromUrl } = await import("../usePurchaseFromUrl");
const { purchaseDetailPath, purchaseIdFromSearch } = await import("../../purchases-route");

const compra = {
  id: 12,
  createdAt: "2026-09-09T10:00:00",
  supplierId: 1,
  supplierName: "Shopee",
  productName: "CANECA TERMICA",
  purchaseDate: "2026-09-09T00:00:00",
  quantity: 3,
  grossTotal: 0,
  finalTotal: 0,
  unitGross: 0,
  unitFinal: 0,
  adjustmentPercent: 0,
  status: "Pending",
  images: [],
  items: [],
  costSplitManual: false,
  replaceProductImages: true,
} as PurchaseDto;

describe("purchases-route — link da compra", () => {
  it("monta o caminho e lê o id de volta; id que não é inteiro positivo vira null", () => {
    expect(purchaseDetailPath(12)).toBe("/estoque/compras?compra=12");
    expect(purchaseIdFromSearch("?compra=12")).toBe(12);
    expect(purchaseIdFromSearch("?produto=9&compra=12")).toBe(12);
    expect(purchaseIdFromSearch("?compra=abc")).toBeNull();
    expect(purchaseIdFromSearch("?compra=0")).toBeNull();
    expect(purchaseIdFromSearch("")).toBeNull();
  });
});

describe("usePurchaseFromUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/estoque/compras");
  });

  it("sem o parâmetro não vai à rede", () => {
    const abrirCompra = vi.fn();
    renderHook(() => usePurchaseFromUrl({ abrirCompra }));

    expect(mocks.getPurchase).not.toHaveBeenCalled();
    expect(abrirCompra).not.toHaveBeenCalled();
  });

  it("com ?compra=<id> busca a compra pelo id e abre a modal, mantendo o link na URL", async () => {
    // Pelo id, e não pela lista: a compra pode estar em outra página ou fora do
    // filtro padrão — uma lançada, por exemplo, que "Não lançadas" esconde.
    window.history.replaceState(null, "", "/estoque/compras?compra=12");
    mocks.getPurchase.mockResolvedValue(compra);
    const abrirCompra = vi.fn();

    renderHook(() => usePurchaseFromUrl({ abrirCompra }));

    await waitFor(() => expect(abrirCompra).toHaveBeenCalledWith(compra));
    expect(mocks.getPurchase).toHaveBeenCalledWith(12);
    expect(window.location.search).toBe("?compra=12");
  });

  it("id inexistente limpa a URL e avisa, sem derrubar a lista", async () => {
    window.history.replaceState(null, "", "/estoque/compras?compra=999");
    mocks.getPurchase.mockRejectedValue(new Error("404"));
    const abrirCompra = vi.fn();

    renderHook(() => usePurchaseFromUrl({ abrirCompra }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Compra não encontrada" })),
    );
    expect(abrirCompra).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });
});
