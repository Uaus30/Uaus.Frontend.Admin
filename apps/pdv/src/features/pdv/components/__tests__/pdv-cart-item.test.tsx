import { fireEvent, screen } from "@testing-library/react";
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

  /**
   * O campo de preço é a porta única da negociação: abaixo da tabela é desconto,
   * acima é acréscimo. Estes testes travam a leitura desse campo, que é a parte
   * que decide dinheiro na linha.
   */
  describe("preço unitário digitado", () => {
    /** Digita um preço no campo da linha e confirma com Enter. */
    function digitarPreco(valor: string) {
      const campo = screen.getByDisplayValue(/,/) as HTMLInputElement;
      fireEvent.change(campo, { target: { value: valor } });
      fireEvent.keyDown(campo, { key: "Enter" });
      return campo;
    }

    /** A linha como está no store agora. */
    const linha = () => usePdvStore.getState().items[0];

    it("abaixo da tabela vira desconto do item", () => {
      renderWithHints(<PdvCartItem item={ITEM} />);

      digitarPreco("8,00");

      expect(linha().discount).toBe(2);
      expect(linha().surcharge ?? 0).toBe(0);
    });

    it("acima da tabela NÃO grava nada até o motivo ser confirmado", () => {
      // O servidor recusa acréscimo sem justificativa. Gravar aqui e perguntar
      // depois deixaria a venda pronta para ser recusada no fechamento, com o
      // cliente no balcão.
      renderWithHints(<PdvCartItem item={ITEM} />);

      digitarPreco("15,00");

      expect(linha().surcharge ?? 0).toBe(0);
      expect(linha().discount).toBe(0);
      // O diálogo abre com o acréscimo já calculado: 15,00 − 10,00 de tabela.
      expect(screen.getByText("+ R$ 5,00")).toBeDefined();
    });

    it("confirmar com motivo grava o acréscimo e a justificativa", () => {
      renderWithHints(<PdvCartItem item={ITEM} />);
      digitarPreco("15,00");

      fireEvent.change(screen.getByLabelText(/motivo/i), {
        target: { value: "  Gravação de músicas  " },
      });
      fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

      expect(linha().surcharge).toBe(5);
      expect(linha().surchargeReason).toBe("Gravação de músicas");
    });

    it("confirmar sem motivo é recusado — o acréscimo não entra", () => {
      renderWithHints(<PdvCartItem item={ITEM} />);
      digitarPreco("15,00");

      fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

      expect(linha().surcharge ?? 0).toBe(0);
      expect(screen.getByText(/escreva o motivo/i)).toBeDefined();
    });

    it("cancelar devolve o campo ao preço praticado, sem gravar nada", () => {
      // É o caminho do erro de digitação: R$ 150,00 no lugar de R$ 15,00 chega
      // aqui como acréscimo de R$ 140,00 escrito por extenso, e o operador sai.
      renderWithHints(<PdvCartItem item={ITEM} />);
      digitarPreco("150,00");

      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

      expect(linha().surcharge ?? 0).toBe(0);
      expect(linha().discount).toBe(0);
      // Consulta o campo DE NOVO: o cancelamento remonta o input (a `key` muda),
      // então a referência anterior aponta para um nó que saiu da árvore. É essa
      // remontagem que apaga da tela o número recusado — sem ela o operador
      // leria "150,00" e acreditaria que valeu.
      expect((screen.getByDisplayValue(/,/) as HTMLInputElement).value).toBe("10,00");
    });

    it("voltar o preço para a tabela tira o acréscimo que estava na linha", () => {
      // Desconto e acréscimo não convivem: o campo mostra o que a unidade custa,
      // e a diferença para a tabela tem UM nome só.
      const comAcrescimo = { ...ITEM, surcharge: 5, surchargeReason: "Gravação de músicas" };
      usePdvStore.setState({ items: [comAcrescimo] });
      renderWithHints(<PdvCartItem item={comAcrescimo} />);

      digitarPreco("9,00");

      expect(linha().surcharge).toBe(0);
      expect(linha().surchargeReason).toBe("");
      expect(linha().discount).toBe(1);
    });

    it("o campo mostra o preço praticado, com o acréscimo dentro", () => {
      const comAcrescimo = { ...ITEM, surcharge: 5, surchargeReason: "Gravação de músicas" };
      usePdvStore.setState({ items: [comAcrescimo] });
      renderWithHints(<PdvCartItem item={comAcrescimo} />);

      expect(screen.getByDisplayValue("15,00")).toBeDefined();
    });

    it("não existe mais botão de acréscimo — a porta é o campo de preço", () => {
      renderWithHints(<PdvCartItem item={ITEM} />);

      expect(screen.queryByRole("button", { name: /^acréscimo$/i })).toBeNull();
    });
  });
});
