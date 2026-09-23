import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  announceReactivatedProducts,
  dismissReactivatedProducts,
  reactivationBetween,
  subscribeToReactivations,
  useReactivatedProducts,
} from "../product-reactivation";

const balde = { productId: 10, productName: "BALDE PRETO 5L [PRETO]", previousStatus: "OutOfStock" };
const bacia = { productId: 11, productName: "BACIA 1L", previousStatus: "Inactive" };

describe("aviso de produto reativado", () => {
  // O store é de módulo e sobrevive entre os testes, como sobrevive entre as telas.
  beforeEach(() => dismissReactivatedProducts());

  it("entrada que não reativou ninguém não abre aviso — a API omite o campo", () => {
    const { result } = renderHook(() => useReactivatedProducts());

    act(() => announceReactivatedProducts(undefined));
    act(() => announceReactivatedProducts([]));

    expect(result.current).toEqual([]);
  });

  it("mostra quem voltou e fecha pelo dismiss", () => {
    const { result } = renderHook(() => useReactivatedProducts());

    act(() => announceReactivatedProducts([balde]));
    expect(result.current).toEqual([balde]);

    act(() => dismissReactivatedProducts());
    expect(result.current).toEqual([]);
  });

  it("uma segunda entrada antes de fechar SOMA ao aviso, sem repetir produto", () => {
    // Trocar a lista esconderia a primeira reativação antes de alguém lê-la.
    const { result } = renderHook(() => useReactivatedProducts());

    act(() => announceReactivatedProducts([balde]));
    act(() => announceReactivatedProducts([balde, bacia]));

    expect(result.current).toEqual([balde, bacia]);
  });

  it("a escuta ouve cada anúncio, inclusive o de produto que já estava no aviso", () => {
    // É o editor de produto: cada entrada pode ter vindo depois de uma edição à mão.
    const ouvinte = vi.fn();
    const cancelar = subscribeToReactivations(ouvinte);

    announceReactivatedProducts([balde]);
    announceReactivatedProducts([balde]);
    announceReactivatedProducts(undefined);
    cancelar();
    announceReactivatedProducts([bacia]);

    expect(ouvinte.mock.calls).toEqual([[[balde]], [[balde]]]);
  });
});

describe("reactivationBetween — a reativação vista pela diferença", () => {
  const produto = (status: string) => ({ id: 10, status, displayName: "BALDE [PRETO]", name: "BALDE" });

  it("Sem estoque ou Inativo antes e Ativo depois é reativação — com o nome composto", () => {
    expect(reactivationBetween(produto("OutOfStock"), produto("Active"))).toEqual([
      { productId: 10, productName: "BALDE [PRETO]", previousStatus: "OutOfStock" },
    ]);
    expect(reactivationBetween(produto("Inactive"), produto("Active"))[0].previousStatus).toBe("Inactive");
  });

  it("entende o status como número, que é como o formulário às vezes o guarda", () => {
    expect(reactivationBetween(produto("4"), produto("2"))).toHaveLength(1);
  });

  it("Ativo antes, Rascunho, ou sem o antes e o depois: nada a anunciar", () => {
    expect(reactivationBetween(produto("Active"), produto("Active"))).toEqual([]);
    expect(reactivationBetween(produto("Draft"), produto("Active"))).toEqual([]);
    expect(reactivationBetween(produto("OutOfStock"), produto("OutOfStock"))).toEqual([]);
    expect(reactivationBetween(undefined, produto("Active"))).toEqual([]);
    expect(reactivationBetween(produto("OutOfStock"), undefined)).toEqual([]);
  });

  it("antes e depois de produtos diferentes não se comparam", () => {
    expect(reactivationBetween({ ...produto("OutOfStock"), id: 9 }, produto("Active"))).toEqual([]);
  });
});
