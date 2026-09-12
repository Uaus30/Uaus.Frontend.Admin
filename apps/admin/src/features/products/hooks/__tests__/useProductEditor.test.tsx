import { renderHook, act, waitFor } from "@testing-library/react";
import { useProductEditor } from "../useProductEditor";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GRADE_TYPE } from "@workspace/api-client-react";
import { syncProductGroupImages } from "@/services/products.service";
import { createImageFromFile } from "@/services/images.service";

const mocks = vi.hoisted(() => ({
  saveProductGroupWithProducts: vi.fn(() =>
    Promise.resolve({ group: { id: 1 }, products: [{ id: 10, canDelete: true }] }),
  ),
  markPurchaseReceived: vi.fn(() => Promise.resolve({})),
  /** A página de produtos do grupo aberto — a que hidrata a tabela de variações. */
  getProductsPage: vi.fn((): Promise<{ data: unknown[]; total: number }> =>
    Promise.resolve({ data: [], total: 0 }),
  ),
}));

// Dubla só o que fala com a rede; o resto do api-client continua o de verdade.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  saveProductGroupWithProducts: mocks.saveProductGroupWithProducts,
  markPurchaseReceived: mocks.markPurchaseReceived,
}));

// Mock services and utilities
vi.mock("@/services/products.service", () => ({
  getAllProducts: vi.fn(() => Promise.resolve([])),
  getAllProductGroupImages: vi.fn(() => Promise.resolve([])),
  getAllProductTags: vi.fn(() => Promise.resolve([])),
  getProductsPage: mocks.getProductsPage,
  syncProductTags: vi.fn(() => Promise.resolve()),
  syncProductGroupImages: vi.fn(() => Promise.resolve([])),
  deleteProduct: vi.fn(() => Promise.resolve()),
  deleteProductGroup: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/services/categories.service", () => ({
  getAllCategories: vi.fn(() => Promise.resolve([])),
  getGradesByCategoryId: vi.fn(() => Promise.resolve([])),
  getAllDepartments: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/services/tags.service", () => ({
  getAllTags: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/services/images.service", () => ({
  getAllImages: vi.fn(() => Promise.resolve([])),
  createImageFromFile: vi.fn(() => Promise.resolve({ id: 99, url: "img.png" })),
}));

