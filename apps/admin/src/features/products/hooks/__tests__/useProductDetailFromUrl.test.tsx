import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProductById: vi.fn(),
  getProductsPage: vi.fn(),
  buildProductCollections: vi.fn(),
  toast: vi.fn(),
  catalogosCarregando: { valor: false },
}));

vi.mock("@/services/products.service", () => ({
  getProductById: mocks.getProductById,
  getProductsPage: mocks.getProductsPage,
}));

vi.mock("@/services/mappers", () => ({
  buildProductCollections: mocks.buildProductCollections,
}));

/** Os sete catálogos respondem juntos — é o interruptor do teste. */
vi.mock("@/hooks/use-catalog", () => {
  const query = () => ({ data: [], isLoading: mocks.catalogosCarregando.valor });
  return {
    useAllCategories: query,
    useAllDepartments: query,
    useAllImages: query,
    useAllProductGroups: query,
    useAllProductImages: query,
    useAllProductTags: query,
    useAllTags: query,
  };
});

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { useProductDetailFromUrl } = await import("../useProductDetailFromUrl");

const PRODUTO = { id: 4210, productGroupId: 709, name: "BACIA COM TAMPA TRITEC" };
const LINHA = { id: 4210, productGroupId: 709, name: "BACIA COM TAMPA TRITEC" };

function irPara(url: string) {
  window.history.replaceState(null, "", url);
}

function caminhoAtual() {
  return `${window.location.pathname}${window.location.search}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.catalogosCarregando.valor = false;
  mocks.getProductsPage.mockResolvedValue({ data: [PRODUTO] });
  mocks.getProductById.mockResolvedValue(PRODUTO);
  mocks.buildProductCollections.mockReturnValue({ enrichedProducts: [LINHA] });
  irPara("/produtos");
});

afterEach(() => {
  irPara("/produtos");
});

describe("as três formas de URL", () => {
  it("abre pelo caminho canônico do detalhe", async () => {
    irPara("/produtos/709/detalhes");
    const openDetail = vi.fn();

    renderHook(() => useProductDetailFromUrl({ openDetail }));

    await waitFor(() => expect(openDetail).toHaveBeenCalledWith(LINHA));
    expect(mocks.getProductsPage).toHaveBeenCalledWith({ productGroupId: 709, page: 1, limit: 1 });
    // Já estava na rota canônica: nada a trocar na barra de endereços.
    expect(caminhoAtual()).toBe("/produtos/709/detalhes");
  });

  it("abre pelo `?id=` de antes da rota e troca a URL pela canônica", async () => {
    // O formato antigo está em favorito e em aba aberta de quem não recarregou.
    irPara("/produtos?id=709");
    const openDetail = vi.fn();

    renderHook(() => useProductDetailFromUrl({ openDetail }));

    await waitFor(() => expect(openDetail).toHaveBeenCalledWith(LINHA));
    expect(caminhoAtual()).toBe("/produtos/709/detalhes");
  });

  it("abre pelo `?editar=` do PDV resolvendo o GRUPO do produto", async () => {
    // O PDV e as Etiquetas conhecem o id do produto (uma variação), não o do
    // grupo: o `ProductPdvSearchDto` não traz `productGroupId`.
    irPara("/produtos?busca=BACIA&editar=4210");
    const openDetail = vi.fn();

    renderHook(() => useProductDetailFromUrl({ openDetail }));

    await waitFor(() => expect(openDetail).toHaveBeenCalledWith(LINHA));
    expect(mocks.getProductById).toHaveBeenCalledWith(4210);
    // O `busca` sobrevive: é ele que deixa a listagem filtrada por baixo, para
    // quando a pessoa fechar o detalhe.
    expect(caminhoAtual()).toBe("/produtos/709/detalhes?busca=BACIA");
  });

  it("não faz nada em URL sem pedido de detalhe", async () => {
    const openDetail = vi.fn();

    const { result } = renderHook(() => useProductDetailFromUrl({ openDetail }));

    expect(result.current.resolvendo).toBe(false);
    expect(mocks.getProductsPage).not.toHaveBeenCalled();
    expect(openDetail).not.toHaveBeenCalled();
  });
});

describe("resolvendo", () => {
  it("começa true quando a URL pede detalhe, e some quando ele abre", async () => {
    // É o que impede a página de desenhar a listagem que ela já sabe que vai
    // substituir — o piscar que quem colava o link via.
    irPara("/produtos/709/detalhes");
    const openDetail = vi.fn();

    const { result } = renderHook(() => useProductDetailFromUrl({ openDetail }));

    expect(result.current.resolvendo).toBe(true);
    await waitFor(() => expect(openDetail).toHaveBeenCalled());
    expect(result.current.resolvendo).toBe(false);
  });

  it("some também quando o produto não existe", async () => {
    irPara("/produtos/709/detalhes");
    mocks.getProductsPage.mockResolvedValue({ data: [] });
    const openDetail = vi.fn();

    const { result } = renderHook(() => useProductDetailFromUrl({ openDetail }));

    await waitFor(() => expect(result.current.resolvendo).toBe(false));
    expect(openDetail).not.toHaveBeenCalled();
  });
});

describe("a busca não espera os catálogos", () => {
  it("dispara na montagem, com os sete catálogos ainda carregando", async () => {
    // Era uma ida ao servidor inteira de atraso: `getAllImages` e
    // `getAllProductImages` são as pesadas da lista e não têm nada a ver com
    // descobrir qual produto abrir. Só a montagem final depende delas.
    mocks.catalogosCarregando.valor = true;
    irPara("/produtos/709/detalhes");
    const openDetail = vi.fn();

    const { rerender } = renderHook(() => useProductDetailFromUrl({ openDetail }));

    expect(mocks.getProductsPage).toHaveBeenCalledTimes(1);
    expect(openDetail).not.toHaveBeenCalled();

    mocks.catalogosCarregando.valor = false;
    rerender();

    await waitFor(() => expect(openDetail).toHaveBeenCalledWith(LINHA));
    // Uma busca só: o produto já estava resolvido quando os catálogos chegaram.
    expect(mocks.getProductsPage).toHaveBeenCalledTimes(1);
  });
});

describe("quando o link não abre", () => {
  it("avisa e devolve a barra de endereços para a listagem", async () => {
    // Silenciar seria o pior desfecho: a pessoa clicou em "editar", a aba abriu
    // numa listagem e nada explica por que o detalhe não veio.
    irPara("/produtos/709/detalhes");
    mocks.getProductsPage.mockResolvedValue({ data: [] });
    const openDetail = vi.fn();

    renderHook(() => useProductDetailFromUrl({ openDetail }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.toast.mock.calls[0][0]).toMatchObject({ variant: "destructive" });
    expect(caminhoAtual()).toBe("/produtos/709/detalhes");
  });

  it("falha de rede desemboca no mesmo aviso", async () => {
    irPara("/produtos?editar=4210");
    mocks.getProductById.mockRejectedValue(new Error("500"));
    const openDetail = vi.fn();

    renderHook(() => useProductDetailFromUrl({ openDetail }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(openDetail).not.toHaveBeenCalled();
    expect(caminhoAtual()).toBe("/produtos");
  });
});
