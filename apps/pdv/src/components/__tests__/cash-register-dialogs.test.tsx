import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CloseCashRegisterDialog } from "../cash-register-dialogs";

describe("CloseCashRegisterDialog", () => {
  it("lembra de subir a fila do celular antes de fechar", () => {
    // O fechamento confere só a fila deste aparelho: a venda presa no celular
    // de contingência seria recusada depois (07/10/2026).
    render(
      <CloseCashRegisterDialog
        open
        onOpenChange={vi.fn()}
        summary={null}
        session={null}
        onCloseRegister={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog").textContent).toContain("Vendeu pelo celular?");
  });
});
