import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductPdvSearchDto } from "@workspace/api-client-react";
import type { CheckoutState } from "@/hooks/use-checkout";
import { usePdvStore } from "@/stores/use-pdv-store";
import { usePdvCounter } from "../use-pdv-counter";

const PRODUTO: ProductPdvSearchDto = {
  id: 7,
  name: "CANECA PORCELANA",
  barcode: "7891234567895",
  price: 25,
  stock: 2,
  productGroupId: 3,
  imageUrl: null,
};

const checkout = { setPayments: vi.fn(), setAmountReceived: vi.fn() } as unknown as CheckoutState;

function renderCounter(autoFocus?: boolean) {
  const { result } = renderHook(() => usePdvCounter({ online: true, sessionId: null, checkout, autoFocus }));
  const input = document.createElement("input");
  document.body.appendChild(input);
  (result.current.searchInputRef as { current: HTMLInputElement | null }).current = input;
  return { result, input };
}

describe("usePdvCounter", () => {
  afterEach(() => {
    usePdvStore.getState().cancelSale();
    document.body.innerHTML = "";
  });

  it("no balcão, devolve o cursor à busca", () => {
    const { result, input } = renderCounter();

    act(() => result.current.focusSearch());

    expect(document.activeElement).toBe(input);
  });

  it("no celular, não devolve: o foco abriria o teclado por cima da tela", () => {
    const { result, input } = renderCounter(false);

    act(() => result.current.focusSearch());

    expect(document.activeElement).not.toBe(input);
  });

  it("diz se o produto entrou: a câmera precisa da resposta para o aviso", () => {
    const { result } = renderCounter();

    let primeira = false;
    let segunda = false;
    let terceira = true;
    act(() => {
      primeira = result.current.addProductToCart(PRODUTO);
      segunda = result.current.addProductToCart(PRODUTO);
      // O estoque é 2: a terceira unidade é recusada.
      terceira = result.current.addProductToCart(PRODUTO);
    });

    expect([primeira, segunda, terceira]).toEqual([true, true, false]);
    expect(usePdvStore.getState().items[0].quantity).toBe(2);
  });

  it("produto zerado não entra", () => {
    const { result } = renderCounter();

    let entrou = true;
    act(() => {
      entrou = result.current.addProductToCart({ ...PRODUTO, stock: 0 });
    });

    expect(entrou).toBe(false);
    expect(usePdvStore.getState().items).toHaveLength(0);
  });
});
