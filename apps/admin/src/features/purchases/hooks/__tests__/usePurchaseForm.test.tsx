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

// A grade de variações consulta o grupo do produto escolhido. Sem variação
// irmã, `hasGrid` é falso e o formulário continua o de sempre — que é o caso da
// esmagadora maioria das compras.
vi.mock("@/services/products.service", () => ({
  getProductsPage: vi.fn(() => Promise.resolve({ data: [], total: 0 })),
}));

const {
  usePurchaseForm,
  purchaseToForm,
  validatePurchaseForm,
  emptyPurchaseForm,
  todayDateKey,
  purchaseHasProduct,
} = await import("../usePurchaseForm");

const compra: PurchaseDto = {
  // Compra de um item so: a grade espelha o cabecalho, como 100% das
  // compras anteriores a 12/09/2026.
  items: [],
  costSplitManual: false,
  replaceProductImages: true,
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
  purchaseDate: "2026-08-28T00:00:00",
  quantity: 3,
  grossTotal: 120,
  finalTotal: 100,
  suggestedPrice: 55.6,
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

  it("custo: pendente pode ficar sem, a caminho não", () => {
    const base = { ...emptyPurchaseForm(), supplierId: "1", productName: "X" };

    // Pendente é a anotação de "preciso comprar isto" — antes de saber o preço.
    expect(validatePurchaseForm({ ...base, finalTotal: 0 })).toBeNull();
    expect(validatePurchaseForm({ ...base, status: "2", finalTotal: 0 })).toMatch(/total final/i);
    expect(validatePurchaseForm({ ...base, status: "2", finalTotal: 35.9 })).toBeNull();
    // Só o bruto não basta: é do FINAL que sai o custo da entrada.
    expect(validatePurchaseForm({ ...base, status: "2", grossTotal: 40, finalTotal: 0 })).toMatch(
      /total final/i,
    );
  });

  it("exige data da compra e recusa data futura", () => {
    const base = { ...emptyPurchaseForm(), supplierId: "1", productName: "X" };

    expect(validatePurchaseForm({ ...base, purchaseDate: "" })).toMatch(/data da compra/i);
    // Retroagir é o caso comum (o pedido é digitado depois); adiantar não existe.
    expect(validatePurchaseForm({ ...base, purchaseDate: "2099-01-01" })).toMatch(/futuro/i);
    expect(validatePurchaseForm({ ...base, purchaseDate: "2026-01-15" })).toBeNull();
  });
});

describe("purchaseHasProduct", () => {
  it("reconhece a compra de UMA variação pelo productId", () => {
    expect(purchaseHasProduct({ productId: 10, productGroupId: 1 })).toBe(true);
  });

  it("reconhece a compra com VARIAÇÕES pelo grupo", () => {
    // REGRESSÃO: o cabeçalho de uma compra com grade não aponta para nenhuma das
    // variações, e olhar só o `productId` mandava a compra para o cadastro em
    // branco — criando um produto novo, sem variações, ao lado do que já existia
    // (dev, 12/09/2026: compra do grupo 805 gerou o grupo 885).
    expect(purchaseHasProduct({ productId: null, productGroupId: 805 })).toBe(true);
  });

  it("só a compra de produto NOVO fica sem produto", () => {
    expect(purchaseHasProduct({ productId: null, productGroupId: null })).toBe(false);
    // O backend omite campos nulos: eles chegam ausentes, não como null.
    expect(purchaseHasProduct({})).toBe(false);
  });
});

describe("validatePurchaseForm com grade de variações", () => {
  const comGrade = (quantidades: number[]) => ({
    ...emptyPurchaseForm(),
    supplierId: "1",
    productId: 10,
    productGroupId: 1,
    quantity: quantidades.reduce((soma, q) => soma + q, 0),
    finalTotal: 100,
    items: quantidades.map((quantity, i) => ({
      productId: 10 + i,
      name: `CAMISETA [COR ${i}]`,
      barcode: null,
      stock: 0,
      quantity,
      grossTotal: 0,
      finalTotal: 0,
    })),
  });

  it("recusa a grade inteira zerada", () => {
    // A grade mostra TODAS as variações do grupo; sem nenhuma quantidade a
    // compra não diz o que foi comprado, e o backend recusaria depois do envio.
    expect(validatePurchaseForm(comGrade([0, 0, 0]))).toMatch(/ao menos uma varia/i);
  });

  it("aceita a grade com uma variação só preenchida", () => {
    expect(validatePurchaseForm(comGrade([0, 3, 0]))).toBeNull();
  });

  it("recusa quantidade negativa numa variação", () => {
    expect(validatePurchaseForm(comGrade([2, -1]))).toMatch(/maior ou igual a zero/i);
  });

  it("não exige nome quando a compra tem grupo, mesmo sem productId", () => {
    // Compra com variações: o cabeçalho não aponta para nenhuma delas. Sem o
    // critério certo, a validação pediria um "nome do produto" que não faz
    // sentido — o produto já está cadastrado.
    const semNome = { ...comGrade([0, 3]), productId: null, productName: "" };
    expect(validatePurchaseForm(semNome)).toBeNull();
  });
});

