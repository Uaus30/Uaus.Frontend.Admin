import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PdvMainMenu } from "../pdv-main-menu";

describe("PdvMainMenu", () => {
  const defaultProps = {
    usesCashRegister: true,
    sessionId: 1,
    printingReport: false,
    onCloseRegister: vi.fn(),
    onStockWriteOff: vi.fn(),
    onSalesHistory: vi.fn(),
    onPerformance: vi.fn(),
    onHeldSales: vi.fn(),
    onPrintReport: vi.fn(),
    onPreferences: vi.fn(),
    onAbout: vi.fn(),
    onExit: vi.fn(),
  };

  it("abre o menu ao clicar no botão e exibe a opção Sobre", () => {
    render(<PdvMainMenu {...defaultProps} />);

    // Clica no botão sanduíche para abrir o menu
    const menuButton = screen.getByRole("button");
    fireEvent.click(menuButton);

    const aboutButton = screen.getByRole("button", { name: /Sobre/i });
    expect(aboutButton).toBeDefined();

    fireEvent.click(aboutButton);
    expect(defaultProps.onAbout).toHaveBeenCalledTimes(1);
  });

  it("fecha ao apontar para fora do menu", async () => {
    // Regressão de 01/09/2026: o clique-fora era uma camada `fixed inset-0`
    // dentro do cabeçalho, que tem `backdrop-blur`. Filtro de fundo cria
    // containing block para `fixed`, então a camada cobria só a faixa do
    // cabeçalho — clicar na área da venda deixava o menu aberto para sempre.
    render(
      <div>
        <PdvMainMenu {...defaultProps} />
        <main data-testid="fora">área da venda</main>
      </div>,
    );

    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(screen.queryByRole("button", { name: /Sobre/i })).not.toBeNull();

    fireEvent.pointerDown(screen.getByTestId("fora"));

    // `waitFor` porque a saída é animada (AnimatePresence): o nó só deixa o DOM
    // quando a animação termina.
    await waitFor(() => expect(screen.queryByRole("button", { name: /Sobre/i })).toBeNull());
  });

  it("fecha com Escape", async () => {
    render(<PdvMainMenu {...defaultProps} />);

    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByRole("button", { name: /Sobre/i })).not.toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("button", { name: /Sobre/i })).toBeNull());
  });

  it("não reabre ao apontar para o próprio botão que fecha", async () => {
    // O `pointerdown` global fecharia e o `click` do botão reabriria: sem a
    // guarda do container, o menu nunca fecharia pelo próprio botão.
    render(<PdvMainMenu {...defaultProps} />);

    const botao = screen.getByRole("button");
    fireEvent.click(botao);
    expect(screen.queryByRole("button", { name: /Sobre/i })).not.toBeNull();

    fireEvent.pointerDown(botao);
    fireEvent.click(botao);

    await waitFor(() => expect(screen.queryByRole("button", { name: /Sobre/i })).toBeNull());
  });
});
