import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CATALOG_FORMAT,
  CATALOG_ROLE,
  CATALOG_THEME,
  type CatalogSpotlightDto,
  type RegisterCatalogPieceRequest,
} from "@workspace/api-client-react";
import type { SpotlightRequest } from "../../lib/buildSpotlight";

const mocks = vi.hoisted(() => ({
  getCatalogSpotlight: vi.fn(),
  registerCatalogPiece: vi.fn(),
  buildSpotlight: vi.fn(),
  downloadFile: vi.fn(),
  canShareFile: vi.fn(),
  toast: vi.fn(),
}));

// Só o que fala com a rede é dublado.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  getCatalogSpotlight: mocks.getCatalogSpotlight,
  registerCatalogPiece: mocks.registerCatalogPiece,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

// O montador desenha com WebAssembly e canvas, que o jsdom não tem.
vi.mock("../../lib/buildSpotlight", () => ({ buildSpotlight: mocks.buildSpotlight }));

vi.mock("../../lib/share", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/share")>()),
  downloadFile: mocks.downloadFile,
  canShareFile: mocks.canShareFile,
}));

const { useSpotlightBanner, SPOTLIGHT_FORMAT_KEY } = await import("../useSpotlightBanner");

/** O produto como o servidor responde: antigo, sem promoção, com foto. */
function spotlight(overrides: Partial<CatalogSpotlightDto> = {}): CatalogSpotlightDto {
  return {
    productGroupId: 7,
    name: "GARRAFA TÉRMICA",
    unavailable: "None",
    card: {
      productGroupId: 7,
      name: "GARRAFA TÉRMICA",
      price: 24.9,
      hasVariations: false,
      categoryName: "Cozinha",
      imageUrl: "/img/7.jpg",
      tags: [],
    },
    daysInStore: 200,
    isNew: false,
    isRestock: false,
    ...overrides,
  };
}

const TARGET = { productGroupId: 7, name: "GARRAFA TÉRMICA" };

const lastBuild = () => mocks.buildSpotlight.mock.calls.at(-1)![0] as SpotlightRequest;

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const renderSpotlight = () => renderHook(() => useSpotlightBanner(), { wrapper: createWrapper() });

