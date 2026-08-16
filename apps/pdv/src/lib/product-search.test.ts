import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalProduct } from "@/offline";

const searchPdvProducts = vi.fn();
const searchLocalProducts = vi.fn();

/** Erro que o cliente HTTP lança quando o servidor **respondeu** recusando. */
class ApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  ApiError,
  searchPdvProducts: (...args: unknown[]) => searchPdvProducts(...args),
}));

vi.mock("@/offline", () => ({
  searchLocalProducts: (...args: unknown[]) => searchLocalProducts(...args),
}));

const { ProductSearchUnavailableError, searchProducts, toProductPdvSearchDtos } =
  await import("./product-search");

/** Produto da base local. */
function localProduct(id: number, name: string): LocalProduct {
  return {
    id,
    name,
    barcode: `${id}`,
    price: 10,
    stock: 4,
    status: 2,
    productGroupId: 1,
    searchName: name.toLowerCase(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  searchPdvProducts.mockResolvedValue([{ id: 1, name: "Café", barcode: "111", stock: 9, price: 10 }]);
  searchLocalProducts.mockResolvedValue([localProduct(2, "Caneta")]);
});

describe("toProductPdvSearchDtos", () => {
  it("deve mapear campos para ProductPdvSearchDto", () => {
    const [dto] = toProductPdvSearchDtos([localProduct(1, "Café")]);

    expect(dto).toMatchObject({ id: 1, name: "Café", stock: 4, price: 10 });
  });
});

describe("searchProducts", () => {
  it("deve devolver vazio para termo em branco sem consultar nada", async () => {
    expect(await searchProducts("   ", { online: true })).toEqual([]);
    expect(searchPdvProducts).not.toHaveBeenCalled();
    expect(searchLocalProducts).not.toHaveBeenCalled();
  });

  it("deve buscar na API quando há conexão", async () => {
    const found = await searchProducts("  café  ", { online: true });

    expect(searchPdvProducts).toHaveBeenCalledWith("café", 20);
    expect(found).toHaveLength(1);
    expect(searchLocalProducts).not.toHaveBeenCalled();
  });

  it("deve buscar na base local quando não há conexão", async () => {
    const found = await searchProducts("caneta", { online: false });

    expect(searchPdvProducts).not.toHaveBeenCalled();
    expect(found[0]).toMatchObject({ id: 2, name: "Caneta" });
  });

  it("deve cair para a base local quando a rede falha no meio da requisição", async () => {
    // É o caso que mais aparece no balcão: a conexão cai com o operador já
    // digitando, e a busca não pode simplesmente falhar.
    searchPdvProducts.mockRejectedValue(new TypeError("Failed to fetch"));

    expect(await searchProducts("caneta", { online: true })).toHaveLength(1);
    expect(searchLocalProducts).toHaveBeenCalled();
  });

  it("deve propagar a recusa do servidor sem mascarar com resultado local", async () => {
    // O servidor respondeu: a busca falhou de verdade, e mostrar dado local
    // esconderia o problema.
    searchPdvProducts.mockRejectedValue(new ApiError("Sessão expirada!", 401));

    await expect(searchProducts("café", { online: true })).rejects.toThrow("Sessão expirada!");
    expect(searchLocalProducts).not.toHaveBeenCalled();
  });

  it("deve avisar quando nem a API nem a base local respondem", async () => {
    searchPdvProducts.mockRejectedValue(new TypeError("Failed to fetch"));
    searchLocalProducts.mockRejectedValue(new Error("IndexedDB indisponível"));

    await expect(searchProducts("café", { online: true })).rejects.toBeInstanceOf(
      ProductSearchUnavailableError,
    );
  });

  it("deve tolerar resposta da API vazia", async () => {
    searchPdvProducts.mockResolvedValue([]);

    expect(await searchProducts("café", { online: true })).toEqual([]);
  });

  it("deve empurrar os zerados para o fim sem embaralhar o resto", async () => {
    // O que o operador consegue vender vem primeiro; entre os vendáveis a ordem
    // de relevância que a API devolveu tem que sobreviver.
    searchPdvProducts.mockResolvedValue([
      { id: 1, name: "Café A", barcode: "1", stock: 0, price: 10 },
      { id: 2, name: "Café B", barcode: "2", stock: 5, price: 10 },
      { id: 3, name: "Café C", barcode: "3", stock: 0, price: 10 },
      { id: 4, name: "Café D", barcode: "4", stock: 2, price: 10 },
    ]);

    const found = await searchProducts("café", { online: true });

    expect(found.map((p) => p.id)).toEqual([2, 4, 1, 3]);
  });

  it("deve ordenar também o resultado da base local", async () => {
    searchLocalProducts.mockResolvedValue([
      { ...localProduct(1, "Caneta azul"), stock: 0 },
      localProduct(2, "Caneta preta"),
    ]);

    const found = await searchProducts("caneta", { online: false });

    expect(found.map((p) => p.id)).toEqual([2, 1]);
  });
});
