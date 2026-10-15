import React from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CatalogItemDto,
  CatalogSearchItemDto,
  CatalogSelectionDto,
  RegisterCatalogPieceRequest,
} from "@workspace/api-client-react";
import type { PieceRequest, PieceResult } from "../../lib/buildPiece";
import { CUSTOM_STORAGE_KEY } from "../../lib/customSelection";

const mocks = vi.hoisted(() => ({
  getCatalogSelection: vi.fn(),
  registerCatalogPiece: vi.fn(),
  buildPiece: vi.fn(),
  shareFile: vi.fn(),
  downloadFile: vi.fn(),
  canShareFile: vi.fn(),
  toast: vi.fn(),
}));

// Só o que fala com a rede é dublado.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  getCatalogSelection: mocks.getCatalogSelection,
  registerCatalogPiece: mocks.registerCatalogPiece,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

// O montador desenha com WebAssembly e canvas, que o jsdom não tem (ver o teste do sorteio).
vi.mock("../../lib/buildPiece", () => ({
  buildPiece: mocks.buildPiece,
  preloadPiece: vi.fn(),
}));

vi.mock("../../lib/share", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/share")>()),
  shareFile: mocks.shareFile,
  downloadFile: mocks.downloadFile,
  canShareFile: mocks.canShareFile,
}));

const { useCustomCatalog } = await import("../useCustomCatalog");

/** Resultado da busca como a API manda: enum pelo nome, card só para quem pode entrar. */
function found(id: number, unavailable = "None"): CatalogSearchItemDto {
  return {
    productGroupId: id,
    name: `PRODUTO ${id}`,
    imageUrl: `/img/${id}.jpg`,
    unavailable,
    card:
      unavailable === "None"
        ? {
            productGroupId: id,
            name: `PRODUTO ${id}`,
            price: 10,
            hasVariations: false,
            categoryName: "Brinquedos",
            tags: [],
          }
        : undefined,
  };
}

function item(id: number, role = "Regular", price = 10): CatalogItemDto {
  return {
    role,
    product: {
      productGroupId: id,
      name: `PRODUTO ${id}`,
      price,
      hasVariations: false,
      categoryName: "Brinquedos",
      imageUrl: `https://bucket.exemplo/${id}.jpg`,
      tags: [],
    },
  };
}

/** A seleção que o servidor devolve: os ids pedidos, na ordem pedida. */
function selectionOf(
  ids: number[],
  unavailable: CatalogSelectionDto["unavailable"] = [],
): CatalogSelectionDto {
  const refused = new Set(unavailable.map((entry) => entry.productGroupId));
  return { items: ids.filter((id) => !refused.has(id)).map((id) => item(id)), unavailable };
}

const lastBuildRequest = () => mocks.buildPiece.mock.calls.at(-1)![0] as PieceRequest;

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const renderCustom = () => renderHook(() => useCustomCatalog(), { wrapper: createWrapper() });

/** Monta a lista com estes ids e o título. */
function fill(
  result: { current: ReturnType<typeof useCustomCatalog> },
  ids: number[],
  title = "Dia das Crianças",
) {
  for (const id of ids) act(() => void result.current.add(found(id)));
  act(() => result.current.setTitle(title));
}

