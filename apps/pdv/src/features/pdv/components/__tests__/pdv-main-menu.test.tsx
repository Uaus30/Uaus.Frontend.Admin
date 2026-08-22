import { render, screen, fireEvent } from "@testing-library/react";
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
});