describe("useSpotlightBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    URL.createObjectURL = vi.fn(() => "blob:banner");
    URL.revokeObjectURL = vi.fn();
    mocks.getCatalogSpotlight.mockResolvedValue(spotlight());
    mocks.registerCatalogPiece.mockResolvedValue({ id: 1, alreadyRegistered: false });
    mocks.canShareFile.mockReturnValue(false);
    mocks.buildSpotlight.mockResolvedValue({
      blob: new Blob(["JPEG"], { type: "image/jpeg" }),
      photo: { width: 1080, height: 1080 },
    });
  });

  afterEach(() => vi.clearAllMocks());

  it("o menu abre a janela e já gera, no tipo escolhido e com o título dele", async () => {
    const { result } = renderSpotlight();

    act(() => result.current.openFor(TARGET, "new"));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.open).toBe(true);
    expect(mocks.getCatalogSpotlight).toHaveBeenCalledWith(7);
    expect(lastBuild()).toMatchObject({
      format: "story",
      kind: "new",
      title: "Chegou novidade!",
      product: { productGroupId: 7, role: "new", price: 24.9 },
    });
    expect(result.current.piece?.file.name).toMatch(
      /^uaus-chegou-novidade-garrafa-termica-\d{4}-\d{2}-\d{2}\.jpg$/,
    );
  });

  it("a peça que sai vai ao histórico com o tema Destaque e o tipo no papel", async () => {
    mocks.getCatalogSpotlight.mockResolvedValue(spotlight({ isRestock: true }));
    const { result } = renderSpotlight();

    act(() => result.current.openFor(TARGET, "restock"));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.download());

    await waitFor(() => expect(mocks.registerCatalogPiece).toHaveBeenCalledTimes(1));
    const record = mocks.registerCatalogPiece.mock.calls[0][0] as RegisterCatalogPieceRequest;
    expect(record).toMatchObject({
      theme: CATALOG_THEME.Spotlight,
      format: CATALOG_FORMAT.Story,
      title: "Reposição",
      items: [{ productGroupId: 7, role: CATALOG_ROLE.Restock, price: 24.9 }],
    });
  });

  it("promoção que acabou entre a listagem e o toque: não gera, avisa e trava o promocional", async () => {
    const { result } = renderSpotlight();

    act(() => result.current.openFor(TARGET, "offer"));
    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.errorMessage).toMatch(/não está valendo/);
    expect(mocks.buildSpotlight).not.toHaveBeenCalled();
    expect(result.current.kinds.offer.enabled).toBe(false);
  });

  it("produto que não pode entrar diz o motivo em vez de gerar", async () => {
    mocks.getCatalogSpotlight.mockResolvedValue(spotlight({ unavailable: "NoPhoto", card: null }));
    const { result } = renderSpotlight();

    act(() => result.current.openFor(TARGET, "new"));
    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.errorMessage).toBe("GARRAFA TÉRMICA não pode sair no banner: sem foto.");
  });

  it("a aba Destaque escolhe o produto e sugere o tipo do servidor, sem gerar", async () => {
    mocks.getCatalogSpotlight.mockResolvedValue(spotlight({ isRestock: true }));
    const { result } = renderSpotlight();

    act(() => result.current.select(TARGET));
    await waitFor(() => expect(result.current.kind).toBe("restock"));

    expect(result.current.title).toBe("Reposição");
    expect(result.current.kinds.restock.suggested).toBe(true);
    expect(mocks.buildSpotlight).not.toHaveBeenCalled();
  });

  it("trocar o tipo volta ao título sugerido dele; o nome reescrito vai só para o banner", async () => {
    const { result } = renderSpotlight();

    act(() => result.current.select(TARGET));
    await waitFor(() => expect(result.current.info).not.toBeNull());
    act(() => result.current.setTitle("Achado da semana"));
    act(() => result.current.setKind("restock"));
    expect(result.current.title).toBe("Reposição");

    act(() => result.current.setPrintedName("Garrafa inox"));
    await act(() => result.current.generate());

    expect(lastBuild()).toMatchObject({
      kind: "restock",
      title: "Reposição",
      product: { name: "Garrafa inox" },
    });
  });

  it("o último tamanho fica no aparelho", async () => {
    const first = renderSpotlight();
    act(() => first.result.current.setFormat("feed"));
    expect(localStorage.getItem(SPOTLIGHT_FORMAT_KEY)).toBe("feed");

    const second = renderSpotlight();
    expect(second.result.current.format.key).toBe("feed");

    act(() => second.result.current.openFor(TARGET, "new"));
    await waitFor(() => expect(second.result.current.status).toBe("ready"));
    expect(lastBuild().format).toBe("feed");
  });

  it("abrir outro produto apaga o banner do anterior, em vez de mostrá-lo esmaecido", async () => {
    const { result } = renderSpotlight();
    act(() => result.current.openFor(TARGET, "new"));
    await waitFor(() => expect(result.current.piece).not.toBeNull());

    let release!: () => void;
    mocks.getCatalogSpotlight.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve(spotlight({ productGroupId: 8, name: "COPO" }));
      }),
    );
    act(() => result.current.openFor({ productGroupId: 8, name: "COPO" }, "new"));

    expect(result.current.piece).toBeNull();
    expect(result.current.status).toBe("generating");
    await act(async () => release());
    await waitFor(() => expect(result.current.status).toBe("ready"));
  });

  it("avisa a novidade fora da janela e a foto pequena, sem travar", async () => {
    mocks.buildSpotlight.mockResolvedValue({
      blob: new Blob(["JPEG"], { type: "image/jpeg" }),
      photo: { width: 225, height: 225 },
    });
    const { result } = renderSpotlight();

    act(() => result.current.openFor(TARGET, "new"));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.hints).toHaveLength(2);
    expect(result.current.hints[0]).toMatch(/Na loja há 200 dias/);
    expect(result.current.hints[1]).toMatch(/pequena \(225 px\)/);
  });
});
