import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CatalogDrawDto,
  CatalogDrawRequest,
  CatalogItemDto,
  CatalogThemeDto,
  RegisterCatalogPieceRequest,
} from "@workspace/api-client-react";
import type { PieceRequest, PieceResult } from "../../lib/buildPiece";

const mocks = vi.hoisted(() => ({
  getCatalogThemes: vi.fn(),
  drawCatalog: vi.fn(),
  registerCatalogPiece: vi.fn(),
  buildPiece: vi.fn(),
  preloadPiece: vi.fn(),
  shareFile: vi.fn(),
  downloadFile: vi.fn(),
  canShareFile: vi.fn(),
  toast: vi.fn(),
}));

// Só o que fala com a rede é dublado. `useGetCatalogThemes` e a chave de cache
// são os de verdade, rodando sobre a função de leitura dublada.
vi.mock("@workspace/api-client-react", async (importOriginal) => {
  const original = await importOriginal<typeof import("@workspace/api-client-react")>();
  const { useQuery } = await import("@tanstack/react-query");
  return {
    ...original,
    drawCatalog: mocks.drawCatalog,
    registerCatalogPiece: mocks.registerCatalogPiece,
    useGetCatalogThemes: () =>
      useQuery({ queryKey: [...original.getGetCatalogThemesQueryKey()], queryFn: mocks.getCatalogThemes }),
  };
});

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

// O montador desenha com WebAssembly e canvas, que o jsdom não tem. O molde em
// si é coberto por `CatalogPiece.render.test.tsx`, no satori de verdade, e a
// montagem (páginas, links, foto pequena) por `buildPiece.test.ts`.
vi.mock("../../lib/buildPiece", () => ({
  buildPiece: mocks.buildPiece,
  preloadPiece: mocks.preloadPiece,
}));

vi.mock("../../lib/share", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/share")>()),
  shareFile: mocks.shareFile,
  downloadFile: mocks.downloadFile,
  canShareFile: mocks.canShareFile,
}));

const { useCatalogGenerator } = await import("../useCatalogGenerator");

const THEMES: CatalogThemeDto[] = [
  { theme: "General", products: 40, productsWithLargePhoto: 30 },
  { theme: "NewsAndOffers", products: 12, productsWithLargePhoto: 12 },
  { theme: "BestSellers", products: 0, productsWithLargePhoto: 0 },
  { theme: "Finds", products: 20, productsWithLargePhoto: 0 },
  {
    theme: "Department",
    departmentId: 7,
    departmentName: "Brinquedos",
    products: 15,
    productsWithLargePhoto: 9,
  },
];

/** Item sorteado como a API manda: enum pelo nome, nulo omitido. */
function item(id: number, role = "Regular"): CatalogItemDto {
  return {
    role,
    product: {
      productGroupId: id,
      name: `PRODUTO ${id}`,
      price: 10,
      hasVariations: false,
      categoryName: "Cozinha",
      imageUrl: `https://bucket.exemplo/${id}.jpg`,
      tags: [],
    },
  };
}

function drawOf(items: CatalogItemDto[], reserves: CatalogItemDto[] = []): CatalogDrawDto {
  return { seed: 7, items, reserves };
}

/** O montador devolve os primeiros `count` candidatos, como o de verdade: uma página a cada 6 no PDF. */
function buildFrom(request: PieceRequest): PieceResult {
  const products = request.candidates.slice(0, request.count);
  const pages = request.format.extension === "pdf" ? Math.ceil(products.length / 6) : 1;
  const jpegs = Array.from({ length: pages }, () => new Blob(["jpeg"], { type: "image/jpeg" }));

  return {
    blob: request.format.extension === "pdf" ? new Blob(["pdf"], { type: "application/pdf" }) : jpegs[0],
    pages: jpegs,
    products,
  };
}

/** O resultado de um banner com estes produtos. */
function bannerOf(products: PieceResult["products"], content = "jpeg"): PieceResult {
  const blob = new Blob([content], { type: "image/jpeg" });
  return { blob, pages: [blob], products };
}

const lastDrawRequest = () => mocks.drawCatalog.mock.calls.at(-1)![0] as CatalogDrawRequest;
const lastBuildRequest = () => mocks.buildPiece.mock.calls.at(-1)![0] as PieceRequest;

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

