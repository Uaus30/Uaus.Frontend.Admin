import { createRef } from "react";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProductPdvSearchDto } from "@workspace/api-client-react";
import { PdvSearchPanel } from "../pdv-search-panel";
import type { ProductSearchState } from "../../hooks/use-product-search";
import { renderWithHints } from "@/test/render-with-hints";

const PRODUTO: ProductPdvSearchDto = {
  id: 7,
  name: "COCA-COLA 350ML",
  barcode: "7891000100103",
  price: 10,
  stock: 5,
  imageUrl: null,
};

function makeSearch(overrides: Partial<ProductSearchState> = {}): ProductSearchState {
  return {
    query: "coca",
    setQuery: vi.fn(),
    results: [PRODUTO],
    notFound: false,
    isSearching: false,
    search: vi.fn(),
    clear: vi.fn(),
    ...overrides,
  };
}

function renderPanel(search = makeSearch()) {
  const inputRef = createRef<HTMLInputElement>();
  const onPickProduct = vi.fn();
  renderWithHints(
    <PdvSearchPanel search={search} inputRef={inputRef} online onPickProduct={onPickProduct} />,
  );
  return { inputRef, onPickProduct, search };
}

describe("PdvSearchPanel", () => {
  it("devolve o cursor ao campo de busca depois de escolher um produto na lista", () => {
    // O card é uma div: o mousedown nela tirava o cursor do campo, e o próximo
    // bipe do leitor não entrava em lugar nenhum. Aqui o campo é tirado do foco
    // à mão, como o navegador faz, e o clique tem que trazê-lo de volta.
    const { inputRef, onPickProduct, search } = renderPanel();
    const input = inputRef.current!;
    input.focus();
    input.blur();
    expect(document.activeElement).not.toBe(input);

    fireEvent.click(screen.getByTestId("search-result"));

    expect(onPickProduct).toHaveBeenCalledWith(PRODUTO);
    expect(search.clear).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(input);
  });

  it("não deixa o mousedown no card tirar o cursor do campo", () => {
    // `fireEvent` devolve false quando o padrão do evento foi cancelado — e
    // cancelar o mousedown é o que impede o navegador de mover o foco.
    renderPanel();

    expect(fireEvent.mouseDown(screen.getByTestId("search-result"))).toBe(false);
  });

  it("não adiciona nem limpa a busca ao clicar em produto sem estoque", () => {
    const { onPickProduct, search } = renderPanel(makeSearch({ results: [{ ...PRODUTO, stock: 0 }] }));

    fireEvent.click(screen.getByTestId("search-result"));

    expect(onPickProduct).not.toHaveBeenCalled();
    expect(search.clear).not.toHaveBeenCalled();
  });
});
