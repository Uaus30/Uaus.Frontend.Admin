import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductNotesAlert } from "../ProductNotesAlert";
import type { useProductEditor } from "../../../hooks/useProductEditor";

/** O mínimo do `useProductEditor` que este alerta lê. */
function fakeEditor(notes: string) {
  return { form: { notes } } as unknown as ReturnType<typeof useProductEditor>;
}

describe("ProductNotesAlert", () => {
  it("nao renderiza nada sem observacao", () => {
    const { container } = render(<ProductNotesAlert editor={fakeEditor("")} />);

    expect(container.firstChild).toBeNull();
  });

  it("nao renderiza para observacao so com espacos", () => {
    // Quem digitou e apagou tudo não pode ver a caixa vazia — mesma regra do
    // resto da tela para campo opcional em branco.
    const { container } = render(<ProductNotesAlert editor={fakeEditor("   \n  ")} />);

    expect(container.firstChild).toBeNull();
  });

  it("mostra o texto da observacao quando preenchida", () => {
    render(<ProductNotesAlert editor={fakeEditor("Fornecedor demora, avisar cliente")} />);

    expect(screen.getByText("Observação interna")).toBeTruthy();
    expect(screen.getByText("Fornecedor demora, avisar cliente")).toBeTruthy();
  });
});
