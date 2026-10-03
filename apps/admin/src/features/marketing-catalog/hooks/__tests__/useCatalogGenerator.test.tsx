import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StorefrontProductDto, UiPagedResult } from "@workspace/api-client-react";
import type { StoryBannerRequest, StoryBannerResult } from "../../lib/buildStoryBanner";

const mocks = vi.hoisted(() => ({
  getStorefrontProductsPage: vi.fn(),
  buildStoryBanner: vi.fn(),
  preloadStoryBanner: vi.fn(),
  shareFile: vi.fn(),
  downloadFile: vi.fn(),
  canShareFile: vi.fn(),
  toast: vi.fn(),
}));

// Só o que fala com a rede é dublado; a chave de cache vem do módulo real.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  getStorefrontProductsPage: mocks.getStorefrontProductsPage,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

// O montador desenha com WebAssembly e canvas, que o jsdom não tem. O molde em
// si é coberto por `StoryBanner.render.test.tsx`, no satori de verdade.
vi.mock("../../lib/buildStoryBanner", () => ({
  buildStoryBanner: mocks.buildStoryBanner,
  preloadStoryBanner: mocks.preloadStoryBanner,
}));

vi.mock("../../lib/share", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/share")>()),
  shareFile: mocks.shareFile,
  downloadFile: mocks.downloadFile,
  canShareFile: mocks.canShareFile,
}));

const { STORY_TITLE, useCatalogGenerator } = await import("../useCatalogGenerator");

function item(id: number, overrides: Partial<StorefrontProductDto> = {}): StorefrontProductDto {
  return {
    productGroupId: id,
    name: `PRODUTO ${id}`,
    price: 10,
    hasVariations: false,
    categoryName: "Cozinha",
    imageUrl: `https://bucket.exemplo/${id}.jpg`,
    tags: [],
    ...overrides,
  };
}

/**
 * A página como o api-client a entrega (`data`, e não o `items` do backend).
 * Sem cast de propósito: foi um cast aqui que escondeu o hook lendo `items`.
 */
function page(data: StorefrontProductDto[]): UiPagedResult<StorefrontProductDto> {
  return { data, page: 1, limit: 60, total: data.length, totalPages: 1 };
}

