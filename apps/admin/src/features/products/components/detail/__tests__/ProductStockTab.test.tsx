import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useProductStockEntries: vi.fn(),
  /** Guarda o `onValueChange` do seletor para disparar valores à mão. */
  aoTrocarVariacao: { atual: null as ((value: string) => void) | null },
}));

vi.mock("@/features/stock-entries/hooks/useProductStockEntries", () => ({
  useProductStockEntries: mocks.useProductStockEntries,
}));

// Só o seletor é dublado, e por um motivo: o Radix decide sozinho QUANDO avisar
// a mudança, e o que este teste protege é a reação da aba ao aviso — inclusive
// ao aviso com string vazia, que o Radix manda quando o `value` aponta para um
// item que ainda não montou.
vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
  }) => {
    mocks.aoTrocarVariacao.atual = onValueChange;
    return (
      <div data-testid="seletor-variacao" data-value={value}>
        {children}
      </div>
    );
  },
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
}));

const { ProductStockTab } = await import("../ProductStockTab");

const variacoes = [
  { id: 41, name: "BALDE DE PLASTICO [12L, MASTER]" },
  { id: 39, name: "BALDE DE PLASTICO [12L, ORIGINAL]" },
];

function renderTab(onSelectProduct: (id: number) => void) {
  return render(
    <ProductStockTab
      productId={39}
      productName="BALDE DE PLASTICO [12L, ORIGINAL]"
      barcode="7908439800808"
      variationOptions={variacoes}
      onSelectProduct={onSelectProduct}
    />,
  );
}

describe("ProductStockTab — seletor de variação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.aoTrocarVariacao.atual = null;
    mocks.useProductStockEntries.mockReturnValue({
      page: 1,
      setPage: vi.fn(),
      totalPages: 0,
      entriesData: { data: [], page: 1, limit: 20, total: 0, totalPages: 0 },
      isLoadingEntries: false,
      product: null,
      suppliers: [],
      selectedEntryId: null,
      detailsModalOpen: false,
      setDetailsModalOpen: vi.fn(),
      entryDetails: null,
      isLoadingDetails: false,
      openDetails: vi.fn(),
      deleteEntry: vi.fn(),
      newEntryModalOpen: false,
      setNewEntryModalOpen: vi.fn(),
      openNewEntry: vi.fn(),
      form: {
        entryDate: "2026-09-06",
        invoiceNumber: "",
        supplierId: "",
        quantity: "",
        unitCost: "",
        price: "",
        notes: "",
      },
      updateForm: vi.fn(),
      isSavingEntry: false,
      handleSaveEntry: vi.fn(),
      formatCurrency: (valor: number) => String(valor),
      formatShortDate: (valor: string) => valor,
    });
  });

  it("sobe a variação escolhida", () => {
    const onSelectProduct = vi.fn();
    renderTab(onSelectProduct);

    mocks.aoTrocarVariacao.atual?.("41");

    expect(onSelectProduct).toHaveBeenCalledWith(41);
  });

  it("IGNORA o aviso com valor vazio, que apagaria a variação já escolhida", () => {
    // Era o defeito: `Number("")` é 0, e 0 não é variação de ninguém. Quem abria
    // a aba já apontando para uma variação — o recebimento de uma compra —
    // acabava vendo as entradas de OUTRA, porque a escolha caía para o padrão.
    const onSelectProduct = vi.fn();
    renderTab(onSelectProduct);

    mocks.aoTrocarVariacao.atual?.("");
    mocks.aoTrocarVariacao.atual?.("abc");
    mocks.aoTrocarVariacao.atual?.("0");

    expect(onSelectProduct).not.toHaveBeenCalled();
    expect(screen.getByTestId("seletor-variacao").getAttribute("data-value")).toBe("39");
  });
});