vi.mock("@/services/core", () => ({
  getEnumOptions: vi.fn(() => Promise.resolve([])),
  buildPublicImageUrl: vi.fn((url) => url),
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useProductEditor Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize default form values and detail status", () => {
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    expect(result.current.detailOpen).toBe(false);
    expect(result.current.saving).toBe(false);
    expect(result.current.form.productGroupName).toBe("");
    expect(result.current.form.hasVariations).toBe(false);
  });

  it("should handle openDetail in create mode", () => {
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    act(() => {
      result.current.openDetail();
    });

    expect(result.current.detailOpen).toBe(true);
    expect(result.current.editingGroupId).toBeNull();
  });

  it("should handle openDetail in edit mode", () => {
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    const mockProduct = {
      id: 10,
      name: "COPO VERDE",
      price: 15.5,
      barcode: "123456",
      productGroup: {
        id: 1,
        name: "COPO",
        description: "Desc",
        hasVariations: false,
        showOnSite: true,
      },
      tags: [],
      images: [],
    };

    act(() => {
      result.current.openDetail(mockProduct);
    });

    expect(result.current.detailOpen).toBe(true);
    expect(result.current.editingGroupId).toBe(1);
    expect(result.current.productEditor.name).toBe("COPO VERDE");
    expect(result.current.productEditor.price).toBe(15.5);
  });

  it("produto simples ganhando variação: a carga do grupo não apaga a linha da modal", async () => {
    // REGRESSÃO (produção, 12/09/2026 — produto 897 em admin.uaus.com.br):
    // "Configurar Variações" gerava a tabela e, um instante depois, ela voltava
    // a ter uma linha só, SEM a coluna da grade escolhida. O produto simples
    // salvo tem a tabela vazia (ele mora no `productEditor`), então marcar as
    // grades ligava `hasVariations` — e a query `products-by-group`, que
    // acabava de ser habilitada, devolvia o mesmo produto sem valor de grade
    // nenhum. O efeito que hidrata a tabela sobrescrevia o que a modal tinha
    // acabado de aplicar. Nada disso dava erro: a tela só desfazia sozinha.
    mocks.getProductsPage.mockResolvedValueOnce({
      data: [
        {
          id: 897,
          name: "CALCINHA INFANTIL LISA ALGODAO",
          description: "",
          price: 12.9,
          stock: 7,
          minStock: 2,
          status: 2,
          barcode: "7896725329402",
          productGroupId: 1,
          variationValues: [],
          canDelete: true,
        },
      ],
      total: 1,
    });

    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    act(() => {
      result.current.openDetail({
        id: 897,
        name: "CALCINHA INFANTIL LISA ALGODAO",
        price: 12.9,
        barcode: "7896725329402",
        productGroup: { id: 1, name: "CALCINHA INFANTIL LISA ALGODAO", hasVariations: false },
        tags: [],
        images: [],
      });
    });

    expect(result.current.variationDrafts).toHaveLength(0);

    act(() => {
      result.current.applyGrades([{ type: GRADE_TYPE.Size, values: [] }]);
    });

    expect(result.current.variationDrafts).toHaveLength(1);
    expect(result.current.variationDrafts[0].id).toBe(897);

    // A query só é habilitada agora, com `hasVariations` ligado — e é a
    // resposta dela que sobrescrevia a linha.
    await waitFor(() => expect(mocks.getProductsPage).toHaveBeenCalled());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.variationDrafts).toHaveLength(1);
    expect(result.current.variationDrafts[0].id).toBe(897);
    expect(result.current.variationDrafts[0].barcode).toBe("7896725329402");
    expect(result.current.variationDrafts[0].values).toEqual([{ gradeType: GRADE_TYPE.Size, value: "" }]);
    // A coluna existe para a tabela e para a validação, mesmo sem valor.
    expect(result.current.selectedGrades).toEqual([{ type: GRADE_TYPE.Size, values: [] }]);
  });

  it("should reset HasVariations correctly when toggled", () => {
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    act(() => {
      result.current.toggleHasVariations(true);
    });

    expect(result.current.form.hasVariations).toBe(true);
    expect(result.current.variationDrafts.length).toBe(0);
  });

  it("deve persistir descrição e visibilidade (showOnSite) do grupo ao salvar", async () => {
    // Regressão: persistGroup não enviava description (o PUT mandava null e o
    // backend apagava a descrição do banco) nem a visibilidade do switch.
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    const mockProduct = {
      id: 10,
      name: "COPO VERDE",
      description: "",
      price: 15.5,
      stock: 2,
      minStock: 0,
      status: 2,
      barcode: "123456",
      department: { id: 2 },
      category: { id: 5 },
      productGroup: {
        id: 1,
        name: "COPO",
        description: "Descrição original",
        hasVariations: false,
        showOnSite: false,
      },
      tags: [],
      images: [],
    };

    act(() => {
      result.current.openDetail(mockProduct);
    });

    // O formulário carrega os valores persistidos do grupo
    expect(result.current.form.description).toBe("Descrição original");
    expect(result.current.form.isPublic).toBe(false);

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: () => {} } as unknown as React.FormEvent);
    });

    // O salvamento é UMA chamada atômica: grupo e produto viajam juntos.
    expect(mocks.saveProductGroupWithProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 1,
        categoryId: 5,
        name: "COPO",
        description: "Descrição original",
        hasVariations: false,
        showOnSite: false,
        products: [expect.objectContaining({ id: 10, name: "COPO VERDE" })],
      }),
    );
  });

  it("deve preservar a posição escolhida para imagens novas ao salvar", async () => {
    // Regressão: as imagens recém-enviadas eram concatenadas no FIM da lista,
    // ignorando a ordem definida por drag-and-drop (a capa "pulava" de lugar).
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    const mockProduct = {
      id: 10,
      name: "COPO VERDE",
      description: "",
      price: 15.5,
      stock: 2,
      minStock: 0,
      status: 2,
      barcode: "123456",
      department: { id: 2 },
      category: { id: 5 },
      productGroup: { id: 1, name: "COPO", description: "", hasVariations: false, showOnSite: true },
      tags: [],
      images: [],
    };

    act(() => {
      result.current.openDetail(mockProduct);
    });

    // Usuário adiciona a imagem nova "C" e a arrasta para a primeira posição
    act(() => {
      result.current.setImages([
        { name: "C", url: "blob:c", file: new File(["c"], "c.png", { type: "image/png" }) },
        { imageId: 1, associationId: 100, name: "A", url: "a.png" },
        { imageId: 2, associationId: 101, name: "B", url: "b.png" },
      ]);
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: () => {} } as unknown as React.FormEvent);
    });

    expect(createImageFromFile).toHaveBeenCalledTimes(1);
    // A ordem da tela é a ordem gravada: a primeira é a capa.
    expect(syncProductGroupImages).toHaveBeenCalledWith(expect.objectContaining({ imageIds: [99, 1, 2] }));
  });

  it("abrir grupo COM variações mostra a galeria do grupo — e salvar não a apaga", async () => {
    // REGRESSÃO (produção, 12/09/2026 — grupo 168): a foto aparecia na listagem
    // e não na tela de detalhe. O ramo com variações do `openDetail` fazia
    // `setImages([])`, resto de quando a foto pertencia ao SKU; a galeria é do
    // GRUPO desde 12/09 e o produto que chega já traz as fotos dele.
    //
    // O que não aparecia era pior: `PUT /ProductGroupImages/{id}` manda a lista
    // INTEIRA, então o primeiro Salvar naquela tela gravava galeria vazia e
    // apagava as fotos do grupo — sem erro, sem aviso, e a vitrine perdia a
    // capa.
    mocks.saveProductGroupWithProducts.mockResolvedValueOnce({
      group: { id: 1 },
      products: [
        { id: 10, canDelete: true },
        { id: 11, canDelete: true },
      ],
    });

    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    const comFoto = {
      id: 10,
      name: "CUECA INFANTIL CORES",
      description: "",
      price: 7,
      stock: 3,
      minStock: 0,
      status: 2,
      barcode: "789",
      department: { id: 2 },
      category: { id: 5 },
      productGroup: {
        id: 1,
        name: "CUECA INFANTIL CORES",
        description: "",
        hasVariations: true,
        showOnSite: true,
      },
      tags: [],
      images: [
        {
          associationId: 202,
          imageId: 483,
          displayOrder: 0,
          createdAt: "2026-09-12T00:00:00",
          updatedAt: null,
          image: { id: 483, name: "CUECA INFANTIL GG", url: "cueca.png" },
        },
      ],
      variationValues: [{ gradeType: 1, value: "G" }],
    };

    act(() => {
      result.current.openDetail(comFoto);
    });

    expect(result.current.galleryImages).toHaveLength(1);
    expect(result.current.galleryImages[0].imageId).toBe(483);

    // A segunda variação entra só para o submit passar da validação.
    act(() => {
      result.current.addVariationDraft({
        status: "2",
        barcode: "790",
        price: 7,
        values: [{ gradeType: 1, value: "GG" }],
      });
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: () => {} } as unknown as React.FormEvent);
    });

    // A foto que já estava lá é regravada como está — e NÃO some.
    expect(syncProductGroupImages).toHaveBeenCalledWith({ productGroupId: 1, imageIds: [483] });
  });

  it("deve gravar a imagem anexada em grupo COM variações, na galeria do GRUPO", async () => {
    // REGRESSÃO (produção, 06/09/2026 — grupo 825): a galeria da aba Dados
    // escrevia sempre em `images`, o estado do produto SIMPLES, mesmo em grupo
    // com variações. O `handleSubmit`, no ramo com variações, só percorria
    // `variationDrafts` — a foto anexada não ia para lugar nenhum, o toast
    // dizia "Grupo e variações salvos" e ela sumia no recarregamento.
    //
    // Nada disso gerava erro. Desde 12/09/2026 a galeria é do GRUPO e o ramo
    // deixou de existir, mas o teste continua: ele trava o efeito observável —
    // a foto anexada na aba Dados tem que ser persistida.
    mocks.saveProductGroupWithProducts.mockResolvedValueOnce({
      group: { id: 1 },
      products: [
        { id: 10, canDelete: true },
        { id: 11, canDelete: true },
      ],
    });

    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    const variacao = {
      id: 10,
      name: "COPO INFANTIL",
      description: "",
      price: 9.9,
      stock: 0,
      minStock: 0,
      status: 2,
      barcode: "789",
      department: { id: 2 },
      category: { id: 5 },
      productGroup: { id: 1, name: "COPO INFANTIL", description: "", hasVariations: true, showOnSite: true },
      tags: [],
      images: [],
      variationValues: [{ gradeType: 1, value: "AZUL" }],
    };

    act(() => {
      result.current.openDetail(variacao);
    });

    expect(result.current.form.hasVariations).toBe(true);
    expect(result.current.variationDrafts).toHaveLength(1);

    // O cadastro com variações exige duas — a segunda entra para o submit não
    // parar na validação antes de chegar às imagens.
    act(() => {
      result.current.addVariationDraft({
        name: "COPO INFANTIL",
        status: "2",
        barcode: "790",
        values: [{ gradeType: 1, value: "VERDE" }],
      });
    });

    // O operador anexa a foto pela galeria da aba Dados — a MESMA galeria em
    // produto simples e em grupo com variações, e agora também o MESMO destino.
    act(() => {
      result.current.setGalleryImages([
        { name: "foto", url: "blob:foto", file: new File(["x"], "foto.png", { type: "image/png" }) },
      ]);
    });

    expect(result.current.galleryImages).toHaveLength(1);

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: () => {} } as unknown as React.FormEvent);
    });

    expect(createImageFromFile).toHaveBeenCalledTimes(1);
    // UMA chamada, com o id do GRUPO — não uma por variação.
    expect(syncProductGroupImages).toHaveBeenCalledTimes(1);
    expect(syncProductGroupImages).toHaveBeenCalledWith({ productGroupId: 1, imageIds: [99] });
  });

  it("deve manter a tela aberta depois de salvar um produto simples, ja com o id do grupo", async () => {
    // Desde 05/09/2026 o cadastro novo NAO fecha ao salvar: o operador segue
    // para a aba Estoque e lanca a entrada do que acabou de receber. Antes a
    // tela fechava e ele tinha que procurar o produto na lista para voltar.
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    act(() => {
      result.current.openDetail();
    });
    act(() => {
      result.current.setForm((current) => ({ ...current, categoryId: "5", productGroupName: "COPO" }));
      result.current.setProductEditor((current) => ({ ...current, name: "COPO", price: 10, status: "2" }));
    });
    expect(result.current.isDirty).toBe(true);

    let gravou = false;
    await act(async () => {
      gravou = await result.current.handleSubmit();
    });

    expect(gravou).toBe(true);
    expect(result.current.detailOpen).toBe(true);
    expect(result.current.editingGroupId).toBe(1);
    expect(result.current.productEditor.id).toBe(10);
    // O que esta na tela e o que o servidor gravou — nao conta mais como alterado.
    expect(result.current.isDirty).toBe(false);
  });

  it("deve devolver falso quando o servidor recusa, para o Avancar nao trocar de aba", async () => {
    mocks.saveProductGroupWithProducts.mockRejectedValueOnce(new Error("codigo de barras duplicado"));
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    act(() => {
      result.current.openDetail();
    });
    act(() => {
      result.current.setForm((current) => ({ ...current, categoryId: "5", productGroupName: "COPO" }));
      result.current.setProductEditor((current) => ({ ...current, name: "COPO", price: 10, status: "2" }));
    });

    let gravou = true;
    await act(async () => {
      gravou = await result.current.handleSubmit();
    });

    expect(gravou).toBe(false);
    expect(result.current.detailOpen).toBe(true);
    expect(result.current.editingGroupId).toBeNull();
  });
});

