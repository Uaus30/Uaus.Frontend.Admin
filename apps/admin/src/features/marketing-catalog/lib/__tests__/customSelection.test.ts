import { describe, expect, it } from "vitest";
import type { CatalogItemDto, CatalogSelectionDto, StorefrontProductDto } from "@workspace/api-client-react";
import {
  CUSTOM_STORAGE_KEY,
  describeCardPrice,
  describeUnavailable,
  loadStoredCustom,
  moveItem,
  normalizePrintedName,
  saveStoredCustom,
  toCustomProducts,
  unavailableLabel,
  type CustomItem,
} from "../customSelection";

function card(id: number, overrides: Partial<StorefrontProductDto> = {}): StorefrontProductDto {
  return {
    productGroupId: id,
    name: `PRODUTO ${id}`,
    price: 10,
    hasVariations: false,
    categoryName: "Brinquedos",
    imageUrl: `https://bucket.exemplo/${id}.jpg`,
    tags: [],
    ...overrides,
  };
}

function item(id: number, role = "Regular", overrides: Partial<StorefrontProductDto> = {}): CatalogItemDto {
  return { role, product: card(id, overrides) };
}

function chosen(id: number, printedName = ""): CustomItem {
  return { productGroupId: id, catalogName: `PRODUTO ${id}`, printedName };
}

describe("toCustomProducts", () => {
  it("segue a ordem da LISTA e põe o nome escrito pela pessoa no card", () => {
    const response: CatalogSelectionDto = { items: [item(1), item(2, "New"), item(3)], unavailable: [] };

    const { products, unavailable } = toCustomProducts(response, [
      chosen(3),
      chosen(1, "  Carrinho   de controle "),
      chosen(2),
    ]);

    expect(products.map((product) => product.productGroupId)).toEqual([3, 1, 2]);
    expect(products.map((product) => product.name)).toEqual([
      "PRODUTO 3",
      "Carrinho de controle",
      "PRODUTO 2",
    ]);
    // O papel do servidor continua valendo: é ele que põe o selo de novidade.
    expect(products[2].badge).toBe("new");
    expect(unavailable).toEqual({});
  });

  it("quem o servidor recusou sai dos produtos e entra nos indisponíveis, com o motivo", () => {
    const response: CatalogSelectionDto = {
      items: [item(1)],
      unavailable: [
        { productGroupId: 2, reason: "OutOfStock" },
        { productGroupId: 3, reason: "NotOnSite" },
      ],
    };

    const { products, unavailable } = toCustomProducts(response, [chosen(2), chosen(1), chosen(3)]);

    expect(products.map((product) => product.productGroupId)).toEqual([1]);
    expect(unavailable).toEqual({ 2: 2, 3: 1 });
  });

  it("card sem foto vira 'sem foto', e o que não voltou vira 'fora do site' — nunca some calado", () => {
    const response: CatalogSelectionDto = {
      items: [item(1, "Regular", { imageUrl: null })],
      unavailable: [],
    };

    const { products, unavailable } = toCustomProducts(response, [chosen(1), chosen(2)]);

    expect(products).toEqual([]);
    expect(unavailable).toEqual({ 1: 3, 2: 1 });
  });
});

describe("textos da escolha", () => {
  it("o motivo aparece pelo nome do enum ou pelo código", () => {
    expect(unavailableLabel("OutOfStock")).toBe("sem saldo");
    expect(unavailableLabel(1)).toBe("fora do site");
    expect(unavailableLabel("NoPhoto")).toBe("sem foto");
  });

  it("o aviso lista os recusados com o nome impresso e o motivo", () => {
    const items = [chosen(1, "Carrinho"), chosen(2), chosen(3)];

    expect(describeUnavailable({ 1: 2 }, items)).toBe("Carrinho (sem saldo)");
    expect(describeUnavailable({ 1: 2, 3: 1 }, items)).toBe(
      "Carrinho (sem saldo) e PRODUTO 3 (fora do site)",
    );
  });

  it("o nome impresso perde o espaço sobrando e fica no teto", () => {
    expect(normalizePrintedName("   ")).toBe("");
    expect(normalizePrintedName("a".repeat(80))).toHaveLength(60);
  });

  it("o preço da busca diz 'a partir de' e a promoção", () => {
    // O `Intl` separa o "R$" com espaço inquebrável.
    const price = (value: StorefrontProductDto) => describeCardPrice(value).replace(/\s/g, " ");

    expect(price(card(1))).toBe("R$ 10,00");
    expect(price(card(1, { priceMax: 16 }))).toBe("a partir de R$ 10,00");
    expect(price(card(1, { promotion: { type: "Everyday", price: 8, referencePrice: 10 } }))).toBe(
      "R$ 8,00 · Promoção",
    );
    // Sem foto o card não sairia na peça, mas o preço ainda informa a escolha.
    expect(price(card(1, { imageUrl: null }))).toBe("R$ 10,00");
  });
});

describe("moveItem", () => {
  it("sobe e desce uma posição, e não sai da lista pelas pontas", () => {
    expect(moveItem([1, 2, 3], 1, -1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 1, 1)).toEqual([1, 3, 2]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
  });
});

describe("lista guardada no aparelho", () => {
  function memoryStorage(initial?: string) {
    const data = new Map<string, string>();
    if (initial !== undefined) data.set(CUSTOM_STORAGE_KEY, initial);
    return {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
    };
  }

  it("guarda e lê de volta formato, título e itens", () => {
    const storage = memoryStorage();
    saveStoredCustom(storage, { format: "feed", title: "Dia das Crianças", items: [chosen(1, "Carrinho")] });

    expect(loadStoredCustom(storage)).toEqual({
      format: "feed",
      title: "Dia das Crianças",
      items: [chosen(1, "Carrinho")],
    });
  });

  it("JSON quebrado, item estranho e repetido não derrubam a tela", () => {
    expect(loadStoredCustom(memoryStorage("{quebrado"))).toBeNull();

    const stored = loadStoredCustom(
      memoryStorage(
        JSON.stringify({
          format: "pdf",
          items: [chosen(1), { productGroupId: "2" }, chosen(1), chosen(3), null],
        }),
      ),
    );

    // O PDF não existe no personalizado: volta ao 9:16.
    expect(stored).toEqual({ format: "story", title: "", items: [chosen(1), chosen(3)] });
  });

  it("armazenamento que lança (aba anônima) vira lista vazia e gravação calada", () => {
    const broken = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };

    expect(loadStoredCustom(broken)).toBeNull();
    expect(() => saveStoredCustom(broken, { format: "story", title: "", items: [] })).not.toThrow();
  });
});
