import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PurchaseProductConflictDialog } from "../PurchaseProductConflictDialog";

const CONFLITO = {
  barcode: "7891234567895",
  productName: "CANECA TÉRMICA 500ML",
  purchaseName: "CANECA TERMICA",
  purchaseId: 12,
};

/**
 * Sem valor padrão de propósito: `renderDialog(undefined)` com `= CONFLITO` na
 * assinatura cairia no padrão, e o teste do `undefined` estaria testando o
 * conflito preenchido.
 */
function renderDialog(conflict: typeof CONFLITO | null | undefined) {
  const onGoToPurchase = vi.fn();
  const onDismiss = vi.fn();
  render(
    <PurchaseProductConflictDialog
      conflict={conflict}
      onGoToPurchase={onGoToPurchase}
      onDismiss={onDismiss}
    />,
  );
  return { onGoToPurchase, onDismiss };
}

describe("PurchaseProductConflictDialog", () => {
  afterEach(cleanup);

  it("sem conflito não aparece — nem com `undefined`", () => {
    // `undefined` é o que um editor mockado (ou um render antes do hook resolver)
    // entrega. Com `!== null` a modal abriria vazia por cima da tela.
    renderDialog(null);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    cleanup();

    renderDialog(undefined);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("nomeia o código, o produto que já existe e a compra que precisa mudar", () => {
    // "Este produto já existe" sozinho obrigaria a adivinhar QUAL produto é — e é
    // esse nome que vai ser procurado no seletor da tela de Compras um clique
    // depois.
    renderDialog(CONFLITO);

    const texto = screen.getByRole("alertdialog").textContent ?? "";
    expect(texto).toContain("7891234567895");
    expect(texto).toContain("CANECA TÉRMICA 500ML");
    expect(texto).toContain("CANECA TERMICA");
    expect(texto).toMatch(/segundo cadastro/i);
  });

  it("'Ajustar a compra' é o caminho de sair daqui", () => {
    const { onGoToPurchase } = renderDialog(CONFLITO);

    fireEvent.click(screen.getByRole("button", { name: /ajustar a compra/i }));

    expect(onGoToPurchase).toHaveBeenCalledTimes(1);
  });

  it("'Corrigir o código' existe para o bipe que pegou a caixa errada", () => {
    const { onDismiss, onGoToPurchase } = renderDialog(CONFLITO);

    fireEvent.click(screen.getByRole("button", { name: /corrigir o código/i }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onGoToPurchase).not.toHaveBeenCalled();
  });
});
