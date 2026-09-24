import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryDto, PurchaseDto, SupplierDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  createPurchase: vi.fn(),
  updatePurchase: vi.fn(),
  getProductGroupById: vi.fn(),
  getProductGroupImages: vi.fn(),
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
  getProductGroupById: mocks.getProductGroupById,
  getProductGroupImages: mocks.getProductGroupImages,
}));

const { getProductsPage } = await import("@/services/products.service");

const {
  usePurchaseForm,
  purchaseToForm,
  validatePurchaseForm,
  emptyPurchaseForm,
  todayDateKey,
  purchaseHasProduct,
  purchaseCategoryIsLocked,
  purchaseDataWouldBeReplaced,
} = await import("../usePurchaseForm");

/** Duas categorias do departamento 4, para a resolução do departamento ter o que achar. */
const CATEGORIAS: CategoryDto[] = [
  {
    id: 7,
    createdAt: "2026-01-01T00:00:00",
    updatedAt: null,
    departmentId: 4,
    name: "Canecas",
    description: null,
    productCount: 0,
  },
  {
    id: 8,
    createdAt: "2026-01-01T00:00:00",
    updatedAt: null,
    departmentId: 4,
    name: "Bexigas",
    description: null,
    productCount: 0,
  },
];

const compra: PurchaseDto = {
  // Compra de um item so: a grade espelha o cabecalho, como 100% das
  // compras anteriores a 12/09/2026.
  items: [],
  costSplitManual: false,
  id: 5,
  createdAt: "2026-09-05T10:00:00",
  updatedAt: null,
  supplierId: 1,
  supplierName: "Shopee",
  productId: null,
  productGroupId: null,
  // Produto novo: a categoria e obrigatoria e e ela que o cadastro gerado no
  // recebimento recebe pronto (13/09/2026).
  categoryId: 7,
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
    const base = { ...emptyPurchaseForm(), supplierId: "1", productName: "X", categoryId: "7" };
    expect(validatePurchaseForm(base)).toBeNull();
    expect(validatePurchaseForm({ ...base, supplierId: "" })).toMatch(/fornecedor/);
    expect(validatePurchaseForm({ ...base, productName: "  " })).toMatch(/nome/);
    // Produto vinculado dispensa o nome digitado: o backend usa o do cadastro.
    expect(validatePurchaseForm({ ...base, productName: "", productId: 10 })).toBeNull();
    expect(validatePurchaseForm({ ...base, quantity: 0 })).toMatch(/quantidade/i);
    expect(validatePurchaseForm({ ...base, quantity: 1.5 })).toMatch(/quantidade/i);
    expect(validatePurchaseForm({ ...base, finalTotal: -1 })).toMatch(/negativos/);
  });

  it("totais: pendente pode ficar sem, a caminho exige o bruto E o final", () => {
    const base = { ...emptyPurchaseForm(), supplierId: "1", productName: "X", categoryId: "7" };

    // Pendente é a anotação de "preciso comprar isto" — antes de saber o preço.
    expect(validatePurchaseForm({ ...base, grossTotal: 0, finalTotal: 0 })).toBeNull();
    // O bruto é pedido primeiro: o final nasce igual a ele (24/09/2026).
    expect(validatePurchaseForm({ ...base, status: "2", grossTotal: 0, finalTotal: 0 })).toMatch(
      /total bruto/i,
    );
    // Só o final já não basta: até 24/09/2026 bastava, e o bruto era opcional.
    expect(validatePurchaseForm({ ...base, status: "2", grossTotal: 0, finalTotal: 35.9 })).toMatch(
      /total bruto/i,
    );
    // Só o bruto também não: é do FINAL que sai o custo da entrada.
    expect(validatePurchaseForm({ ...base, status: "2", grossTotal: 40, finalTotal: 0 })).toMatch(
      /total final/i,
    );
    expect(validatePurchaseForm({ ...base, status: "2", grossTotal: 40, finalTotal: 35.9 })).toBeNull();
  });

  it("código de barras inválido não passa, com a mesma mensagem do cadastro de produto", () => {
    const base = { ...emptyPurchaseForm(), supplierId: "1", productName: "X", categoryId: "7" };

    // Verificador errado: o último dígito de 789123456789? é 5.
    expect(validatePurchaseForm({ ...base, productBarcode: "7891234567890" })).toMatch(
      /não é um EAN-13 válido/,
    );
    expect(validatePurchaseForm({ ...base, productBarcode: "7891234567895" })).toBeNull();
    // Até 11 dígitos vira código interno: é válido.
    expect(validatePurchaseForm({ ...base, productBarcode: "20" })).toBeNull();
    // Com produto vinculado o código é o do cadastro, e não é conferido aqui.
    expect(validatePurchaseForm({ ...base, productId: 3, productBarcode: "ABC" })).toBeNull();
  });

  it("exige data da compra e recusa data futura", () => {
    const base = { ...emptyPurchaseForm(), supplierId: "1", productName: "X", categoryId: "7" };

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

describe("purchaseDataWouldBeReplaced", () => {
  const novo = (over: Partial<ReturnType<typeof emptyPurchaseForm>> = {}) => ({
    ...emptyPurchaseForm(),
    ...over,
  });

  it("foto anexada na compra é sempre algo a perder", () => {
    const comFoto = novo({ images: [{ imageId: 91, url: "x", name: "y" }] });
    expect(purchaseDataWouldBeReplaced(comFoto, "CANECA TERMICA")).toBe(true);
  });

  it("nome digitado diferente do catálogo também", () => {
    expect(purchaseDataWouldBeReplaced(novo({ productName: "CANECA TERMICA" }), "CANECA TÉRMICA 500ML")).toBe(
      true,
    );
  });

  it("nome igual, sem foto: não há o que perguntar", () => {
    // A comparação é em caixa alta porque é assim que o nome é gravado e assim
    // que o campo da modal digita. Sem isso, escolher o produto certo depois de
    // digitar o nome dele perguntaria à toa — e pergunta à toa ninguém lê.
    expect(purchaseDataWouldBeReplaced(novo({ productName: "caneca termica" }), "CANECA TERMICA")).toBe(
      false,
    );
    expect(purchaseDataWouldBeReplaced(novo({ productName: "  " }), "CANECA TERMICA")).toBe(false);
    expect(purchaseDataWouldBeReplaced(novo(), "CANECA TERMICA")).toBe(false);
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
        {
          id: 2,
          productId: 11,
          productName: "CAMISETA [VERMELHA]",
          barcode: "111",
          quantity: 3,
          grossTotal: 0,
          finalTotal: 60,
          stock: 0,
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
      {
        productId: 11,
        name: "CAMISETA [VERMELHA]",
        barcode: "111",
        stock: 0,
        quantity: 3,
        grossTotal: 0,
        finalTotal: 60,
      },
    ]);
  });

  it("compra de UM produto não carrega a grade — o cabeçalho é que manda", () => {
    // REGRESSÃO (produção, compra #31, 12/09/2026): toda compra tem um item no
    // banco, espelho do cabeçalho. Carregá-lo no formulário fazia o campo de
    // quantidade mentir — ele edita o cabeçalho, o item ficava com o valor
    // antigo, e no salvar o backend deriva dos ITENS quando eles vêm. O operador
    // trocava a quantidade, via "Compra atualizada" e o número não mudava.
    const form = purchaseToForm({
      ...compra,
      quantity: 12,
      items: [
        {
          id: 31,
          productId: 589,
          productName: "BATOM HIDRATANTE",
          barcode: "790",
          quantity: 1,
          grossTotal: 199.99,
          finalTotal: 186.2,
          stock: 0,
          unitFinal: 186.2,
        },
      ],
    });

    expect(form.items).toEqual([]);
    expect(form.quantity).toBe(12);
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

/** O produto que o seletor devolve nos testes de vínculo. */
const PRODUTO_ESCOLHIDO = {
  id: 10,
  productGroupId: 10,
  name: "CANECA TÉRMICA 500ML",
  barcode: "7891234567895",
  stock: 4,
  price: 39.9,
  costPrice: 18.4,
};

describe("usePurchaseForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Registrar uma compra grava a memória da próxima (24/09/2026): sem limpar,
    // um teste preencheria o formulário do seguinte.
    window.localStorage.clear();
    mocks.createPurchase.mockResolvedValue(compra);
    mocks.updatePurchase.mockResolvedValue(compra);
  });

  it("grava uma compra nova com os totais e os ids das fotos, e fecha a modal", async () => {
    const onSaved = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(
      () => usePurchaseForm({ onSaved, suppliers: FORNECEDORES, categories: CATEGORIAS }),
      {
        wrapper: createWrapper(),
      },
    );

    act(() => result.current.openNew());
    act(() => {
      result.current.update("supplierId", "1");
      result.current.update("categoryId", "7");
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
          categoryId: 7,
          // O preço sugerido nasce do CÁLCULO DE MARGEM: custo unitário 33,33
          // (R$ 100 ÷ 3) a 40% de margem dá 55,55, arredondado PARA CIMA ao
          // múltiplo de dez centavos. Ninguém digitou — a tela já tinha a conta.
          suggestedPrice: 55.6,
          status: 1,
          imageIds: [],
        }),
      ),
    );
    await waitFor(() => expect(result.current.open).toBe(false));
    expect(onSaved).toHaveBeenCalled();
  });

  it("envia o preço sugerido quando ele foi informado", async () => {
    const { result } = renderHook(
      () => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES, categories: CATEGORIAS }),
      {
        wrapper: createWrapper(),
      },
    );

    act(() => result.current.openNew());
    act(() => {
      result.current.update("supplierId", "1");
      result.current.update("categoryId", "7");
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
    const { result } = renderHook(
      () => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES, categories: CATEGORIAS }),
      {
        wrapper: createWrapper(),
      },
    );

    act(() => result.current.openNew());
    await act(async () => {
      result.current.submit();
    });

    expect(mocks.createPurchase).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "warning" }));
  });

  it("editar usa o PUT com o id da compra aberta", async () => {
    const { result } = renderHook(
      () => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES, categories: CATEGORIAS }),
      {
        wrapper: createWrapper(),
      },
    );

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
    const { result } = renderHook(
      () => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES, categories: CATEGORIAS }),
      {
        wrapper: createWrapper(),
      },
    );

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

  it("escolher um produto carrega a galeria e a categoria DELE", async () => {
    // 13/09/2026: a modal exibe e edita a galeria do grupo. Sem isto, salvar uma
    // compra de reposição mandaria uma lista de fotos vazia — e a edição
    // esvaziaria a galeria do próprio produto.
    mocks.getProductGroupById.mockResolvedValue({ id: 10, categoryId: 8, name: "BEXIGA" });
    mocks.getProductGroupImages.mockResolvedValue([
      { id: 1, productGroupId: 10, imageId: 91, displayOrder: 0, url: "produtos/bexiga.jpg", name: "bexiga" },
    ]);

    const { result } = renderHook(
      () => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES, categories: CATEGORIAS }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.openNew());
    await act(async () => {
      result.current.selectProduct({
        id: 10,
        productGroupId: 10,
        name: "BEXIGA [AZUL]",
        barcode: "100",
        stock: 2,
        price: 12.5,
        costPrice: 4,
      });
    });

    await waitFor(() => expect(result.current.form.images).toHaveLength(1));
    expect(result.current.form.images[0].imageId).toBe(91);
    expect(result.current.form.categoryId).toBe("8");
    // O departamento não viaja em lugar nenhum: sai da categoria, pelo catálogo.
    expect(result.current.form.departmentId).toBe("4");
    // O preço vigente, para a modal mostrar "Preço atual do produto".
    expect(result.current.form.productPrice).toBe(12.5);
    // Com produto cadastrado, categoria e departamento são do CADASTRO e não se
    // editam aqui — quem edita é a tela de Produtos.
    expect(purchaseCategoryIsLocked(result.current.form)).toBe(true);

    // Desvincular tira as fotos junto: elas eram a galeria daquele produto, e
    // deixá-las daria ao cadastro novo as fotos de outro item.
    act(() => result.current.clearProduct());
    expect(result.current.form.images).toEqual([]);
    expect(result.current.form.productPrice).toBeNull();
    expect(purchaseCategoryIsLocked(result.current.form)).toBe(false);
  });

  it("vincular por cima de foto anexada pergunta antes, e nada muda enquanto não responderem", () => {
    // Antes disto, escolher o produto trocava nome e fotos em silêncio: quem
    // anotou a compra de um produto novo, subiu as fotos do anúncio e só depois
    // descobriu que o item já tinha cadastro via o trabalho sumir sem aviso.
    const { result } = renderHook(
      () => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES, categories: CATEGORIAS }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.openNew());
    act(() => result.current.update("productName", "CANECA TERMICA"));
    act(() => result.current.update("images", [{ imageId: 91, url: "anuncio.jpg", name: "anuncio" }]));

    act(() => result.current.selectProduct(PRODUTO_ESCOLHIDO));

    expect(result.current.pendingProduct).toEqual(PRODUTO_ESCOLHIDO);
    // O formulário fica intacto até a resposta, e o grupo nem é consultado.
    expect(result.current.form.productId).toBeNull();
    expect(result.current.form.productName).toBe("CANECA TERMICA");
    expect(mocks.getProductGroupById).not.toHaveBeenCalled();
  });

  it("'Usar as fotos do produto' vincula e troca a galeria pela do cadastro", async () => {
    mocks.getProductGroupById.mockResolvedValue({ id: 10, categoryId: 8, name: "CANECA TÉRMICA" });
    mocks.getProductGroupImages.mockResolvedValue([
      { id: 1, productGroupId: 10, imageId: 55, displayOrder: 0, url: "produtos/caneca.jpg", name: "caneca" },
    ]);

    const { result } = renderHook(
      () => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES, categories: CATEGORIAS }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.openNew());
    act(() => result.current.update("images", [{ imageId: 91, url: "anuncio.jpg", name: "anuncio" }]));
    act(() => result.current.selectProduct(PRODUTO_ESCOLHIDO));

    await act(async () => {
      result.current.confirmProductWithGallery();
    });

    await waitFor(() => expect(result.current.form.images).toHaveLength(1));
    expect(result.current.form.images[0].imageId).toBe(55);
    expect(result.current.form.productId).toBe(10);
    expect(result.current.form.productName).toBe("CANECA TÉRMICA 500ML");
    expect(result.current.pendingProduct).toBeNull();
  });

  it("'Manter as fotos desta compra' vincula sem buscar a galeria, mas a categoria continua vindo do cadastro", async () => {
    // A galeria do grupo nem é consultada: a lista do formulário é que vai
    // SUBSTITUIR a do produto no salvar (`SyncGroupImagesAsync`). Já a categoria
    // não é escolha — com produto vinculado ela é sempre a do cadastro.
    mocks.getProductGroupById.mockResolvedValue({ id: 10, categoryId: 8, name: "CANECA TÉRMICA" });

    const { result } = renderHook(
      () => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES, categories: CATEGORIAS }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.openNew());
    act(() => result.current.update("images", [{ imageId: 91, url: "anuncio.jpg", name: "anuncio" }]));
    act(() => result.current.selectProduct(PRODUTO_ESCOLHIDO));

    await act(async () => {
      result.current.confirmProductKeepingImages();
    });

    await waitFor(() => expect(result.current.form.categoryId).toBe("8"));
    expect(mocks.getProductGroupImages).not.toHaveBeenCalled();
    expect(result.current.form.images).toEqual([{ imageId: 91, url: "anuncio.jpg", name: "anuncio" }]);
    expect(result.current.form.productId).toBe(10);
    expect(result.current.pendingProduct).toBeNull();
  });

  it("'Não vincular' deixa o formulário exatamente como estava", () => {
    const { result } = renderHook(
      () => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES, categories: CATEGORIAS }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.openNew());
    act(() => result.current.update("images", [{ imageId: 91, url: "anuncio.jpg", name: "anuncio" }]));
    act(() => result.current.selectProduct(PRODUTO_ESCOLHIDO));

    act(() => result.current.cancelProductSelection());

    expect(result.current.pendingProduct).toBeNull();
    expect(result.current.form.productId).toBeNull();
    expect(result.current.form.images).toHaveLength(1);
    expect(mocks.getProductGroupById).not.toHaveBeenCalled();
  });

  it("trocar um produto JÁ vinculado por outro não pergunta nada", async () => {
    // O que está na tela é a galeria do produto ANTERIOR, não trabalho de
    // ninguém: perguntar ali seria a pergunta que aparece à toa.
    mocks.getProductGroupById.mockResolvedValue({ id: 20, categoryId: 8, name: "CANECA LISA" });
    mocks.getProductGroupImages.mockResolvedValue([]);

    const { result } = renderHook(
      () => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES, categories: CATEGORIAS }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.openNew());
    act(() => result.current.selectProduct(PRODUTO_ESCOLHIDO));
    await waitFor(() => expect(result.current.form.productId).toBe(10));

    act(() => result.current.update("images", [{ imageId: 91, url: "outra.jpg", name: "outra" }]));
    act(() =>
      result.current.selectProduct({ ...PRODUTO_ESCOLHIDO, id: 20, productGroupId: 20, name: "CANECA LISA" }),
    );

    expect(result.current.pendingProduct).toBeNull();
    expect(result.current.form.productId).toBe(20);
  });

  it("o preço sugerido acompanha o cálculo de margem até alguém digitar o seu", async () => {
    const { result } = renderHook(
      () => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES, categories: CATEGORIAS }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.openNew());
    // Sem custo não há o que sugerir.
    expect(result.current.form.suggestedPrice).toBe(0);

    act(() => {
      result.current.update("quantity", 2);
      result.current.update("finalTotal", 20);
    });
    // Custo 10 a 40% de margem dá 16,67, que sobe ao múltiplo de dez centavos.
    await waitFor(() => expect(result.current.form.suggestedPrice).toBe(16.7));

    // Mexeu no preço, o número é dele: mudar o custo não o substitui mais.
    act(() => result.current.update("suggestedPrice", 25));
    act(() => result.current.update("finalTotal", 40));
    await waitFor(() => expect(result.current.form.quantity).toBe(2));
    expect(result.current.form.suggestedPrice).toBe(25);
  });

  it("compra com preço já decidido reabre sem recalcular", () => {
    // Reabrir e ver o número mudar sozinho descartaria a decisão de quem comprou.
    const { result } = renderHook(
      () => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES, categories: CATEGORIAS }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.openEdit({ ...compra, suggestedPrice: 99.9 }));
    expect(result.current.form.suggestedPrice).toBe(99.9);
    // E o departamento da categoria gravada aparece resolvido pelo catálogo.
    expect(result.current.form.departmentId).toBe("4");
  });

  it("produto novo sem categoria não vai à rede", async () => {
    const { result } = renderHook(
      () => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES, categories: CATEGORIAS }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.openNew());
    act(() => {
      result.current.update("supplierId", "1");
      result.current.update("productName", "CANECA");
    });

    await act(async () => result.current.submit());
    expect(mocks.createPurchase).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "warning", description: expect.stringContaining("categoria") }),
    );

    act(() => result.current.update("categoryId", "7"));
    await act(async () => result.current.submit());
    await waitFor(() =>
      expect(mocks.createPurchase).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 7 })),
    );
  });

  it("a caminho sem custo não vai à rede; com custo, vai", async () => {
    const { result } = renderHook(
      () => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES, categories: CATEGORIAS }),
      {
        wrapper: createWrapper(),
      },
    );

    act(() => result.current.openNew());
    act(() => {
      result.current.update("supplierId", "1"); // Nossa Casa, não é marketplace
      result.current.update("categoryId", "7");
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
      expect.objectContaining({ variant: "warning", description: expect.stringContaining("total bruto") }),
    );

    // O bruto resolve os dois: o final nasce igual a ele.
    act(() => result.current.update("grossTotal", 50));
    await act(async () => result.current.submit());
    await waitFor(() =>
      expect(mocks.createPurchase).toHaveBeenCalledWith(
        expect.objectContaining({ status: 2, grossTotal: 50, finalTotal: 50 }),
      ),
    );
  });

  it("marketplace: pendente sai sem link, a caminho não", async () => {
    const { result } = renderHook(
      () => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES, categories: CATEGORIAS }),
      {
        wrapper: createWrapper(),
      },
    );

    act(() => result.current.openNew());
    act(() => {
      result.current.update("supplierId", "2"); // Shopee, marketplace
      result.current.update("categoryId", "7");
      result.current.update("productName", "CANECA");
      result.current.update("quantity", 1);
      // Com custo: o que está em teste aqui é o link, não a regra do custo. O
      // final acompanha o bruto.
      result.current.update("grossTotal", 30);
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
    const { result } = renderHook(
      () => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES, categories: CATEGORIAS }),
      {
        wrapper: createWrapper(),
      },
    );

    act(() => result.current.openNew());
    act(() => {
      result.current.update("supplierId", "1"); // Nossa Casa, não é marketplace
      result.current.update("categoryId", "7");
      result.current.update("productName", "CANECA");
      result.current.update("quantity", 1);
      result.current.update("grossTotal", 30);
      result.current.update("status", "2");
    });

    expect(result.current.linkRequired).toBe(false);
    await act(async () => result.current.submit());
    await waitFor(() => expect(mocks.createPurchase).toHaveBeenCalled());
  });

  it("abrir uma compra escreve ?compra=<id> na URL sem mexer no resto, e fechar a modal tira", () => {
    window.history.replaceState(null, "", "/estoque/compras?produto=9");
    const { result } = renderHook(
      () => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES, categories: CATEGORIAS }),
      {
        wrapper: createWrapper(),
      },
    );

    // É o link que se copia da barra de endereços para mandar a compra a alguém.
    act(() => result.current.openEdit(compra));
    expect(window.location.search).toBe("?produto=9&compra=5");

    // Fechar limpa: deixar o parâmetro faria um F5 reabrir a compra recém-fechada.
    act(() => result.current.setOpen(false));
    expect(window.location.search).toBe("?produto=9");
  });

  it("compra lançada abre em leitura e não vai à rede", async () => {
    const { result } = renderHook(
      () => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES, categories: CATEGORIAS }),
      {
        wrapper: createWrapper(),
      },
    );

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

  it("fechar sem ter digitado nada não pergunta nada", () => {
    const { result } = renderHook(
      () => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES, categories: CATEGORIAS }),
      { wrapper: createWrapper() },
    );

    // Abrir uma compra gravada preenche categoria, departamento e preço
    // sugerido sozinho. Nada disso é gesto do operador: a pergunta que aparece
    // à toa é a que ninguém lê.
    act(() => result.current.openEdit(compra));
    expect(result.current.dirty).toBe(false);

    act(() => result.current.requestClose());
    expect(result.current.discardOpen).toBe(false);
    expect(result.current.open).toBe(false);
  });

  it("fechar com algo digitado pergunta antes de descartar", () => {
    const { result } = renderHook(
      () => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES, categories: CATEGORIAS }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.openNew());
    act(() => result.current.update("quantity", 12));

    // O clique no fundo chega aqui pelo `onOpenChange` do Radix, como o Esc e o
    // X. Antes disto ele fechava a modal e levava o formulário junto.
    act(() => result.current.requestClose());
    expect(result.current.discardOpen).toBe(true);
    expect(result.current.open).toBe(true);

    // "Continuar editando": o que foi digitado continua lá.
    act(() => result.current.cancelDiscard());
    expect(result.current.discardOpen).toBe(false);
    expect(result.current.open).toBe(true);
    expect(result.current.form.quantity).toBe(12);

    act(() => result.current.requestClose());
    act(() => result.current.confirmDiscard());
    expect(result.current.open).toBe(false);
  });

  it("mexer na galeria conta como digitar", () => {
    const { result } = renderHook(
      () => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES, categories: CATEGORIAS }),
      { wrapper: createWrapper() },
    );

    // A galeria da compra é a do GRUPO desde 13/09/2026: tirar uma foto aqui
    // tira do produto quando a compra é salva. É decisão, não preenchimento.
    act(() => result.current.openEdit(compra));
    act(() => result.current.removeImage(9));
    expect(result.current.form.images).toHaveLength(0);

    act(() => result.current.requestClose());
    expect(result.current.discardOpen).toBe(true);
    expect(result.current.open).toBe(true);
  });

  it("compra lançada fecha direto — não há o que perder", () => {
    const { result } = renderHook(
      () => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES, categories: CATEGORIAS }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.openEdit({ ...compra, status: 3 }));
    act(() => result.current.requestClose());

    expect(result.current.open).toBe(false);
    expect(result.current.discardOpen).toBe(false);
  });
});

