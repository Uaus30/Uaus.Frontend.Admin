import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@workspace/api-client-react";
import type { StorefrontProductDetailDto } from "@workspace/api-client-react";
import { formatCurrency } from "@workspace/core";
import { useProductDetail } from "../useProductDetail";

const mocks = vi.hoisted(() => ({
  useGetStorefrontProduct: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetStorefrontProduct: mocks.useGetStorefrontProduct,
}));

const detailDto: StorefrontProductDetailDto = {
  productGroupId: 905,
  name: "Caneca Personalizada",
  description: "Porcelana",
  price: 25,
  priceMax: 35,
  hasVariations: true,
  categoryName: "Presentes",
  images: [
    { url: "https://cdn/frente.jpg", displayOrder: 0 },
    { url: "https://cdn/verso.jpg", displayOrder: 1 },
  ],
  tags: [],
  variations: [
    { name: "Caneca 300ml", price: 25 },
    { name: "Caneca 500ml", price: 35 },
  ],
};

function givenProduct(data: StorefrontProductDetailDto | undefined, error: ApiError | null = null) {
  mocks.useGetStorefrontProduct.mockReturnValue({
    data,
    isLoading: false,
    isError: error != null,
    error,
  });
}

describe("useProductDetail", () => {
  afterEach(() => vi.clearAllMocks());

  it("monta o link de reserva com nome, faixa de preço e a URL do produto", () => {
    givenProduct(detailDto);

    const { result } = renderHook(() => useProductDetail(905));

    const url = result.current.reservationUrl!;
    expect(url).toContain("https://wa.me/");
    expect(url).toContain(encodeURIComponent("*Caneca Personalizada*"));
    expect(url).toContain(encodeURIComponent(`a partir de ${formatCurrency(25)}`));
    // A URL do produto entra na mensagem: é como a lojista acha o cadastro.
    expect(url).toContain(encodeURIComponent(`${window.location.origin}/produtos/905`));
  });

  it("inclui a variação escolhida na mensagem e sai dela ao desmarcar", () => {
    givenProduct(detailDto);

    const { result } = renderHook(() => useProductDetail(905));

    act(() => result.current.selectVariation("Caneca 500ml"));
    expect(result.current.reservationUrl).toContain(encodeURIComponent("Variação: Caneca 500ml"));

    act(() => result.current.selectVariation(undefined));
    expect(result.current.reservationUrl).not.toContain(encodeURIComponent("Variação:"));
  });

  it("trata o 404 como produto indisponível, separado dos demais erros", () => {
    givenProduct(undefined, new ApiError("Produto não encontrado ou indisponível no site.", 404, null));

    const { result } = renderHook(() => useProductDetail(999));

    expect(result.current.isNotFound).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it("trata erro de servidor como erro comum, com mensagem descritiva", () => {
    givenProduct(undefined, new ApiError("Erro 500 ao acessar /Storefront/products/905", 500, null));

    const { result } = renderHook(() => useProductDetail(905));

    expect(result.current.isNotFound).toBe(false);
    expect(result.current.isError).toBe(true);
    expect(result.current.errorMessage).not.toBe("");
  });

  it("zera galeria, variação e lightbox ao navegar para outro produto", () => {
    givenProduct(detailDto);

    const { result, rerender } = renderHook(({ id }) => useProductDetail(id), {
      initialProps: { id: 905 },
    });

    act(() => {
      result.current.selectImage(1);
      result.current.selectVariation("Caneca 500ml");
      result.current.setLightboxOpen(true);
    });

    rerender({ id: 906 });

    expect(result.current.selectedImageIndex).toBe(0);
    expect(result.current.selectedVariation).toBeUndefined();
    expect(result.current.isLightboxOpen).toBe(false);
  });
});
