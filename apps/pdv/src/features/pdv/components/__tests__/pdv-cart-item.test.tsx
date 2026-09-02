import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdvCartItem } from "../pdv-cart-item";
import { usePdvStore } from "@/stores/use-pdv-store";
import { renderWithHints } from "@/test/render-with-hints";
import type { PdvItem } from "../../types";

const ITEM: PdvItem = {
  id: "linha-1",
  productId: 7,
  name: "Coca-Cola 350ml",
  price: 10,
  quantity: 1,
  discount: 0,
  availableStock: 5,
};

describe("PdvCartItem", () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    // O jsdom não implementa `scrollIntoView`; o componente a chama de forma
    // opcional, e aqui ela existe para o teste ver com que alinhamento foi pedida.
    Element.prototype.scrollIntoView = scrollIntoView;
    usePdvStore.setState({ items: [ITEM], lastAddedItemId: null, lastAddedSeq: 0 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("traz a linha bipada para a área visível, rolando o mínimo", () => {
    // O item novo entra no fim da lista: com o carrinho mais alto que a
    // coluna, o pulso acontecia fora da tela e o operador bipava de novo.
    usePdvStore.setState({ lastAddedItemId: ITEM.id, lastAddedSeq: 1 });
    renderWithHints(<PdvCartItem item={ITEM} />);

    expect(screen.getByTestId("cart-item-pulse")).toBeDefined();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
  });

  it("rola de novo quando o mesmo produto é bipado outra vez", () => {
    // Bipar o mesmo produto não cria linha nova, só soma a quantidade — e a
    // linha pode estar no topo, fora da tela, enquanto o operador olha o fim.
    usePdvStore.setState({ lastAddedItemId: ITEM.id, lastAddedSeq: 1 });
    const { rerender } = renderWithHints(<PdvCartItem item={ITEM} />);

    usePdvStore.setState({ lastAddedSeq: 2 });
    rerender(<PdvCartItem item={{ ...ITEM, quantity: 2 }} />);

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it("não mexe na rolagem da linha que não recebeu o bipe", () => {
    usePdvStore.setState({ lastAddedItemId: "outra-linha", lastAddedSeq: 3 });
    renderWithHints(<PdvCartItem item={ITEM} />);

    expect(screen.queryByTestId("cart-item-pulse")).toBeNull();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