describe("cadastro a partir de uma compra", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const compra = {
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
    purchaseLink: null,
    purchaseDate: "2026-09-05T00:00:00",
    quantity: 3,
    grossTotal: 120,
    finalTotal: 100,
    unitGross: 40,
    unitFinal: 33.33,
    adjustmentPercent: -16.67,
    status: "Pending",
    receivedAt: null,
    purchaseEntryId: null,
    userName: null,
    images: [{ imageId: 9, url: "produtos/caneca.jpg", displayOrder: 0 }],
    // Compra de produto novo: um item so, sem variacao vinculada ainda.
    items: [],
    costSplitManual: false,
    replaceProductImages: true,
  };

  it("abre o cadastro novo preenchido pela compra e fecha a compra depois da entrada", async () => {
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    act(() => {
      result.current.openDetailFromPurchase(compra);
    });

    expect(result.current.detailOpen).toBe(true);
    expect(result.current.editingGroupId).toBeNull();
    expect(result.current.form.productGroupName).toBe("CANECA TERMICA");
    expect(result.current.form.description).toBe("500ml");
    expect(result.current.productEditor.name).toBe("CANECA TERMICA");
    // Sem preço sugerido na compra, cai na regra da loja: 40% de margem sobre o
    // custo unitário FINAL (33,33 / 0,6 = 55,55), arredondado PARA CIMA ao
    // múltiplo de 10 centavos — 55,50 daria 39,9%, e a sugestão nunca fica
    // abaixo do alvo.
    expect(result.current.productEditor.price).toBe(55.6);
    // As fotos entram JÁ enviadas (imageId): o salvar só cria a associação.
    expect(result.current.images).toEqual([
      { imageId: 9, name: "CANECA TERMICA", url: expect.stringContaining("caneca.jpg") },
    ]);
    expect(result.current.purchaseContext).toMatchObject({
      purchaseId: 5,
      supplierId: 1,
      quantity: 3,
      unitCost: 33.33,
    });
    // Preenchido pela compra não é "alterado pelo operador".
    expect(result.current.isDirty).toBe(false);

    await act(async () => {
      await result.current.completePurchaseReceipt(10, 77);
    });

    expect(mocks.markPurchaseReceived).toHaveBeenCalledWith(5, { productId: 10, purchaseEntryId: 77 });
    expect(result.current.purchaseContext).toBeNull();
  });

  it("o preço sugerido da compra manda sobre a regra dos 40%", () => {
    // Quem comprou já olhou para o custo e decidiu por quanto vende; recalcular
    // por cima disso descartaria a decisão.
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    act(() => {
      result.current.openDetailFromPurchase({ ...compra, suggestedPrice: 49.9 });
    });

    expect(result.current.productEditor.price).toBe(49.9);
  });

  it("fechar a tela descarta o contexto da compra", () => {
    // Um cadastro aberto depois pela lista não pode herdar a entrada de um
    // pedido que não é dele.
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    act(() => {
      result.current.openDetailFromPurchase(compra);
    });
    act(() => {
      result.current.resetForm();
    });

    expect(result.current.purchaseContext).toBeNull();
    expect(result.current.form.productGroupName).toBe("");
  });

  it("sem contexto de compra, fechar o recebimento não chama a API", async () => {
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.completePurchaseReceipt(10, 77);
    });

    expect(mocks.markPurchaseReceived).not.toHaveBeenCalled();
  });
});
