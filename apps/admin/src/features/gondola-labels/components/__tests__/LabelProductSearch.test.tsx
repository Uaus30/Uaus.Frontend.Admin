import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductPdvSearchDto } from "@workspace/api-client-react";
import { LabelProductSearch } from "../LabelProductSearch";

/** Resultado sem foto: a miniatura não é o assunto aqui. */
const CANECA = {
  id: 5,
  name: "CANECA BRANCA",
  barcode: "7891234567895",
  price: 19.9,
  stock: 3,
} as ProductPdvSearchDto;

function renderSearch(patch?: Partial<Parameters<typeof LabelProductSearch>[0]>) {
  const props = {
    search: "",
    setSearch: vi.fn(),
    onSubmit: vi.fn(),
    onClear: vi.fn(),
    results: [],
    isLoading: false,
    hasSearched: false,
    hasFailed: false,
    onAdd: vi.fn(),
    onScanCode: vi.fn(),
    disabled: false,
    ...patch,
  };
  render(<LabelProductSearch {...props} />);
  return props;
}

describe("LabelProductSearch", () => {
  afterEach(() => cleanup());

  it("sem texto no campo, não mostra o x", () => {
    renderSearch();

    expect(screen.queryByRole("button", { name: "Limpar busca" })).toBeNull();
  });

  it("o x da busca que não achou nada limpa e devolve o foco ao campo", () => {
    const props = renderSearch({ search: "canexa", hasSearched: true, results: [] });

    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));

    expect(props.onClear).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByPlaceholderText("Buscar produtos..."));
  });

  it("o x não envia a busca do formulário", () => {
    const props = renderSearch({ search: "canexa" });

    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));

    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it("o + adiciona e devolve o foco ao campo, para a próxima busca", () => {
    const props = renderSearch({ search: "caneca", hasSearched: true, results: [CANECA] });

    fireEvent.click(screen.getByRole("button", { name: "Adicionar CANECA BRANCA ao lote" }));

    expect(props.onAdd).toHaveBeenCalledWith(CANECA);
    expect(document.activeElement).toBe(screen.getByPlaceholderText("Buscar produtos..."));
  });
});
