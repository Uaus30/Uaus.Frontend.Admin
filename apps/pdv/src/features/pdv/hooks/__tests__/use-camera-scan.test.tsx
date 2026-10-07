import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type ProductPdvSearchDto } from "@workspace/api-client-react";

/**
 * A câmera do celular no lugar do leitor de mão (07/10/2026). A busca é dublada
 * — ela tem teste próprio, com o caminho da base local — e o que importa aqui é
 * o que cada resultado vira: item no carrinho ou o aviso certo embaixo do vídeo.
 */
const mocks = vi.hoisted(() => ({ searchProducts: vi.fn() }));

vi.mock("@/lib/product-search", () => ({ searchProducts: mocks.searchProducts }));

const { useCameraScan } = await import("../use-camera-scan");

const CANECA: ProductPdvSearchDto = {
  id: 7,
  name: "CANECA PORCELANA",
  barcode: "7891234567895",
  price: 25,
  stock: 4,
  productGroupId: 3,
  imageUrl: null,
};

function scan(addProductToCart = vi.fn(() => true), online = true) {
  const { result } = renderHook(() => useCameraScan({ online, addProductToCart }));
  return { read: result.current, addProductToCart };
}

describe("useCameraScan", () => {
  beforeEach(() => {
    mocks.searchProducts.mockReset();
  });

  it("código exato de um produto: entra no carrinho e o aviso diz qual", async () => {
    mocks.searchProducts.mockResolvedValue([CANECA]);
    const { read, addProductToCart } = scan();

    const feedback = await read(" 7891234567895 ");

    expect(mocks.searchProducts).toHaveBeenCalledWith("7891234567895", { online: true });
    expect(addProductToCart).toHaveBeenCalledWith(CANECA);
    expect(feedback).toEqual({ tone: "success", message: "CANECA PORCELANA no carrinho." });
  });

  it("sem internet, a mesma leitura vai para a base local", async () => {
    mocks.searchProducts.mockResolvedValue([CANECA]);
    const { read } = scan(
      vi.fn(() => true),
      false,
    );

    await read("7891234567895");

    expect(mocks.searchProducts).toHaveBeenCalledWith("7891234567895", { online: false });
  });

  it("resultado parecido, mas não o código exato, não entra sozinho", async () => {
    // A busca acha por trecho; o leitor só aceita o código inteiro.
    mocks.searchProducts.mockResolvedValue([{ ...CANECA, barcode: "78912345678950" }]);
    const { read, addProductToCart } = scan();

    const feedback = await read("7891234567895");

    expect(addProductToCart).not.toHaveBeenCalled();
    expect(feedback).toEqual({ tone: "warning", message: "Nenhum produto com o código 7891234567895." });
  });

  it("dois cadastros com o mesmo código: não escolhe sozinho", async () => {
    mocks.searchProducts.mockResolvedValue([CANECA, { ...CANECA, id: 8, name: "CANECA AZUL" }]);
    const { read, addProductToCart } = scan();

    const feedback = await read("7891234567895");

    expect(addProductToCart).not.toHaveBeenCalled();
    expect(feedback.tone).toBe("warning");
    expect(feedback.message).toContain("2 produtos");
  });

  it("estoque que não cobre mais uma unidade: aviso de erro com o saldo", async () => {
    mocks.searchProducts.mockResolvedValue([CANECA]);
    const { read } = scan(vi.fn(() => false));

    expect(await read("7891234567895")).toEqual({
      tone: "error",
      message: "CANECA PORCELANA: só há 4 no estoque.",
    });
  });

  it("produto zerado: diz sem estoque", async () => {
    mocks.searchProducts.mockResolvedValue([{ ...CANECA, stock: 0 }]);
    const { read } = scan(vi.fn(() => false));

    expect((await read("7891234567895")).message).toBe("CANECA PORCELANA: sem estoque.");
  });

  it("a busca recusada pelo servidor vira aviso, e não exceção dentro da câmera", async () => {
    mocks.searchProducts.mockRejectedValue(
      new ApiError("Termo inválido.", 400, { message: "Termo inválido." }, "GET", "/Pdv/products"),
    );
    const { read } = scan();

    const feedback = await read("7891234567895");

    expect(feedback.tone).toBe("error");
    expect(feedback.message).toContain("Termo inválido.");
  });
});