describe("usePurchaseForm — compra em sequência (24/09/2026)", () => {
  const EAN = "7891234567895";

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.createPurchase.mockResolvedValue(compra);
    mocks.updatePurchase.mockResolvedValue(compra);
    mocks.getProductGroupById.mockResolvedValue({ id: 5, categoryId: 7 });
    mocks.getProductGroupImages.mockResolvedValue([]);
    vi.mocked(getProductsPage).mockImplementation(
      (params) =>
        Promise.resolve(
          params?.search === EAN
            ? {
                data: [
                  {
                    id: 42,
                    productGroupId: 5,
                    name: "COPO TERMICO",
                    displayName: "COPO TERMICO",
                    barcode: EAN,
                    price: 39.9,
                    costPrice: 18.4,
                    stock: 7,
                  },
                ],
                total: 1,
              }
            : { data: [], total: 0 },
        ) as unknown as ReturnType<typeof getProductsPage>,
    );
  });

  function renderForm() {
    return renderHook(
      () => usePurchaseForm({ onSaved: vi.fn(), suppliers: FORNECEDORES, categories: CATEGORIAS }),
      {
        wrapper: createWrapper(),
      },
    );
  }

  /** Preenche o essencial de uma compra de produto novo, pronta para gravar. */
  function preencher(result: { current: ReturnType<typeof usePurchaseForm> }) {
    act(() => {
      result.current.update("supplierId", "1");
      result.current.update("categoryId", "7");
      result.current.update("productName", "CANECA");
      result.current.update("purchaseDate", "2026-09-20");
      result.current.update("status", "2");
      result.current.update("invoiceNumber", " NF 4521 ");
      result.current.update("grossTotal", 30);
    });
  }

  it("registrar lembra fornecedor, data, nota e situação, e a compra nova seguinte nasce com eles", async () => {
    const { result } = renderForm();

    act(() => result.current.openNew());
    preencher(result);
    await act(async () => result.current.submit());
    await waitFor(() => expect(result.current.open).toBe(false));

    act(() => result.current.openNew());
    expect(result.current.form).toMatchObject({
      supplierId: "1",
      purchaseDate: "2026-09-20",
      status: "2",
      // Aparada: é o que o servidor recebeu.
      invoiceNumber: "NF 4521",
    });
    // O resto é de uma compra nova.
    expect(result.current.form.productName).toBe("");
    expect(result.current.form.grossTotal).toBe(0);
    // A data não é de hoje: a tela pede para conferir.
    expect(result.current.dateFromMemory).toBe(true);

    // Trocou a data, o aviso some.
    act(() => result.current.update("purchaseDate", todayDateKey()));
    expect(result.current.dateFromMemory).toBe(false);
  });

  it("nota apagada na compra nova vira o novo padrão: a seguinte nasce sem nota", async () => {
    const { result } = renderForm();

    act(() => result.current.openNew());
    preencher(result);
    await act(async () => result.current.submit());
    await waitFor(() => expect(result.current.open).toBe(false));

    act(() => result.current.openNew());
    preencher(result);
    act(() => result.current.update("invoiceNumber", ""));
    await act(async () => result.current.submit());
    await waitFor(() => expect(result.current.open).toBe(false));

    act(() => result.current.openNew());
    expect(result.current.form.invoiceNumber).toBe("");
  });

  it("editar uma compra antiga não mexe na memória da próxima", async () => {
    const { result } = renderForm();

    act(() => result.current.openEdit(compra));
    await act(async () => result.current.submit());
    await waitFor(() => expect(mocks.updatePurchase).toHaveBeenCalled());

    act(() => result.current.openNew());
    expect(result.current.form.supplierId).toBe("");
    expect(result.current.form.status).toBe("1");
    expect(result.current.dateFromMemory).toBe(false);
  });

  it("a nota vai no corpo da compra", async () => {
    const { result } = renderForm();

    act(() => result.current.openNew());
    preencher(result);
    await act(async () => result.current.submit());

    await waitFor(() =>
      expect(mocks.createPurchase).toHaveBeenCalledWith(
        expect.objectContaining({ invoiceNumber: "NF 4521" }),
      ),
    );
  });

  it("o final acompanha o bruto até alguém editá-lo; depois, corrigir o bruto não o apaga", () => {
    const { result } = renderForm();

    act(() => result.current.openNew());
    act(() => result.current.setGrossTotal(100));
    expect(result.current.form.finalTotal).toBe(100);

    // Desconto negociado: o final passa a ser de quem digitou.
    act(() => result.current.setFinalTotal(90));
    act(() => result.current.setGrossTotal(120));
    expect(result.current.form).toMatchObject({ grossTotal: 120, finalTotal: 90 });
  });

  it("compra reaberta com desconto registrado não perde o final ao corrigir o bruto", () => {
    const { result } = renderForm();

    // Bruto 120, final 100: o desconto já está gravado.
    act(() => result.current.openEdit(compra));
    act(() => result.current.setGrossTotal(130));
    expect(result.current.form.finalTotal).toBe(100);

    // Reaberta com final igual ao bruto, ele volta a acompanhar.
    act(() => result.current.openEdit({ ...compra, grossTotal: 100, finalTotal: 100 }));
    act(() => result.current.setGrossTotal(110));
    expect(result.current.form.finalTotal).toBe(110);
  });

  it("o código de um produto já cadastrado vincula a compra a ele, e avisa", async () => {
    const { result } = renderForm();

    act(() => result.current.openNew());
    act(() => result.current.setProductBarcode(EAN));
    await act(async () => result.current.commitProductBarcode(EAN));

    await waitFor(() => expect(result.current.form.productId).toBe(42));
    expect(result.current.form).toMatchObject({
      productGroupId: 5,
      productName: "COPO TERMICO",
      productBarcode: EAN,
    });
    expect(result.current.pendingProduct).toBeNull();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Produto já cadastrado", description: expect.stringContaining(EAN) }),
    );
  });

  it("com nome digitado, o código pergunta antes; 'Não vincular' tira o código da compra", async () => {
    const { result } = renderForm();

    act(() => result.current.openNew());
    act(() => result.current.update("productName", "CANECA AZUL"));
    act(() => result.current.setProductBarcode(EAN));
    await act(async () => result.current.commitProductBarcode(EAN));

    await waitFor(() => expect(result.current.pendingProduct).not.toBeNull());
    expect(result.current.pendingBarcode).toBe(EAN);
    expect(result.current.form.productId).toBeNull();

    // O código já tem dono: deixá-lo ali só adiaria a recusa para o salvar.
    act(() => result.current.cancelProductSelection());
    expect(result.current.form).toMatchObject({
      productId: null,
      productName: "CANECA AZUL",
      productBarcode: null,
    });
    expect(result.current.pendingProduct).toBeNull();
  });

  it("código que não é de ninguém fica na compra e vai no corpo, como foi digitado", async () => {
    const { result } = renderForm();

    act(() => result.current.openNew());
    preencher(result);
    act(() => result.current.setProductBarcode("20"));
    await act(async () => result.current.commitProductBarcode("20"));
    await act(async () => result.current.submit());

    // O backend converte "20" pela mesma regra do cadastro de produto.
    await waitFor(() =>
      expect(mocks.createPurchase).toHaveBeenCalledWith(
        expect.objectContaining({ productId: null, productBarcode: "20" }),
      ),
    );
  });

  it("custo por variação sem desconto declarado: o bruto de cada variação acompanha o custo dela", async () => {
    // Em modo manual o bruto do pedido é a SOMA das variações, sem campo para
    // digitá-lo — e ele passou a ser obrigatório fora de Pendente. Sem o bruto
    // acompanhar, quem passasse ao custo por variação antes de digitar os totais
    // não conseguia mais marcar a compra como a caminho.
    vi.mocked(getProductsPage).mockImplementation(
      (params) =>
        Promise.resolve(
          params?.productGroupId === 5
            ? {
                data: [
                  {
                    id: 41,
                    productGroupId: 5,
                    name: "CAMISETA",
                    displayName: "CAMISETA [P]",
                    barcode: null,
                    stock: 0,
                  },
                  {
                    id: 42,
                    productGroupId: 5,
                    name: "CAMISETA",
                    displayName: "CAMISETA [G]",
                    barcode: null,
                    stock: 0,
                  },
                ],
                total: 2,
              }
            : { data: [], total: 0 },
        ) as unknown as ReturnType<typeof getProductsPage>,
    );
    const { result } = renderForm();

    act(() => result.current.openNew());
    act(() =>
      result.current.selectProduct({
        id: 41,
        productGroupId: 5,
        name: "CAMISETA [P]",
        barcode: null,
        stock: 0,
        price: 0,
        costPrice: 0,
      }),
    );
    await waitFor(() => expect(result.current.hasGrid).toBe(true));
    await waitFor(() => expect(result.current.form.items).toHaveLength(2));

    act(() => result.current.setCostSplitManual(true));
    act(() => result.current.setVariationCost(41, 45));
    act(() => result.current.setItemQuantity(42, 1));
    act(() => result.current.setVariationCost(42, 60));

    expect(result.current.form).toMatchObject({ grossTotal: 105, finalTotal: 105 });
  });

  it("passar pelo total final sem mudar o valor não o tira de acompanhar o bruto", () => {
    // O campo de moeda devolve o valor em TODO blur. Um Tab pelo final não é
    // decidir desconto: sem a comparação, corrigir o bruto depois deixava o final
    // para trás e a compra gravava 120 de bruto com 100 pagos — um desconto que
    // ninguém deu, e o custo do lote saindo dele.
    const { result } = renderForm();

    act(() => result.current.openNew());
    act(() => result.current.setGrossTotal(100));
    act(() => result.current.setFinalTotal(100));
    act(() => result.current.setGrossTotal(120));

    expect(result.current.form).toMatchObject({ grossTotal: 120, finalTotal: 120 });
  });

  /** Grupo 5 com duas variações, e a compra reaberta com a grade gravada. */
  function comGrade(itens: Array<{ grossTotal: number; finalTotal: number }>) {
    vi.mocked(getProductsPage).mockImplementation(
      (params) =>
        Promise.resolve(
          params?.productGroupId === 5
            ? {
                data: [
                  {
                    id: 41,
                    productGroupId: 5,
                    name: "CAMISETA",
                    displayName: "CAMISETA [P]",
                    barcode: null,
                    stock: 0,
                  },
                  {
                    id: 42,
                    productGroupId: 5,
                    name: "CAMISETA",
                    displayName: "CAMISETA [G]",
                    barcode: null,
                    stock: 0,
                  },
                ],
                total: 2,
              }
            : { data: [], total: 0 },
        ) as unknown as ReturnType<typeof getProductsPage>,
    );
    return {
      ...compra,
      productId: null,
      productGroupId: 5,
      costSplitManual: true,
      status: "Pending",
      quantity: 2,
      grossTotal: itens[0].grossTotal + itens[1].grossTotal,
      finalTotal: itens[0].finalTotal + itens[1].finalTotal,
      items: [41, 42].map((productId, i) => ({
        id: i + 1,
        productId,
        productName: productId === 41 ? "CAMISETA [P]" : "CAMISETA [G]",
        quantity: 1,
        stock: 0,
        unitFinal: itens[i].finalTotal,
        ...itens[i],
      })),
    };
  }

  it("compra de antes da regra, com bruto zerado, não fica presa no custo por variação", async () => {
    // Final 100 e bruto 0: o final conta como decidido. Sem o bruto da fatia
    // acompanhar o custo quando ela não tem bruto, o bruto do pedido — soma das
    // variações, sem campo em modo manual — ficava em zero, e sair de Pendente
    // passou a exigi-lo.
    const { result } = renderForm();

    act(() =>
      result.current.openEdit(
        comGrade([
          { grossTotal: 0, finalTotal: 50 },
          { grossTotal: 0, finalTotal: 50 },
        ]),
      ),
    );
    await waitFor(() => expect(result.current.hasGrid).toBe(true));

    act(() => result.current.setVariationCost(41, 60));
    act(() => result.current.setVariationCost(42, 50));

    expect(result.current.form).toMatchObject({ grossTotal: 110, finalTotal: 110 });
  });

  it("fatia com desconto declarado mantém o bruto dela ao trocar o custo", async () => {
    const { result } = renderForm();

    act(() =>
      result.current.openEdit(
        comGrade([
          { grossTotal: 50, finalTotal: 45 },
          { grossTotal: 50, finalTotal: 45 },
        ]),
      ),
    );
    await waitFor(() => expect(result.current.hasGrid).toBe(true));

    act(() => result.current.setVariationCost(42, 60));

    expect(result.current.form.items.find((item) => item.productId === 42)).toMatchObject({
      grossTotal: 50,
      finalTotal: 60,
    });
  });

  it("com produto vinculado, o código não vai no corpo: o do cadastro é que vale", async () => {
    const { result } = renderForm();

    act(() => result.current.openEdit({ ...compra, productId: 42, productGroupId: 5, productBarcode: EAN }));
    await act(async () => result.current.submit());

    await waitFor(() =>
      expect(mocks.updatePurchase).toHaveBeenCalledWith(5, expect.objectContaining({ productBarcode: null })),
    );
  });
});