describe("emptyPurchaseForm", () => {
  it("nasce com a data de hoje e sem preço sugerido", () => {
    const form = emptyPurchaseForm();

    expect(form.purchaseDate).toBe(todayDateKey());
    // Zero é "não informei": o recebimento mantém o preço atual do produto.
    expect(form.suggestedPrice).toBe(0);
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
    // O campo de data trabalha em `yyyy-MM-dd`; o backend manda o instante.
    expect(form.purchaseDate).toBe("2026-08-28");
    expect(form.suggestedPrice).toBe(55.6);
  });

  it("carrega a grade de variações gravada", () => {
    // Reabrir a compra tem que devolver as quantidades por variação; as que
    // ficaram de fora entram zeradas quando a lista do grupo chega.
    const form = purchaseToForm({
      ...compra,
      productGroupId: 7,
      costSplitManual: true,
      items: [
        {
          id: 1,
          productId: 10,
          productName: "CAMISETA [AZUL]",
          barcode: "110",
          quantity: 2,
          grossTotal: 0,
          finalTotal: 40,
          stock: 5,
          unitFinal: 20,
        },
      ],
    });

    expect(form.productGroupId).toBe(7);
    expect(form.costSplitManual).toBe(true);
    expect(form.items).toEqual([
      {
        productId: 10,
        name: "CAMISETA [AZUL]",
        barcode: "110",
        stock: 5,
        quantity: 2,
        grossTotal: 0,
        finalTotal: 40,
      },
    ]);
  });

  it("compra sem preço sugerido vira zero, que é o vazio do campo de moeda", () => {
    // A API omite nulos: o campo chega AUSENTE, não como null.
    const { suggestedPrice: _omitido, ...semPreco } = compra;

    expect(purchaseToForm(semPreco as PurchaseDto).suggestedPrice).toBe(0);
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
      result.current.update("purchaseDate", "2026-09-01");
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
          // Instante LOCAL: `toISOString()` jogaria o dia para trás no Brasil.
          purchaseDate: "2026-09-01T00:00:00",
          // Não informado vai como nulo, não como zero — zero faria o
          // recebimento tentar aplicar preço zero ao produto.
          suggestedPrice: null,
          status: 1,
          imageIds: [],
        }),
      ),
    );
    await waitFor(() => expect(result.current.open).toBe(false));
    expect(onSaved).toHaveBeenCalled();
  });

  it("envia o preço sugerido quando ele foi informado", async () => {
    const { result } = renderHook(() => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES }), {
      wrapper: createWrapper(),
    });

    act(() => result.current.openNew());
    act(() => {
      result.current.update("supplierId", "1");
      result.current.update("productName", "CANECA");
      result.current.update("finalTotal", 100);
      result.current.update("suggestedPrice", 55.6);
    });

    await act(async () => {
      result.current.submit();
    });

    await waitFor(() =>
      expect(mocks.createPurchase).toHaveBeenCalledWith(expect.objectContaining({ suggestedPrice: 55.6 })),
    );
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
        productGroupId: 10,
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

  it("a caminho sem custo não vai à rede; com custo, vai", async () => {
    const { result } = renderHook(() => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES }), {
      wrapper: createWrapper(),
    });

    act(() => result.current.openNew());
    act(() => {
      result.current.update("supplierId", "1"); // Nossa Casa, não é marketplace
      result.current.update("productName", "CANECA");
      result.current.update("quantity", 2);
    });

    // Pendente: o custo é opcional, e a tela não pede.
    expect(result.current.costRequired).toBe(false);

    act(() => result.current.update("status", "2")); // A caminho
    expect(result.current.costRequired).toBe(true);

    await act(async () => result.current.submit());
    expect(mocks.createPurchase).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "warning", description: expect.stringContaining("total final") }),
    );

    act(() => result.current.update("finalTotal", 50));
    await act(async () => result.current.submit());
    await waitFor(() =>
      expect(mocks.createPurchase).toHaveBeenCalledWith(
        expect.objectContaining({ status: 2, finalTotal: 50 }),
      ),
    );
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
      // Com custo: o que está em teste aqui é o link, não a regra do custo.
      result.current.update("finalTotal", 30);
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
      result.current.update("finalTotal", 30);
      result.current.update("status", "2");
    });

    expect(result.current.linkRequired).toBe(false);
    await act(async () => result.current.submit());
    await waitFor(() => expect(mocks.createPurchase).toHaveBeenCalled());
  });

  it("abrir uma compra escreve ?compra=<id> na URL sem mexer no resto, e fechar a modal tira", () => {
    window.history.replaceState(null, "", "/estoque/compras?produto=9");
    const { result } = renderHook(() => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES }), {
      wrapper: createWrapper(),
    });

    // É o link que se copia da barra de endereços para mandar a compra a alguém.
    act(() => result.current.openEdit(compra));
    expect(window.location.search).toBe("?produto=9&compra=5");

    // Fechar limpa: deixar o parâmetro faria um F5 reabrir a compra recém-fechada.
    act(() => result.current.setOpen(false));
    expect(window.location.search).toBe("?produto=9");
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
