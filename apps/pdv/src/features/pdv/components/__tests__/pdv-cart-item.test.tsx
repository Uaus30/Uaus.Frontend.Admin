import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdvCartItem } from "../pdv-cart-item";
import { usePdvStore } from "@/stores/use-pdv-store";
import { renderWithHints } from "@/test/render-with-hints";
import type { PdvItem } from "../../types";

// A conta da rolagem tem teste próprio em `lib/scroll-into-view.test.ts`; aqui
// o que importa é QUANDO a linha pede para ficar à vista.
const mocks = vi.hoisted(() => ({
  scrollIntoViewVertically: vi.fn(),
}));

vi.mock("@/lib/scroll-into-view", () => ({
  scrollIntoViewVertically: mocks.scrollIntoViewVertically,
}));

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
  beforeEach(() => {
    usePdvStore.setState({ items: [ITEM], lastAddedItemId: null, lastAddedSeq: 0 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("pede para a linha bipada ficar à vista, com o pulso ligado", () => {
    // O item novo entra no fim da lista: com o carrinho mais alto que a
    // coluna, o pulso acontecia fora da tela e o operador bipava de novo.
    usePdvStore.setState({ lastAddedItemId: ITEM.id, lastAddedSeq: 1 });
    renderWithHints(<PdvCartItem item={ITEM} />);

    expect(screen.getByTestId("cart-item-pulse")).toBeDefined();
    expect(mocks.scrollIntoViewVertically).toHaveBeenCalledTimes(1);
    expect(mocks.scrollIntoViewVertically.mock.calls[0][0]).toBeInstanceOf(HTMLElement);
  });

  it("pede de novo quando o mesmo produto é bipado outra vez", () => {
    // Bipar o mesmo produto não cria linha nova, só soma a quantidade — e a
    // linha pode estar no topo, fora da tela, enquanto o operador olha o fim.
    usePdvStore.setState({ lastAddedItemId: ITEM.id, lastAddedSeq: 1 });
    const { rerender } = renderWithHints(<PdvCartItem item={ITEM} />);

    usePdvStore.setState({ lastAddedSeq: 2 });
    rerender(<PdvCartItem item={{ ...ITEM, quantity: 2 }} />);

    expect(mocks.scrollIntoViewVertically).toHaveBeenCalledTimes(2);
  });

  it("não mexe na rolagem pela linha que não recebeu o bipe", () => {
    usePdvStore.setState({ lastAddedItemId: "outra-linha", lastAddedSeq: 3 });
    renderWithHints(<PdvCartItem item={ITEM} />);

    expect(screen.queryByTestId("cart-item-pulse")).toBeNull();
    expect(mocks.scrollIntoViewVertically).not.toHaveBeenCalled();
  });
});