describe("useCustomCatalog", () => {
  beforeEach(() => {
    localStorage.clear();
    URL.createObjectURL = vi.fn(() => "blob:banner");
    URL.revokeObjectURL = vi.fn();
    mocks.getCatalogSelection.mockImplementation(async (ids: number[]) => selectionOf(ids));
    mocks.buildPiece.mockImplementation(async (request: PieceRequest): Promise<PieceResult> => {
      const blob = new Blob(["jpeg"], { type: "image/jpeg" });
      return { blob, pages: [blob], products: request.candidates.slice(0, request.count) };
    });
    mocks.canShareFile.mockReturnValue(true);
    mocks.registerCatalogPiece.mockResolvedValue({ id: 1, alreadyRegistered: false });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ------------------------------------------------------------- a lista

  it("abre vazia no 9:16, sem título, e diz o que falta para gerar", () => {
    const { result } = renderCustom();

    expect(result.current.items).toEqual([]);
    expect(result.current.format.key).toBe("story");
    expect(result.current.capacity).toBe(9);
    expect(result.current.formats.map((format) => format.key)).toEqual(["story", "feed"]);
    expect(result.current.blocker).toMatch(/ao menos um produto/);
  });

  it("não aceita quem não pode entrar, quem já está na lista, nem passar do teto", () => {
    const { result } = renderCustom();

    act(() => void result.current.add(found(1)));
    act(() => void result.current.add(found(1)));
    act(() => void result.current.add(found(2, "OutOfStock")));
    expect(result.current.items.map((entry) => entry.productGroupId)).toEqual([1]);

    act(() => result.current.selectFormat("feed"));
    for (const id of [3, 4, 5, 6, 7, 8]) act(() => void result.current.add(found(id)));
    // O 4:5 leva 6: o sétimo não entra.
    expect(result.current.items.map((entry) => entry.productGroupId)).toEqual([1, 3, 4, 5, 6, 7]);
  });

  it("trocar para o 4:5 com mais de 6 não apaga ninguém: trava e diz quantos tirar", () => {
    const { result } = renderCustom();
    fill(result, [1, 2, 3, 4, 5, 6, 7, 8]);
    expect(result.current.blocker).toBeNull();

    act(() => result.current.selectFormat("feed"));

    expect(result.current.items).toHaveLength(8);
    expect(result.current.blocker).toBe("O Banner 4:5 leva até 6 produtos: tire 2 da lista.");
  });

  it("sem título não gera: o cabeçalho não tem sugestão", async () => {
    const { result } = renderCustom();
    fill(result, [1], "   ");

    expect(result.current.blocker).toMatch(/título/);
    await act(() => result.current.generate());
    expect(mocks.getCatalogSelection).not.toHaveBeenCalled();
  });

  it("sobe, desce, renomeia e tira da lista", () => {
    const { result } = renderCustom();
    fill(result, [1, 2, 3]);

    act(() => result.current.move(2, -1));
    act(() => result.current.rename(0, "Carrinho"));
    act(() => result.current.remove(1));

    expect(result.current.items.map((entry) => [entry.productGroupId, entry.printedName])).toEqual([
      [1, "Carrinho"],
      [2, ""],
    ]);
  });

  it("a lista sobrevive ao recarregar: fica guardada no aparelho", () => {
    const first = renderCustom();
    fill(first.result, [4, 2]);
    act(() => first.result.current.rename(1, "Boneca"));
    act(() => first.result.current.selectFormat("feed"));
    first.unmount();

    const { result } = renderCustom();

    expect(result.current.items.map((entry) => entry.productGroupId)).toEqual([4, 2]);
    expect(result.current.items[1].printedName).toBe("Boneca");
    expect(result.current.title).toBe("Dia das Crianças");
    expect(result.current.format.key).toBe("feed");
    expect(localStorage.getItem(CUSTOM_STORAGE_KEY)).toContain("Boneca");
  });

  // --------------------------------------------------------------- gerar

  it("gera pedindo o card de AGORA, na ordem da lista, sem reservas e com o nome escrito", async () => {
    const { result } = renderCustom();
    fill(result, [3, 1, 2]);
    act(() => result.current.rename(1, "Carrinho de controle"));

    await act(() => result.current.generate());

    expect(mocks.getCatalogSelection).toHaveBeenCalledWith([3, 1, 2]);
    const request = lastBuildRequest();
    expect(request.count).toBe(3);
    expect(request.title).toBe("Dia das Crianças");
    expect(request.format.key).toBe("story");
    expect(request.candidates.map((product) => [product.productGroupId, product.name])).toEqual([
      [3, "PRODUTO 3"],
      [1, "Carrinho de controle"],
      [2, "PRODUTO 2"],
    ]);
    expect(result.current.status).toBe("ready");
    expect(result.current.piece?.theme.label).toBe("Personalizado");
  });

  it("quem deixou de poder entrar barra a geração, fica marcado e sai da marca ao ser tirado", async () => {
    mocks.getCatalogSelection.mockImplementation(async (ids: number[]) =>
      selectionOf(ids, [{ productGroupId: 2, reason: "OutOfStock" }]),
    );
    const { result } = renderCustom();
    fill(result, [1, 2, 3]);

    await act(() => result.current.generate());

    expect(mocks.buildPiece).not.toHaveBeenCalled();
    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toBe(
      "Um produto não pode entrar no banner: PRODUTO 2 (sem saldo). Tire da lista para gerar.",
    );
    expect(result.current.unavailable).toEqual({ 2: 2 });

    act(() => result.current.remove(1));
    expect(result.current.unavailable).toEqual({});
  });

  it("foto que não carrega: o banner não sai com um a menos, e a lista fica", async () => {
    mocks.buildPiece.mockImplementationOnce(async (request: PieceRequest): Promise<PieceResult> => {
      const blob = new Blob(["jpeg"], { type: "image/jpeg" });
      return { blob, pages: [blob], products: request.candidates.filter((p) => p.productGroupId !== 2) };
    });
    const { result } = renderCustom();
    fill(result, [1, 2, 3]);

    await act(() => result.current.generate());

    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toMatch(/foto de PRODUTO 2 não carregou/);
    expect(result.current.piece).toBeNull();
    expect(result.current.items).toHaveLength(3);
  });

  it("compartilhar registra a peça com o tema Personalizado, sem departamento", async () => {
    mocks.shareFile.mockResolvedValue("shared");
    const { result } = renderCustom();
    fill(result, [2, 1]);
    act(() => result.current.selectFormat("feed"));
    await act(() => result.current.generate());

    await act(() => result.current.share());

    const record = mocks.registerCatalogPiece.mock.calls.at(-1)![0] as RegisterCatalogPieceRequest;
    expect(record).toMatchObject({
      theme: 6,
      departmentId: undefined,
      format: 2,
      title: "Dia das Crianças",
      items: [
        { productGroupId: 2, role: 4, price: 10 },
        { productGroupId: 1, role: 4, price: 10 },
      ],
    });
  });

  it("baixar também registra, e uma vez só por arquivo", async () => {
    const { result } = renderCustom();
    fill(result, [1]);
    await act(() => result.current.generate());

    act(() => result.current.download());
    act(() => result.current.download());

    expect(mocks.downloadFile).toHaveBeenCalledTimes(2);
    expect(mocks.registerCatalogPiece).toHaveBeenCalledTimes(1);
  });
});
