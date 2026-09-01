import { renderHook, act, waitFor } from "@testing-library/react";
import { useProductTable } from "../useProductTable";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { upsertProduct, syncProductImages } from "@/services/products.service";
import type { ProductTableRowDto } from "@workspace/api-client-react";

/**
 * A tabela de produtos depois do item 4.1.
 *
 * O que estes testes protegem, além do comportamento: a página inteira nasce de
 * UMA requisição. Antes eram quatro níveis em cascata (grupos, produtos por
 * grupo, etiquetas e imagens por produto, imagem por id) — mais de 200
 * requisições numa página de 20 grupos com variações. O teste do "custo" conta as
 * chamadas de rede de verdade, porque uma cascata reintroduzida não quebra nada
 * visível: a tela só fica lenta de novo.
 */

/**
 * Linha crua do servidor. O produto representante ("Caneca Personalizada 300ml")
 * tem nome DIFERENTE do grupo ("Caneca Personalizada") de propósito, para flagrar
 * o PUT que renomeia o produto.
 */
const linhaDoServidor: ProductTableRowDto = {
  productGroupId: 1,
  productGroupName: "Caneca Personalizada",
  productGroupDescription: null,
  hasVariations: false,
  showOnSite: true,
  createdAt: "2026-01-01T00:00:00",
  updatedAt: null,
  categoryId: 5,
  categoryName: "Presentes",
  departmentId: 3,
  departmentName: "Papelaria",
  productId: 10,
  productName: "Caneca Personalizada 300ml",
  productDescription: "Caneca de porcelana",
  barcode: "789000000001",
  price: 25,
  costPrice: 10,
  stock: 5,
  minStock: 1,
  status: 2,
  variationCount: 1,
  tags: [{ id: 4, name: "Promoção", color: "#ff0000" }],
  images: [
    {
      associationId: 77,
      createdAt: "2026-01-02T00:00:00",
      updatedAt: null,
      imageId: 88,
      displayOrder: 0,
      name: "caneca-frente",
      url: "https://cdn/caneca-frente.jpg",
    },
  ],
};

/**
 * O `fetch` é dublado no nível mais baixo DE PROPÓSITO.
 *
 * Dublar `useGetProductTable` seria mais curto e não mediria nada: a cascata que
 * este item removeu vivia justamente entre o hook e a rede. Com o cliente HTTP
 * real rodando, `fetch.mock.calls` é a contagem verdadeira de idas ao servidor —
 * o número que o item 4.1 existe para derrubar.
 */
const fetchMock = vi.fn(async (url: string | URL) => {
  const href = String(url);

  if (href.includes("/Products/table")) {
    return new Response(
      JSON.stringify({
        items: [linhaDoServidor],
        pagination: { page: 1, size: 10, filteredItems: 1 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  throw new Error(`Requisição inesperada: ${href}`);
});

vi.stubGlobal("fetch", fetchMock);

/** URLs pedidas ao servidor nesta renderização, sem o host. */
function caminhosPedidos(): string[] {
  return fetchMock.mock.calls.map((call) => {
    const url = new URL(String(call[0]));
    return `${url.pathname}${url.search}`;
  });
}

vi.mock("@/services/products.service", () => ({
  upsertProduct: vi.fn(() => Promise.resolve({ id: 10 })),
  syncProductImages: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/services/images.service", () => ({
  createImageFromFile: vi.fn(() => Promise.resolve({ id: 99, url: "img.png" })),
  downloadWebImageAsFile: vi.fn(() => Promise.resolve(new File([""], "img.png"))),
}));

vi.mock("@/services/categories.service", () => ({
  getAllDepartments: vi.fn(() =>
    Promise.resolve([
      { id: 3, name: "Papelaria" },
      { id: 1, name: "Alimentos" },
    ]),
  ),
  getAllCategories: vi.fn(() =>
    Promise.resolve([
      { id: 5, departmentId: 3, name: "Presentes" },
      { id: 2, departmentId: 1, name: "Bebidas" },
      { id: 4, departmentId: 3, name: "Cadernos" },
    ]),
  ),
}));

// O catálogo de status é a tabela de tradução do enum; dublado aqui porque não
// é o que este item mede, e porque ele é compartilhado e cacheado por 5 min.
vi.mock("@/services/core", () => ({
  getEnumOptions: vi.fn(() =>
    Promise.resolve([
      { id: 2, value: "Active", name: "Ativo" },
      { id: 4, value: "Inactive", name: "Inativo" },
      { id: 1, value: "Draft", name: "Rascunho" },
    ]),
  ),
}));

vi.mock("@/lib/imageOptimizer", () => ({
  optimizeImage: vi.fn((file: File) =>
    Promise.resolve({
      file,
      optimized: false,
      originalSize: 0,
      optimizedSize: 0,
    }),
  ),
}));

const mockToast = vi.fn();
vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mockToast }),
}));

