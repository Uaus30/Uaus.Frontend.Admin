import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PurchaseDto, SupplierDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  createPurchase: vi.fn(),
  updatePurchase: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  createPurchase: mocks.createPurchase,
  updatePurchase: mocks.updatePurchase,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/services/images.service", () => ({
  createImageFromFile: vi.fn(),
  downloadWebImageAsFile: vi.fn(),
}));

const { usePurchaseForm, purchaseToForm, validatePurchaseForm, emptyPurchaseForm } =
  await import("../usePurchaseForm");

const compra: PurchaseDto = {
  id: 5,
  createdAt: "2026-09-05T10:00:00",
  updatedAt: null,
  supplierId: 1,
  supplierName: "Shopee",
  productId: null,
  productGroupId: null,
  productName: "CANECA TERMICA",
  productBarcode: null,
  details: "500ml",
  purchaseLink: "https://shopee.com.br/x",
  quantity: 3,
  grossTotal: 120,
  finalTotal: 100,
  unitGross: 40,
  unitFinal: 33.33,
  adjustmentPercent: -16.67,
  status: "InTransit",
  receivedAt: null,
  purchaseEntryId: null,
  userName: "Ana",
  images: [{ imageId: 9, url: "produtos/caneca.jpg", displayOrder: 0 }],
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("validatePurchaseForm", () => {
  it("exige fornecedor, produto ou nome, e quantidade inteira positiva", () => {
    const base = { ...emptyPurchaseForm(), supplierId: "1", productName: "X" };
    expect(validatePurchaseForm(base)).toBeNull();
    expect(validatePurchaseForm({ ...base, supplierId: "" })).toMatch(/fornecedor/);
    expect(validatePurchaseForm({ ...base, productName: "  " })).toMatch(/nome/);
    // Produto vinculado dispensa o nome digitado: o backend usa o do cadastro.
    expect(validatePurchaseForm({ ...base, productName: "", productId: 10 })).toBeNull();
    expect(validatePurchaseForm({ ...base, quantity: 0 })).toMatch(/quantidade/i);
    expect(validatePurchaseForm({ ...base, quantity: 1.5 })).toMatch(/quantidade/i);
    expect(validatePurchaseForm({ ...base, finalTotal: -1 })).toMatch(/negativos/);
  });
});

describe("purchaseToForm", () => {
  it("carrega a compra gravada, com o status como código de string e as fotos com URL pública", () => {
    // O backend serializa o enum como NOME; o <Select> trabalha com o código.
    const form = purchaseToForm(compra);

    expect(form.status).toBe("2");
    expect(form.supplierId).toBe("1");
    expect(form.images).toHaveLength(1);
    expect(form.images[0].imageId).toBe(9);
  });
});

/**
 * Um fornecedor comum e um marketplace: a regra do link depende do CADASTRO,
 * não do que foi digitado no formulário.
 */
const FORNECEDORES: SupplierDto[] = [
  {
    id: 1,
    createdAt: "2026-01-01T00:00:00",
    updatedAt: null,
    name: "Nossa Casa",
    corporateName: null,
    document: null,
    salesRepresentative: "",
    phone: "",
    email: null,
    minimumPurchaseValue: 0,
    status: 1,
    city: "",
    state: "",
    avatarColor: "#6366f1",
    description: null,
    isRecurring: true,
    isMarketplace: false,
  },
  {
    id: 2,
    createdAt: "2026-01-01T00:00:00",
    updatedAt: null,
    name: "Shopee",
    corporateName: null,
    document: null,
    salesRepresentative: "",
    phone: "",
    email: null,
    minimumPurchaseValue: 0,
    status: 1,
    city: "",
    state: "",
    avatarColor: "#6366f1",
    description: null,
    isRecurring: true,
    isMarketplace: true,
  },
];

describe("usePurchaseForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createPurchase.mockResolvedValue(compra);
    mocks.updatePurchase.mockResolvedValue(compra);
  });

  it("grava uma compra nova com os totais e os ids das fotos, e fecha a modal", async () => {
    const onSaved = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePurchaseForm({ onSaved, suppliers: FORNECEDORES }), {
      wrapper: createWrapper(),
    });

    act(() => result.current.openNew());
    act(() => {
      result.current.update("supplierId", "1");
      result.current.update("productName", " CANECA ");
      result.current.update("quantity", 3);
      result.current.update("grossTotal", 120);
      result.current.update("finalTotal", 100);
    });

    await act(async () => {
      result.current.submit();
    });

    await waitFor(() =>
      expect(mocks.createPurchase).toHaveBeenCalledWith(
        expect.objectContaining({
          supplierId: 1,
          productId: null,
          productName: "CANECA",
          quantity: 3,
          grossTotal: 120,
          finalTotal: 100,
          status: 1,
          imageIds: [],
        }),
      ),
    );
    await waitFor(() => expect(result.current.open).toBe(false));
    expect(onSaved).toHaveBeenCalled();
  });

  it("não vai à rede com o formulário incompleto e avisa", async () => {
    const { result } = renderHook(() => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES }), {
      wrapper: createWrapper(),
    });

    act(() => result.current.openNew());
    await act(async () => {
      result.current.submit();
    });

    expect(mocks.createPurchase).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "warning" }));
  });

  it("editar usa o PUT com o id da compra aberta", async () => {
    const { result } = renderHook(() => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES }), {
      wrapper: createWrapper(),
    });

    act(() => result.current.openEdit(compra));
    expect(result.current.editingId).toBe(5);
    expect(result.current.form.productName).toBe("CANECA TERMICA");

    await act(async () => {
      result.current.submit();
    });

    await waitFor(() =>
      expect(mocks.updatePurchase).toHaveBeenCalledWith(5, expect.objectContaining({ imageIds: [9] })),
    );
  });

  it("vincular um produto trava o nome no do cadastro; desvincular libera", () => {
    const { result } = renderHook(() => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES }), {
      wrapper: createWrapper(),
    });

    act(() => result.current.openNew());
    act(() =>
      result.current.selectProduct({
        id: 10,
        name: "BEXIGA [AZUL]",
        barcode: "100",
        stock: 2,
        price: 10,
        costPrice: 4,
      }),
    );

    expect(result.current.form.productId).toBe(10);
    expect(result.current.form.productName).toBe("BEXIGA [AZUL]");
    expect(result.current.form.productBarcode).toBe("100");

    act(() => result.current.clearProduct());
    expect(result.current.form.productId).toBeNull();
    // O nome fica como estava, para servir de ponto de partida do produto novo.
    expect(result.current.form.productName).toBe("BEXIGA [AZUL]");
  });

  it("marketplace: pendente sai sem link, a caminho não", async () => {
    const { result } = renderHook(() => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES }), {
      wrapper: createWrapper(),
    });

    act(() => result.current.openNew());
    act(() => {
      result.current.update("supplierId", "2"); // Shopee, marketplace
      result.current.update("productName", "CANECA");
      result.current.update("quantity", 1);
    });

    // Pendente é onde se anota a intenção de comprar, antes de escolher o anúncio.
    expect(result.current.linkRequired).toBe(false);
    await act(async () => result.current.submit());
    await waitFor(() => expect(mocks.createPurchase).toHaveBeenCalled());

    mocks.createPurchase.mockClear();
    act(() => result.current.update("status", "2")); // A caminho

    expect(result.current.linkRequired).toBe(true);
    await act(async () => result.current.submit());

    expect(mocks.createPurchase).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringContaining("Shopee") }),
    );

    act(() => result.current.update("purchaseLink", "https://shopee.com.br/item/1"));
    await act(async () => result.current.submit());
    await waitFor(() => expect(mocks.createPurchase).toHaveBeenCalled());
  });

  it("fornecedor comum não precisa de link em situação nenhuma", async () => {
    const { result } = renderHook(() => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES }), {
      wrapper: createWrapper(),
    });

    act(() => result.current.openNew());
    act(() => {
      result.current.update("supplierId", "1"); // Nossa Casa, não é marketplace
      result.current.update("productName", "CANECA");
      result.current.update("quantity", 1);
      result.current.update("status", "2");
    });

    expect(result.current.linkRequired).toBe(false);
    await act(async () => result.current.submit());
    await waitFor(() => expect(mocks.createPurchase).toHaveBeenCalled());
  });

  it("compra lançada abre em leitura e não vai à rede", async () => {
    const { result } = renderHook(() => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES }), {
      wrapper: createWrapper(),
    });

    // A linha inteira da listagem abre a compra, inclusive a já lançada — o que
    // muda é que ela abre bloqueada, em vez de não abrir.
    act(() => result.current.openEdit({ ...compra, status: 3 }));
    expect(result.current.readOnly).toBe(true);

    await act(async () => result.current.submit());
    expect(mocks.updatePurchase).not.toHaveBeenCalled();

    // Abrir uma pendente em seguida tem que destravar o formulário.
    act(() => result.current.openEdit(compra));
    expect(result.current.readOnly).toBe(false);
  });
});