/** Monta o hook e espera a lista de temas chegar. */
async function renderGenerator() {
  const rendered = renderHook(() => useCatalogGenerator(), { wrapper: createWrapper() });
  await waitFor(() => expect(rendered.result.current.themes.length).toBeGreaterThan(0));
  return rendered;
}

describe("useCatalogGenerator", () => {
  let urlCounter = 0;

  beforeEach(() => {
    urlCounter = 0;
    URL.createObjectURL = vi.fn(() => `blob:banner-${++urlCounter}`);
    URL.revokeObjectURL = vi.fn();
    mocks.getCatalogThemes.mockResolvedValue(THEMES);
    mocks.drawCatalog.mockResolvedValue(
      drawOf(
        [1, 2, 3, 4, 5, 6, 7, 8, 9].map((id) => item(id, id <= 3 ? "New" : "Slow")),
        [item(20), item(21)],
      ),
    );
    mocks.buildPiece.mockImplementation(async (request: PieceRequest) => buildFrom(request));
    mocks.canShareFile.mockReturnValue(true);
    mocks.registerCatalogPiece.mockResolvedValue({ id: 1, alreadyRegistered: false });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ------------------------------------------------------- tema e título

  it("abre no tema geral, com o título sugerido por ele, e adianta o renderizador", async () => {
    const { result } = await renderGenerator();

    expect(result.current.theme?.label).toBe("Geral (mistura inteligente)");
    expect(result.current.title).toBe("Destaques da loja");
    expect(result.current.status).toBe("idle");
    expect(result.current.piece).toBeNull();
    expect(result.current.format.key).toBe("story");
    expect(mocks.preloadPiece).toHaveBeenCalledTimes(1);
  });

  it("trocar de tema troca o título sugerido e descarta o que foi digitado", async () => {
    const { result } = await renderGenerator();

    act(() => result.current.setTitle("Meu título"));
    expect(result.current.title).toBe("Meu título");

    act(() => result.current.selectTheme("5:7"));

    expect(result.current.theme?.label).toBe("Brinquedos");
    expect(result.current.title).toBe("Brinquedos");
  });

  it("falha ao carregar os temas é avisada, sem tema selecionado", async () => {
    mocks.getCatalogThemes.mockRejectedValue(new Error("fora do ar"));
    const { result } = renderHook(() => useCatalogGenerator(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.themesFailed).toBe(true));
    expect(result.current.theme).toBeUndefined();

    await act(() => result.current.generate());
    expect(mocks.drawCatalog).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------- gerar

  it("gera pedindo ao servidor 9 produtos e as reservas do tema escolhido", async () => {
    const { result } = await renderGenerator();
    act(() => result.current.selectTheme("5:7"));

    await act(() => result.current.generate());

    expect(lastDrawRequest()).toEqual({ theme: 5, departmentId: 7, count: 9, spare: 4 });
    expect(result.current.status).toBe("ready");
    expect(result.current.piece?.products).toHaveLength(9);
    expect(result.current.piece?.title).toBe("Brinquedos");
    expect(result.current.piece?.file.name).toMatch(/^uaus-brinquedos-\d{4}-\d{2}-\d{2}\.jpg$/);
  });

  it("as reservas vão ao montador depois dos 9, para a foto que falhar ceder a vaga", async () => {
    const { result } = await renderGenerator();

    await act(() => result.current.generate());

    const request = lastBuildRequest();
    expect(request.count).toBe(9);
    expect(request.candidates.map((product) => product.productGroupId)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 20, 21,
    ]);
  });

  it("o título digitado vai impresso, sem espaço sobrando", async () => {
    const { result } = await renderGenerator();
    act(() => result.current.setTitle("  Utilidades   de cozinha "));

    await act(() => result.current.generate());

    expect(lastBuildRequest().title).toBe("Utilidades de cozinha");
    expect(result.current.piece?.title).toBe("Utilidades de cozinha");
  });

  it("título apagado volta ao sugerido pelo tema: a peça não sai sem cabeçalho", async () => {
    const { result } = await renderGenerator();
    act(() => result.current.setTitle("   "));

    await act(() => result.current.generate());

    expect(lastBuildRequest().title).toBe("Destaques da loja");
  });

  it("sorteia de novo a cada geração: nada de cache no preço impresso", async () => {
    const { result } = await renderGenerator();

    await act(() => result.current.generate());
    await act(() => result.current.generate());

    expect(mocks.drawCatalog).toHaveBeenCalledTimes(2);
    expect(result.current.piece?.previewUrls).toEqual(["blob:banner-2"]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:banner-1");
  });

  it("tema sem produto com foto vira erro com a explicação, sem chamar o montador", async () => {
    mocks.drawCatalog.mockResolvedValue(drawOf([]));
    const { result } = await renderGenerator();

    await act(() => result.current.generate());

    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toMatch(/não tem produto/i);
    expect(mocks.buildPiece).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });

  it("falha do sorteio vira erro, e o banner anterior continua na tela", async () => {
    const { result } = await renderGenerator();
    await act(() => result.current.generate());

    mocks.drawCatalog.mockRejectedValueOnce(new Error("Sessão expirada."));
    await act(() => result.current.generate());

    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toBe("Sessão expirada.");
    expect(result.current.piece?.previewUrls).toEqual(["blob:banner-1"]);
  });

  it("dois toques seguidos: vale a última geração, e a atrasada não a cobre", async () => {
    const pending: Array<(value: PieceResult) => void> = [];
    mocks.buildPiece.mockImplementation(() => new Promise<PieceResult>((resolve) => pending.push(resolve)));
    const { result } = await renderGenerator();

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
      pending[1](bannerOf([catalogProduct(2)], "b"));
      await second;
    });
    await act(async () => {
      pending[0](bannerOf([catalogProduct(1)], "a"));
      await first;
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.piece?.products[0].productGroupId).toBe(2);
  });

  it("sair da tela no meio da geração não deixa prévia órfã na memória", async () => {
    let finish!: (value: PieceResult) => void;
    mocks.buildPiece.mockImplementation(() => new Promise<PieceResult>((resolve) => (finish = resolve)));
    const { result, unmount } = await renderGenerator();

    let running!: Promise<void>;
    act(() => {
      running = result.current.generate();
    });
    await waitFor(() => expect(mocks.buildPiece).toHaveBeenCalledTimes(1));
    unmount();

    finish(bannerOf([catalogProduct(1)], "a"));
    await running;

    // A URL só é criada para uma tela que ainda existe: depois do unmount não
    // há efeito de limpeza que a solte.
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------- formatos

  it("o banner 4:5 pede 6 produtos e sai em JPEG", async () => {
    const { result } = await renderGenerator();
    act(() => result.current.selectFormat("feed"));

    await act(() => result.current.generate());

    expect(lastDrawRequest()).toMatchObject({ count: 6, spare: 4 });
    expect(lastDrawRequest().largePhotosOnly).toBeUndefined();
    expect(lastBuildRequest().format.key).toBe("feed");
    expect(result.current.piece?.file.name).toMatch(/\.jpg$/);
  });

  it("o catálogo em PDF pede 24 produtos só de foto grande, com 8 reservas", async () => {
    mocks.drawCatalog.mockResolvedValue(
      drawOf(
        Array.from({ length: 24 }, (_, index) => item(index + 1)),
        [item(90), item(91)],
      ),
    );
    const { result } = await renderGenerator();
    act(() => result.current.selectFormat("pdf"));

    await act(() => result.current.generate());

    expect(lastDrawRequest()).toEqual({
      theme: 1,
      departmentId: undefined,
      count: 24,
      spare: 8,
      largePhotosOnly: true,
    });
    expect(result.current.piece?.products).toHaveLength(24);
    expect(result.current.piece?.format.key).toBe("pdf");
    expect(result.current.piece?.file.name).toMatch(/^uaus-destaques-da-loja-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(result.current.piece?.file.type).toBe("application/pdf");
    // Uma URL de prévia por página: 24 produtos são 4 páginas.
    expect(result.current.piece?.previewUrls).toHaveLength(4);
  });

  it("gerar outra peça solta TODAS as páginas da prévia anterior", async () => {
    mocks.drawCatalog.mockResolvedValue(drawOf(Array.from({ length: 12 }, (_, index) => item(index + 1))));
    const { result } = await renderGenerator();
    act(() => result.current.selectFormat("pdf"));
    await act(() => result.current.generate());
    expect(result.current.piece?.previewUrls).toEqual(["blob:banner-1", "blob:banner-2"]);

    await act(() => result.current.generate());

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:banner-1");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:banner-2");
  });

  it("trocar um produto do PDF continua exigindo foto grande e redesenha em PDF", async () => {
    mocks.drawCatalog.mockResolvedValue(drawOf(Array.from({ length: 12 }, (_, index) => item(index + 1))));
    const { result } = await renderGenerator();
    act(() => result.current.selectFormat("pdf"));
    await act(() => result.current.generate());
    // A pessoa já olha para outro formato; a peça da tela continua sendo o PDF.
    act(() => result.current.selectFormat("story"));
    mocks.drawCatalog.mockResolvedValueOnce(drawOf([item(50)]));

    await act(() => result.current.swap(8));

    expect(lastDrawRequest()).toMatchObject({ count: 1, largePhotosOnly: true });
    expect(lastBuildRequest().format.key).toBe("pdf");
    expect(result.current.piece?.products.map((product) => product.productGroupId)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 50, 9, 10, 11, 12,
    ]);
  });

  it("com outro formato selecionado, o botão volta a ser 'Gerar' e o aviso de título não acende", async () => {
    const { result } = await renderGenerator();
    await act(() => result.current.generate());
    expect(result.current.pieceMatchesFormat).toBe(true);

    act(() => result.current.selectFormat("pdf"));
    act(() => result.current.setTitle("Outro título"));

    expect(result.current.pieceMatchesFormat).toBe(false);
    expect(result.current.titleChanged).toBe(false);
  });

  it("mostra em que página o desenho está, e limpa ao terminar", async () => {
    let finish!: (value: PieceResult) => void;
    mocks.buildPiece.mockImplementation(
      (request: PieceRequest) =>
        new Promise<PieceResult>((resolve) => {
          request.onProgress?.({ page: 2, pages: 4 });
          finish = () => resolve(buildFrom(request));
        }),
    );
    const { result } = await renderGenerator();
    act(() => result.current.selectFormat("pdf"));

    let running!: Promise<void>;
    act(() => {
      running = result.current.generate();
    });
    await waitFor(() => expect(result.current.progress).toEqual({ page: 2, pages: 4 }));

    await act(async () => {
      finish(bannerOf([]));
      await running;
    });

    expect(result.current.progress).toBeNull();
    expect(result.current.status).toBe("ready");
  });

  it("o aviso de erro e o de download falam 'catálogo' quando a peça é o PDF", async () => {
    mocks.drawCatalog.mockResolvedValue(drawOf([]));
    const { result } = await renderGenerator();
    act(() => result.current.selectFormat("pdf"));

    await act(() => result.current.generate());

    expect(result.current.errorMessage).toMatch(/montar o catálogo/);
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Não foi possível gerar o catálogo" }),
    );
  });

  // ----------------------------------------------------- trocar um produto

  it("trocar pede UM produto do mesmo papel, sem repetir quem está na peça", async () => {
    const { result } = await renderGenerator();
    await act(() => result.current.generate());
    mocks.drawCatalog.mockResolvedValueOnce(drawOf([item(50, "New")]));

    await act(() => result.current.swap(2));

    expect(lastDrawRequest()).toEqual({
      theme: 1,
      departmentId: undefined,
      count: 1,
      role: 2,
      excludeGroupIds: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    });
    // O novo entra no LUGAR do antigo; os outros oito não se mexem.
    expect(result.current.piece?.products.map((product) => product.productGroupId)).toEqual([
      1, 50, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(lastBuildRequest().count).toBe(9);
  });

  it("quem já foi trocado não volta na troca seguinte", async () => {
    const { result } = await renderGenerator();
    await act(() => result.current.generate());
    mocks.drawCatalog.mockResolvedValueOnce(drawOf([item(50, "New")]));
    await act(() => result.current.swap(2));
    mocks.drawCatalog.mockResolvedValueOnce(drawOf([item(51, "New")]));

    await act(() => result.current.swap(50));

    expect(lastDrawRequest().excludeGroupIds).toEqual([1, 50, 3, 4, 5, 6, 7, 8, 9, 2]);
  });

  it("um sorteio novo zera a lista de trocados", async () => {
    const { result } = await renderGenerator();
    await act(() => result.current.generate());
    mocks.drawCatalog.mockResolvedValueOnce(drawOf([item(50, "New")]));
    await act(() => result.current.swap(2));

    await act(() => result.current.generate());
    mocks.drawCatalog.mockResolvedValueOnce(drawOf([item(60, "New")]));
    await act(() => result.current.swap(1));

    expect(lastDrawRequest().excludeGroupIds).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("sem outro produto para pôr no lugar, avisa e mantém a peça", async () => {
    const { result } = await renderGenerator();
    await act(() => result.current.generate());
    mocks.drawCatalog.mockResolvedValueOnce(drawOf([]));

    await act(() => result.current.swap(2));

    expect(result.current.status).toBe("ready");
    expect(result.current.piece?.previewUrls).toEqual(["blob:banner-1"]);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Sem outro produto" }));
  });

  it("foto do substituto que não carrega: a peça continua com os 9, e ele não é sorteado de novo", async () => {
    const { result } = await renderGenerator();
    await act(() => result.current.generate());
    mocks.drawCatalog.mockResolvedValueOnce(drawOf([item(50, "New")]));
    // O montador descarta o produto cuja foto falhou: devolve 8 em vez de 9.
    mocks.buildPiece.mockImplementationOnce(async (request: PieceRequest) =>
      bannerOf(request.candidates.filter((product) => product.productGroupId !== 50)),
    );

    await act(() => result.current.swap(2));

    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toMatch(/foto do produto sorteado não carregou/i);
    // A peça que está na tela é a de antes da troca, inteira.
    expect(result.current.piece?.previewUrls).toEqual(["blob:banner-1"]);
    expect(result.current.piece?.products.map((product) => product.productGroupId)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);

    // Na tentativa seguinte, o de foto quebrada está na lista de quem não pode sair
    // — e o 2, que NÃO foi trocado, continua só como item da peça.
    mocks.drawCatalog.mockResolvedValueOnce(drawOf([item(51, "New")]));
    await act(() => result.current.swap(2));

    expect(lastDrawRequest().excludeGroupIds).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 50]);
    expect(result.current.piece?.products.map((product) => product.productGroupId)).toEqual([
      1, 51, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  it("a troca usa o tema da PEÇA, mesmo com outro tema já selecionado no campo", async () => {
    const { result } = await renderGenerator();
    await act(() => result.current.generate());
    act(() => result.current.selectTheme("5:7"));
    mocks.drawCatalog.mockResolvedValueOnce(drawOf([item(50, "New")]));

    await act(() => result.current.swap(2));

    expect(lastDrawRequest().theme).toBe(1);
    expect(result.current.piece?.title).toBe("Destaques da loja");
  });

  it("trocar produto que não está na peça não faz nada", async () => {
    const { result } = await renderGenerator();
    await act(() => result.current.generate());

    await act(() => result.current.swap(999));

    expect(mocks.drawCatalog).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------------ atualizar título

  it("título mexido depois de gerar acende o aviso e redesenha a MESMA peça", async () => {
    const { result } = await renderGenerator();
    await act(() => result.current.generate());
    expect(result.current.titleChanged).toBe(false);

    act(() => result.current.setTitle("Semana das crianças"));
    expect(result.current.titleChanged).toBe(true);

    await act(() => result.current.applyTitle());

    expect(mocks.drawCatalog).toHaveBeenCalledTimes(1);
    expect(result.current.piece?.title).toBe("Semana das crianças");
    expect(result.current.piece?.products).toHaveLength(9);
    expect(result.current.titleChanged).toBe(false);
  });

  it("com outro tema selecionado o aviso de título não acende: o campo é do próximo sorteio", async () => {
    const { result } = await renderGenerator();
    await act(() => result.current.generate());

    act(() => result.current.selectTheme("5:7"));

    expect(result.current.titleChanged).toBe(false);
  });

  // ------------------------------------------------- compartilhar e baixar

  it("compartilhar entrega o arquivo à folha do aparelho, sem aviso quando dá certo", async () => {
    mocks.shareFile.mockResolvedValue("shared");
    const { result } = await renderGenerator();
    await act(() => result.current.generate());

    await act(() => result.current.share());

    expect(mocks.shareFile).toHaveBeenCalledWith(result.current.piece?.file);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("quando o compartilhar cai no download, avisa onde o arquivo foi parar", async () => {
    mocks.shareFile.mockResolvedValue("downloaded");
    const { result } = await renderGenerator();
    await act(() => result.current.generate());

    await act(() => result.current.share());

    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Banner salvo" }));
  });

  it("baixar, compartilhar, trocar e atualizar título sem banner não fazem nada", async () => {
    const { result } = await renderGenerator();

    await act(() => result.current.share());
    await act(() => result.current.swap(1));
    await act(() => result.current.applyTitle());
    act(() => result.current.download());

    expect(mocks.shareFile).not.toHaveBeenCalled();
    expect(mocks.downloadFile).not.toHaveBeenCalled();
    expect(mocks.drawCatalog).not.toHaveBeenCalled();
    expect(result.current.canShare).toBe(false);
  });

  // ------------------------------------------------ registro no histórico

  const lastRecord = () => mocks.registerCatalogPiece.mock.calls.at(-1)![0] as RegisterCatalogPieceRequest;

  it("peça gerada e não compartilhada NÃO vai para o histórico", async () => {
    const { result } = await renderGenerator();

    await act(() => result.current.generate());
    await act(() => result.current.generate());

    expect(mocks.registerCatalogPiece).not.toHaveBeenCalled();
  });

  it("compartilhar registra a peça: tema, formato, título e os produtos na ordem, com o preço impresso", async () => {
    mocks.shareFile.mockResolvedValue("shared");
    const { result } = await renderGenerator();
    act(() => result.current.selectTheme("5:7"));
    await act(() => result.current.generate());

    await act(() => result.current.share());

    expect(mocks.registerCatalogPiece).toHaveBeenCalledTimes(1);
    expect(lastRecord()).toEqual({
      clientKey: result.current.piece?.key,
      theme: 5,
      departmentId: 7,
      format: 1,
      title: "Brinquedos",
      items: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((id) => ({
        productGroupId: id,
        // 1 a 3 saíram como novidade (2); os demais, como pouca saída (5).
        role: id <= 3 ? 2 : 5,
        price: 10,
      })),
    });
    expect(lastRecord().clientKey.length).toBeGreaterThan(10);
  });

  it("compartilhar e depois baixar o MESMO arquivo é uma divulgação só", async () => {
    mocks.shareFile.mockResolvedValue("shared");
    const { result } = await renderGenerator();
    await act(() => result.current.generate());

    await act(() => result.current.share());
    act(() => result.current.download());
    await act(() => result.current.share());

    expect(mocks.registerCatalogPiece).toHaveBeenCalledTimes(1);
  });

  it("baixar também registra — o arquivo saiu do sistema", async () => {
    const { result } = await renderGenerator();
    act(() => result.current.selectFormat("pdf"));
    await act(() => result.current.generate());

    act(() => result.current.download());

    expect(mocks.registerCatalogPiece).toHaveBeenCalledTimes(1);
    expect(lastRecord().format).toBe(3);
  });

  it("fechar a folha de compartilhamento sem escolher não registra: a peça não saiu", async () => {
    mocks.shareFile.mockResolvedValue("cancelled");
    const { result } = await renderGenerator();
    await act(() => result.current.generate());

    await act(() => result.current.share());

    expect(mocks.registerCatalogPiece).not.toHaveBeenCalled();
  });

  it("trocar um produto é outro arquivo: compartilhado de novo, registra de novo com outra chave", async () => {
    mocks.shareFile.mockResolvedValue("shared");
    const { result } = await renderGenerator();
    await act(() => result.current.generate());
    await act(() => result.current.share());
    const firstKey = lastRecord().clientKey;

    mocks.drawCatalog.mockResolvedValueOnce(drawOf([item(50, "New")]));
    await act(() => result.current.swap(2));
    await act(() => result.current.share());

    expect(mocks.registerCatalogPiece).toHaveBeenCalledTimes(2);
    expect(lastRecord().clientKey).not.toBe(firstKey);
    expect(lastRecord().items.map((entry) => entry.productGroupId)).toEqual([1, 50, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("falha no registro não incomoda quem compartilhou, e a tentativa seguinte registra", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.shareFile.mockResolvedValue("shared");
    mocks.registerCatalogPiece.mockRejectedValueOnce(new Error("sem rede"));
    const { result } = await renderGenerator();
    await act(() => result.current.generate());

    await act(() => result.current.share());

    expect(result.current.status).toBe("ready");
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();

    // A chave voltou a ficar livre: baixar a mesma peça tenta de novo.
    await act(async () => result.current.download());
    expect(mocks.registerCatalogPiece).toHaveBeenCalledTimes(2);
    expect(mocks.registerCatalogPiece.mock.calls[1][0].clientKey).toBe(
      mocks.registerCatalogPiece.mock.calls[0][0].clientKey,
    );

    warn.mockRestore();
  });

  it("ao sair da tela solta a prévia", async () => {
    const { result, unmount } = await renderGenerator();
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
    role: "regular" as const,
  };
}
