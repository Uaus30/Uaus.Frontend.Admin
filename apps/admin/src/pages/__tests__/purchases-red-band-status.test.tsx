import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PURCHASE_STATUS } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  setStatus: vi.fn(),
  getPurchaseBudget: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  getPurchaseBudget: mocks.getPurchaseBudget,
}));

// A página só renderiza o que o hook devolve: aqui, uma compra Pendente de
// R$ 2.183 em novembro — o tamanho da compra que pôs setembro no vermelho.
vi.mock("@/features/purchases/hooks/usePurchases", async (importOriginal) => ({
  // As constantes do filtro (STATUS_FILTER_OPEN...) a tabela importa daqui.
  ...(await importOriginal<typeof import("@/features/purchases/hooks/usePurchases")>()),
  usePurchases: () => ({
    items: [
      {
        id: 7,
        createdAt: "2026-11-20T10:00:00",
        supplierId: 1,
        supplierName: "Shopee",
        productName: "SQUISHY CAIXA MISTERIOSA GRANDE",
        purchaseDate: "2026-11-20T00:00:00",
        quantity: 10,
        grossTotal: 2183,
        finalTotal: 2183,
        unitGross: 218.3,
        unitFinal: 218.3,
        adjustmentPercent: 0,
        status: "Pending",
        images: [],
        items: [],
        costSplitManual: false,
      },
    ],
    isLoading: false,
    searchValue: "",
    setSearch: vi.fn(),
    statusFilter: "open",
    setStatusFilter: vi.fn(),
    supplierFilter: "all",
    setSupplierFilter: vi.fn(),
    suppliers: [{ id: 1, name: "Shopee" }],
    departments: [],
    page: 1,
    totalPages: 1,
    setPage: vi.fn(),
    remove: vi.fn(),
    setStatus: mocks.setStatus,
    startReceive: vi.fn(),
    mutatingId: null,
    cancelReceipt: { start: vi.fn() },
    cancelReceiptOfOpenPurchase: vi.fn(),
    form: {
      openNew: vi.fn(),
      openEdit: vi.fn(),
      form: { productName: "", productBarcode: null },
      imageSearchOpen: false,
      setImageSearchOpen: vi.fn(),
      addWebImage: vi.fn(),
    },
  }),
}));

// O que não é a linha da tabela nem a pergunta fica de fora.
vi.mock("@/features/purchases/hooks/useMonthPurchaseBudget", () => ({
  useMonthPurchaseBudget: () => undefined,
}));
vi.mock("@/features/purchases/components/PurchaseBudgetBanner", () => ({ PurchaseBudgetBanner: () => null }));
vi.mock("@/features/purchases/components/PurchaseEditorModal", () => ({ PurchaseEditorModal: () => null }));
vi.mock("@/features/purchases/components/PurchaseReceiveDialog", () => ({
  PurchaseReceiveDialog: () => null,
}));
vi.mock("@/features/purchases/components/CancelReceiptDialog", () => ({ CancelReceiptDialog: () => null }));
vi.mock("@/features/products/components/ProductImageSearchModal", () => ({
  ProductImageSearchModal: () => null,
}));

const { default: Purchases } = await import("../purchases");

/** Novembro amarelo, com R$ 218 até o vermelho. */
const NOVEMBRO_AMARELO = {
  month: "2026-11",
  periodStart: "2026-11-01T00:00:00",
  periodEnd: "2026-11-30T00:00:00",
  isCurrentMonth: true,
  isClosedMonth: false,
  isProvisional: false,
  openingBalance: 0,
  contributions: 0,
  availableBalance: 0,
  revenue: 3865,
  costOfSales: 2500,
  purchasesPaid: 2782,
  purchasesPlanned: 2183,
  plannedWithoutValueCount: 0,
  fixedCosts: 865,
  greenLimit: 2500,
  redLimit: 3000,
  greenRoom: -282,
  redRoom: 218,
  band: "Yellow",
  bandIfPlannedBought: "Red",
  reliesOnBalance: false,
  stockValueAtCost: 34000,
  stockDays: 190,
};

function marcarComoACaminho() {
  fireEvent.pointerDown(screen.getByRole("button", { name: "Opções da compra 7" }), {
    button: 0,
    ctrlKey: false,
  });
  fireEvent.click(screen.getByRole("menuitem", { name: /marcar como a caminho/i }));
}

describe("Compras — 'Marcar como a caminho' no menu da linha (decisão 13)", () => {
  beforeEach(() => {
    mocks.setStatus.mockReset();
    mocks.getPurchaseBudget.mockReset();
  });

  it("pergunta antes de levar o mês ao vermelho, e só grava com o sim", async () => {
    mocks.getPurchaseBudget.mockResolvedValue(NOVEMBRO_AMARELO);
    render(<Purchases />);

    marcarComoACaminho();

    // Antes da correção, o menu gravava direto e o mês ia ao vermelho calado.
    expect(await screen.findByText("Comprar no vermelho?")).toBeTruthy();
    expect(screen.getByText(/novembro não cobre os custos fixos/)).toBeTruthy();
    expect(mocks.setStatus).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Marcar mesmo assim" }));
    expect(mocks.setStatus).toHaveBeenCalledWith(7, PURCHASE_STATUS.InTransit);
  });

  it("com folga até o vermelho, grava direto, sem pergunta", async () => {
    mocks.getPurchaseBudget.mockResolvedValue({ ...NOVEMBRO_AMARELO, redLimit: 6000, redRoom: 3218 });
    render(<Purchases />);

    marcarComoACaminho();

    await vi.waitFor(() => expect(mocks.setStatus).toHaveBeenCalledWith(7, PURCHASE_STATUS.InTransit));
    expect(screen.queryByText("Comprar no vermelho?")).toBeNull();
  });
});
