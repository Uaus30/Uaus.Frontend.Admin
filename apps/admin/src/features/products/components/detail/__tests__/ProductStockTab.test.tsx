import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useProductStockEntries: vi.fn(),
  useGetStockFreezeStatus: vi.fn((): { data?: { salesPaused: boolean }; isPending: boolean } => ({
    data: { salesPaused: false },
    isPending: false,
  })),
  /** Guarda o `onValueChange` do seletor para disparar valores à mão. */
  aoTrocarVariacao: { atual: null as ((value: string) => void) | null },
}));

vi.mock("@/features/stock-entries/hooks/useProductStockEntries", () => ({
  useProductStockEntries: mocks.useProductStockEntries,
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetStockFreezeStatus: mocks.useGetStockFreezeStatus,
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

// Na ordem que `opcoesDeVariacao` entrega: id crescente, rótulo só com a
// configuração — o nome do produto está no título da tela.
const variacoes = [
  { id: 39, label: "12L, ORIGINAL" },
  { id: 41, label: "12L, MASTER" },
];

/** O que a aba recebe do hook de entradas; `extras` sobrescreve campo a campo. */
function stockEntries(extras: Record<string, unknown> = {}) {
  return {
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
    ...extras,
  };
}

/** O recebimento de uma compra, que abre a entrada preenchida. */
const PREFILL = {
  reference: "compra-7",
  supplierId: 1,
  quantity: 20,
  unitCost: 4.5,
  notes: "Recebimento da compra #7",
};

function renderTab(
  onSelectProduct: (id: number) => void,
  extras: Partial<React.ComponentProps<typeof ProductStockTab>> = {},
) {
  // A aba hospeda a contagem física, que invalida cache — sem o provider, o
  // `useQueryClient` dela derruba o render inteiro.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProductStockTab
        productId={39}
        productName="BALDE DE PLASTICO [12L, ORIGINAL]"
        barcode="7908439800808"
        variationOptions={variacoes}
        onSelectProduct={onSelectProduct}
        {...extras}
      />
    </QueryClientProvider>,
  );
}

describe("ProductStockTab — seletor de variação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.aoTrocarVariacao.atual = null;
    mocks.useProductStockEntries.mockReturnValue(stockEntries());
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

describe("ProductStockTab — conferência de estoque aberta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useProductStockEntries.mockReturnValue(
      stockEntries({ product: { id: 39, stock: 4, price: 10, costPrice: 5 } }),
    );
    mocks.useGetStockFreezeStatus.mockReturnValue({ data: { salesPaused: true }, isPending: false });
  });

  afterEach(() => {
    mocks.useGetStockFreezeStatus.mockReturnValue({ data: { salesPaused: false }, isPending: false });
  });

  it("trava a entrada e deixa a contagem física, que é a ferramenta da conferência", () => {
    renderTab(vi.fn());

    expect(screen.getByRole("button", { name: /Registrar Entrada/i }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: /Contagem Física/i }).hasAttribute("disabled")).toBe(false);
  });

  it("a entrada da compra espera o encerramento para abrir sozinha", () => {
    // Aberta agora, ela seria recusada (423) ao salvar.
    renderTab(vi.fn(), { entryPrefill: PREFILL });

    expect(mocks.useProductStockEntries).toHaveBeenLastCalledWith(
      39,
      expect.objectContaining({ prefill: null }),
    );
    expect(screen.getByTestId("purchase-prefill-banner").textContent).toMatch(
      /quando a conferência de estoque for encerrada/,
    );
  });

  it("sem a resposta do congelamento, a entrada da compra ainda não abre", () => {
    mocks.useGetStockFreezeStatus.mockReturnValue({ data: undefined, isPending: true });

    renderTab(vi.fn(), { entryPrefill: PREFILL });

    expect(mocks.useProductStockEntries).toHaveBeenLastCalledWith(
      39,
      expect.objectContaining({ prefill: null }),
    );
  });

  it("com o estoque solto, a entrada da compra abre preenchida", () => {
    mocks.useGetStockFreezeStatus.mockReturnValue({ data: { salesPaused: false }, isPending: false });

    renderTab(vi.fn(), { entryPrefill: PREFILL });

    expect(mocks.useProductStockEntries).toHaveBeenLastCalledWith(
      39,
      expect.objectContaining({ prefill: PREFILL }),
    );
    expect(screen.getByRole("button", { name: /Registrar Entrada/i }).hasAttribute("disabled")).toBe(false);
  });
});
