import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePhoneCartView } from "../use-phone-cart-view";

describe("usePhoneCartView", () => {
  it("começa na busca de produtos", () => {
    const { result } = renderHook(() => usePhoneCartView(0));
    expect(result.current.view).toBe("products");
  });

  it("não pula para o carrinho a cada item: o operador continua buscando", () => {
    const { result, rerender } = renderHook(({ count }) => usePhoneCartView(count), {
      initialProps: { count: 0 },
    });

    rerender({ count: 1 });
    rerender({ count: 2 });

    expect(result.current.view).toBe("products");
  });

  it("volta para a busca quando o carrinho esvazia (venda finalizada, pausada ou cancelada)", () => {
    const { result, rerender } = renderHook(({ count }) => usePhoneCartView(count), {
      initialProps: { count: 3 },
    });

    act(() => result.current.openCart());
    expect(result.current.view).toBe("cart");

    rerender({ count: 0 });
    expect(result.current.view).toBe("products");

    // E o próximo atendimento não reabre o carrinho sozinho no primeiro item.
    rerender({ count: 1 });
    expect(result.current.view).toBe("products");
  });

  it("tirar uma linha sem esvaziar o carrinho não tira o operador do carrinho", () => {
    const { result, rerender } = renderHook(({ count }) => usePhoneCartView(count), {
      initialProps: { count: 2 },
    });

    act(() => result.current.openCart());
    rerender({ count: 1 });

    expect(result.current.view).toBe("cart");
    act(() => result.current.openProducts());
    expect(result.current.view).toBe("products");
  });
});
