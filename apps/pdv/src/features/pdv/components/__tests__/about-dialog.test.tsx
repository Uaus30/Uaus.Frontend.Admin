import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AboutDialog } from "../about-dialog";

describe("AboutDialog", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_APP_VERSION", "1.0.144");
    vi.stubEnv("VITE_BUILD_TIME", "2026-08-22T15:45:12Z");
  });

  it("renderiza as informações da versão e data de atualização no fuso de Brasília", () => {
    render(<AboutDialog open={true} onOpenChange={vi.fn()} />);

    const versionElement = screen.getByTestId("about-version");
    const updatedAtElement = screen.getByTestId("about-updated-at");

    expect(versionElement.textContent).toBe("Versão 1.0.144");
    expect(updatedAtElement.textContent).toBe("22/08/2026 às 12:45:12");
  });

  it("chama onOpenChange(false) ao clicar no botão Fechar", () => {
    const onOpenChange = vi.fn();
    render(<AboutDialog open={true} onOpenChange={onOpenChange} />);

    const closeButton = screen.getByRole("button", { name: "Fechar" });
    fireEvent.click(closeButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