/** O montador devolve os primeiros `count` candidatos, como o de verdade. */
function buildFrom(request: StoryBannerRequest): StoryBannerResult {
  return {
    blob: new Blob(["jpeg"], { type: "image/jpeg" }),
    products: request.candidates.slice(0, request.count),
  };
}

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useCatalogGenerator", () => {
  let urlCounter = 0;

  beforeEach(() => {
    urlCounter = 0;
    URL.createObjectURL = vi.fn(() => `blob:banner-${++urlCounter}`);
    URL.revokeObjectURL = vi.fn();
    mocks.getStorefrontProductsPage.mockResolvedValue(
      page(Array.from({ length: 20 }, (_, i) => item(i + 1))),
    );
    mocks.buildStoryBanner.mockImplementation(async (request: StoryBannerRequest) => buildFrom(request));
    mocks.canShareFile.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("começa parado, sem banner", () => {
    const { result } = renderHook(() => useCatalogGenerator(), { wrapper: createWrapper() });

    expect(result.current.status).toBe("idle");
    expect(result.current.banner).toBeNull();
    expect(result.current.canShare).toBe(false);
  });

  it("ao abrir a tela já adianta o download do renderizador, das fontes e das artes", () => {
    renderHook(() => useCatalogGenerator(), { wrapper: createWrapper() });

    expect(mocks.preloadStoryBanner).toHaveBeenCalledTimes(1);
  });

  it("gera o banner com 9 produtos, pedindo candidatos de folga ao sorteio", async () => {
    const { result } = renderHook(() => useCatalogGenerator(), { wrapper: createWrapper() });

    await act(() => result.current.generate());

    expect(result.current.status).toBe("ready");
    expect(result.current.banner?.products).toHaveLength(9);
    expect(result.current.banner?.previewUrl).toBe("blob:banner-1");
    expect(result.current.banner?.file.type).toBe("image/jpeg");
    expect(result.current.banner?.file.name).toMatch(/^uaus-novidades-e-promocoes-\d{4}-\d{2}-\d{2}\.jpg$/);

    const request = mocks.buildStoryBanner.mock.calls[0][0] as StoryBannerRequest;
    expect(request.title).toBe(STORY_TITLE);
    expect(request.count).toBe(9);
    // Folga: a foto que falhar cede a vaga, e o banner não sai com buraco.
    expect(request.candidates).toHaveLength(13);
  });

  it("com muitas promoções no ar, o banner leva no máximo 3 ofertas em 9", async () => {
    const offers = [1, 2, 3, 4, 5, 6].map((id) =>
      item(id, { promotion: { type: "Flash", price: 7, referencePrice: 10 } }),
    );
    const others = Array.from({ length: 20 }, (_, i) => item(100 + i));
    mocks.getStorefrontProductsPage.mockResolvedValue(page([...offers, ...others]));
    const { result } = renderHook(() => useCatalogGenerator(), { wrapper: createWrapper() });

    await act(() => result.current.generate());

    expect(result.current.banner?.products.filter((product) => product.badge === "offer")).toHaveLength(3);
  });

  it("busca os produtos de novo a cada geração: o preço impresso é o de agora", async () => {
    const { result } = renderHook(() => useCatalogGenerator(), { wrapper: createWrapper() });

    await act(() => result.current.generate());
    await act(() => result.current.generate());

    expect(mocks.getStorefrontProductsPage).toHaveBeenCalledTimes(2);
  });

  it("sortear de novo solta a prévia anterior da memória", async () => {
    const { result } = renderHook(() => useCatalogGenerator(), { wrapper: createWrapper() });

    await act(() => result.current.generate());
    await act(() => result.current.generate());

    expect(result.current.banner?.previewUrl).toBe("blob:banner-2");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:banner-1");
  });

  it("vitrine sem produto com foto vira erro com a explicação, sem chamar o montador", async () => {
    mocks.getStorefrontProductsPage.mockResolvedValue(page([item(1, { imageUrl: undefined })]));
    const { result } = renderHook(() => useCatalogGenerator(), { wrapper: createWrapper() });

    await act(() => result.current.generate());

    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toMatch(/produto com foto/i);
    expect(mocks.buildStoryBanner).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });

  it("falha do montador vira erro, e o banner anterior continua na tela", async () => {
    const { result } = renderHook(() => useCatalogGenerator(), { wrapper: createWrapper() });
    await act(() => result.current.generate());

    mocks.buildStoryBanner.mockRejectedValueOnce(new Error("Nenhuma foto de produto pôde ser carregada."));
    await act(() => result.current.generate());

    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toBe("Nenhuma foto de produto pôde ser carregada.");
    expect(result.current.banner?.previewUrl).toBe("blob:banner-1");
  });

  it("dois toques seguidos: vale a última geração, e a atrasada não a cobre", async () => {
    const pending: Array<(value: StoryBannerResult) => void> = [];
    mocks.buildStoryBanner.mockImplementation(
      () => new Promise<StoryBannerResult>((resolve) => pending.push(resolve)),
    );
    const { result } = renderHook(() => useCatalogGenerator(), { wrapper: createWrapper() });

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.generate();
    });
    await waitFor(() => expect(pending).toHaveLength(1));
    act(() => {
      second = result.current.generate();
    });
    await waitFor(() => expect(pending).toHaveLength(2));

    // A segunda responde antes; a primeira chega depois, atrasada.
    await act(async () => {
      pending[1]({ blob: new Blob(["b"]), products: [{ ...catalogProduct(2) }] });
      await second;
    });
    await act(async () => {
      pending[0]({ blob: new Blob(["a"]), products: [{ ...catalogProduct(1) }] });
      await first;
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.banner?.products[0].productGroupId).toBe(2);
  });

  it("sair da tela no meio da geração não deixa prévia órfã na memória", async () => {
    let finish!: (value: StoryBannerResult) => void;
    mocks.buildStoryBanner.mockImplementation(
      () => new Promise<StoryBannerResult>((resolve) => (finish = resolve)),
    );
    const { result, unmount } = renderHook(() => useCatalogGenerator(), { wrapper: createWrapper() });

    let running!: Promise<void>;
    act(() => {
      running = result.current.generate();
    });
    await waitFor(() => expect(mocks.buildStoryBanner).toHaveBeenCalledTimes(1));
    unmount();

    finish({ blob: new Blob(["a"]), products: [catalogProduct(1)] });
    await running;

    // A URL só é criada para uma tela que ainda existe: depois do unmount não
    // há efeito de limpeza que a solte.
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("compartilhar entrega o arquivo à folha do aparelho, sem aviso quando dá certo", async () => {
    mocks.shareFile.mockResolvedValue("shared");
    const { result } = renderHook(() => useCatalogGenerator(), { wrapper: createWrapper() });
    await act(() => result.current.generate());

    await act(() => result.current.share());

    expect(mocks.shareFile).toHaveBeenCalledWith(result.current.banner?.file);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("quando o compartilhar cai no download, avisa onde o arquivo foi parar", async () => {
    mocks.shareFile.mockResolvedValue("downloaded");
    const { result } = renderHook(() => useCatalogGenerator(), { wrapper: createWrapper() });
    await act(() => result.current.generate());

    await act(() => result.current.share());

    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Banner salvo" }));
  });

  it("baixar e compartilhar sem banner não fazem nada", async () => {
    const { result } = renderHook(() => useCatalogGenerator(), { wrapper: createWrapper() });

    await act(() => result.current.share());
    act(() => result.current.download());

    expect(mocks.shareFile).not.toHaveBeenCalled();
    expect(mocks.downloadFile).not.toHaveBeenCalled();
  });

  it("ao sair da tela solta a prévia", async () => {
    const { result, unmount } = renderHook(() => useCatalogGenerator(), { wrapper: createWrapper() });
    await act(() => result.current.generate());

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:banner-1");
  });
});

function catalogProduct(id: number) {
  return {
    productGroupId: id,
    name: `PRODUTO ${id}`,
    price: 10,
    hasPriceRange: false,
    imageUrl: `https://bucket.exemplo/${id}.jpg`,
  };
}