describe("useProductTable Hook", () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("monta a página com UMA requisição de listagem, sem cascata", async () => {
    // O motivo do item 4.1. Antes: 1 página de grupos + 1 consulta de produtos
    // POR GRUPO + 2 consultas POR PRODUTO + 1 POR IMAGEM, em quatro idas e
    // voltas em série. Se alguém reintroduzir a cascata, nada quebra na tela —
    // ela só volta a levar segundos para abrir. Por isso a contagem é teste.
    const { result } = renderHook(() => useProductTable(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.enrichedProducts).toHaveLength(1));

    const caminhos = caminhosPedidos();
    expect(caminhos).toHaveLength(1);
    expect(caminhos[0]).toContain("/Products/table");
    expect(caminhos[0]).toContain("page=1");
    expect(caminhos[0]).toContain("size=10");
  });

  it("exibe o nome do grupo na linha sem perder o nome do produto", async () => {
    const { result } = renderHook(() => useProductTable(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.enrichedProducts).toHaveLength(1));

    const linha = result.current.enrichedProducts[0];
    expect(linha.name).toBe("Caneca Personalizada");
    expect(linha.productName).toBe("Caneca Personalizada 300ml");
  });

  it("traz categoria, departamento, etiquetas e imagem já resolvidos na linha", async () => {
    // Eram exatamente estes campos que custavam os três catálogos completos e as
    // consultas por produto.
    const { result } = renderHook(() => useProductTable(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.enrichedProducts).toHaveLength(1));

    const linha = result.current.enrichedProducts[0];
    expect(linha.department).toEqual({ id: 3, name: "Papelaria" });
    expect(linha.category).toEqual({ id: 5, name: "Presentes" });
    expect(linha.tags).toEqual([{ id: 4, name: "Promoção", color: "#ff0000" }]);
    expect(linha.images[0].image.url).toBe("https://cdn/caneca-frente.jpg");
    expect(linha.productGroup.hasVariations).toBe(false);
  });

  it("envia o nome ORIGINAL do produto na edição inline de preço", async () => {
    // Regressão: a linha da tabela exibe o nome do GRUPO; o PUT com esse nome
    // renomeava o produto silenciosamente (com registro no histórico),
    // afetando cupom e PDV.
    const { result } = renderHook(() => useProductTable(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.enrichedProducts).toHaveLength(1));

    await act(async () => {
      await result.current.updateProductPrice(result.current.enrichedProducts[0], 29.9);
    });

    expect(upsertProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 10,
        name: "Caneca Personalizada 300ml",
        description: "Caneca de porcelana",
        barcode: "789000000001",
        price: 29.9,
        status: 2,
      }),
    );
  });

  it("invalida o prefixo do recurso na edição inline de preço", async () => {
    // Regressão: a linha lê preço e estoque de UMA query (`["products","table"]`).
    // Invalidar as chaves antigas da cascata compilaria, rodaria sem erro e
    // deixaria a célula mostrando o valor velho depois de salvar.
    const { result } = renderHook(() => useProductTable(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.enrichedProducts).toHaveLength(1));
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await act(async () => {
      await result.current.updateProductPrice(result.current.enrichedProducts[0], 29.9);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["products"] });
    // A invalidação do prefixo tem que ALCANÇAR a query registrada.
    expect(queryClient.getQueryCache().findAll({ queryKey: ["products"] })).not.toHaveLength(0);
  });

  it("preserva as imagens atuais ao definir uma imagem da web como principal", async () => {
    // As associações vinham de `/ProductImages?productId=` — uma requisição por
    // produto. Agora saem da linha; perder o `associationId` aqui faria o sync
    // recriar (e duplicar) o que já existe.
    const { result } = renderHook(() => useProductTable(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.enrichedProducts).toHaveLength(1));

    await act(async () => {
      await result.current.saveWebImageAsPrincipal(
        result.current.enrichedProducts[0],
        "https://web/nova.jpg",
      );
    });

    expect(syncProductImages).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 10,
        currentAssociations: [expect.objectContaining({ id: 77, imageId: 88, productId: 10 })],
        nextImages: [
          { imageId: 99, displayOrder: 0 },
          { imageId: 88, displayOrder: 1 },
        ],
      }),
    );
  });

  it("inicia com status Ativo selecionado por padrão e repassa para a API", async () => {
    const { result } = renderHook(() => useProductTable(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.enrichedProducts).toHaveLength(1));

    expect(result.current.status).toBe(2);
    const caminhos = caminhosPedidos();
    expect(caminhos.some((c) => c.includes("status=2"))).toBe(true);
  });

  it("ordena departamentos, categorias e status em ordem alfabética", async () => {
    const { result } = renderHook(() => useProductTable(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.departments).toHaveLength(2));

    expect(result.current.departments.map((d) => d.name)).toEqual(["Alimentos", "Papelaria"]);
    expect(result.current.statusOptions.map((s) => s.name)).toEqual(["Ativo", "Inativo", "Rascunho"]);
  });

  it("filtra categorias pelo departamento selecionado e reseta categoria órfã", async () => {
    const { result } = renderHook(() => useProductTable(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.departments).toHaveLength(2));

    // Seleciona departamento 3 (Papelaria)
    act(() => {
      result.current.setDepartmentId(3);
    });

    // Categorias de Papelaria ordenadas alfabeticamente
    expect(result.current.categories.map((c) => c.name)).toEqual(["Cadernos", "Presentes"]);

    // Seleciona categoria 4 (Cadernos)
    act(() => {
      result.current.setCategoryId(4);
    });
    expect(result.current.categoryId).toBe(4);

    // Muda para departamento 1 (Alimentos) -> categoria 4 (Cadernos) deve ser resetada
    act(() => {
      result.current.setDepartmentId(1);
    });
    expect(result.current.categoryId).toBeUndefined();
    expect(result.current.categories.map((c) => c.name)).toEqual(["Bebidas"]);
  });

  it("limpa todos os filtros e restaura status Ativo ao chamar resetFilters", async () => {
    const { result } = renderHook(() => useProductTable(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.departments).toHaveLength(2));

    act(() => {
      result.current.setSearch("teste");
      result.current.setDepartmentId(3);
      result.current.setCategoryId(5);
      result.current.setStatus(4); // Inativo
    });

    expect(result.current.search).toBe("teste");
    expect(result.current.departmentId).toBe(3);
    expect(result.current.categoryId).toBe(5);
    expect(result.current.status).toBe(4);

    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.search).toBe("");
    expect(result.current.departmentId).toBeUndefined();
    expect(result.current.categoryId).toBeUndefined();
    expect(result.current.status).toBe(2); // Ativo por padrão
    expect(result.current.page).toBe(1);
  });
});
