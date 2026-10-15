import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CustomItem } from "../../lib/customSelection";
import { CustomSelectionList } from "../CustomSelectionList";

function chosen(id: number, printedName = ""): CustomItem {
  return { productGroupId: id, catalogName: `PRODUTO ${id}`, printedName };
}

/** Sem jest-dom aqui: o estado do botão é lido no próprio elemento. */
const button = (element: HTMLElement) => element as HTMLButtonElement;

function renderList(overrides: Partial<Parameters<typeof CustomSelectionList>[0]> = {}) {
  const props = {
    items: [chosen(1, "Carrinho"), chosen(2), chosen(3)],
    capacity: 9,
    formatLabel: "Banner 9:16",
    unavailable: {},
    disabled: false,
    blocker: null as string | null,
    hasPiece: false,
    onGenerate: vi.fn(),
    onRename: vi.fn(),
    onMove: vi.fn(),
    onRemove: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  };
  render(<CustomSelectionList {...props} />);
  return props;
}

describe("CustomSelectionList", () => {
  it("o nome é editável, com o do cadastro como placeholder", () => {
    const props = renderList();

    const field = screen.getByLabelText("Nome impresso de PRODUTO 2") as HTMLInputElement;
    expect(field.placeholder).toBe("PRODUTO 2");
    expect((screen.getByLabelText("Nome impresso de PRODUTO 1") as HTMLInputElement).value).toBe("Carrinho");

    fireEvent.change(field, { target: { value: "Boneca" } });
    expect(props.onRename).toHaveBeenCalledWith(1, "Boneca");
  });

  it("o primeiro não sobe e o último não desce", () => {
    const props = renderList();

    expect(button(screen.getByRole("button", { name: "Subir PRODUTO 1" })).disabled).toBe(true);
    expect(button(screen.getByRole("button", { name: "Descer PRODUTO 3" })).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Subir PRODUTO 2" }));
    expect(props.onMove).toHaveBeenCalledWith(1, -1);
  });

  it("quem passa do teto do formato aparece marcado", () => {
    renderList({ capacity: 2, formatLabel: "Banner 4:5" });

    expect(screen.getByText("Fica fora do Banner 4:5, que leva 2.")).toBeTruthy();
    expect(screen.getByText(/Produtos no banner \(2 de 2\)/)).toBeTruthy();
  });

  it("quem o servidor recusou aparece com o motivo", () => {
    renderList({ unavailable: { 2: 2 } });

    expect(screen.getByText("Não entra: sem saldo")).toBeTruthy();
  });

  it("o botão de gerar diz o que falta, e vira 'Atualizar' com banner na tela", () => {
    renderList({ blocker: "Escreva o título do banner." });
    expect(button(screen.getByRole("button", { name: /gerar banner/i })).disabled).toBe(true);
    expect(screen.getByText("Escreva o título do banner.")).toBeTruthy();
  });

  it("com banner na tela o botão é 'Atualizar banner'", () => {
    const props = renderList({ hasPiece: true });

    fireEvent.click(screen.getByRole("button", { name: /atualizar banner/i }));
    expect(props.onGenerate).toHaveBeenCalled();
  });
});
