import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CheckoutState } from "@/hooks/use-checkout";
import { EMPTY_CONSUMER } from "@/stores/use-pdv-store";
import { CheckoutDialog } from "../checkout-dialog";

/**
 * O checkout no celular (07/10/2026): o confirmar numa barra presa ao pé, com o
 * total. O estado do checkout é dublado — as contas dele têm teste próprio
 * (`use-checkout`); aqui importa onde cada coisa aparece.
 */
function makeCheckout(overrides: Partial<CheckoutState> = {}): CheckoutState {
  return {
    paymentMethods: [{ id: 1, name: "Dinheiro", installments: [] }],
    payments: [{ paymentMethodId: 1, amount: 25, installmentNumber: 1 }],
    splitPayment: false,
    amountReceived: "",
    setAmountReceived: vi.fn(),
    paidAmount: 25,
    remainingAmount: 0,
    feeAmount: 0,
    cashPayment: { paymentMethodId: 1, amount: 25, installmentNumber: 1 },
    change: 0,
    cashShortfall: 0,
    togglePaymentMethod: vi.fn(),
    updatePaymentAmount: vi.fn(),
    updatePaymentInstallment: vi.fn(),
    toggleSplitPayment: vi.fn(),
    ...overrides,
  } as unknown as CheckoutState;
}

function renderCheckout(compact: boolean, onConfirmPayment = vi.fn()) {
  render(
    <CheckoutDialog
      open
      onOpenChange={vi.fn()}
      consumer={EMPTY_CONSUMER}
      setConsumer={vi.fn()}
      total={25}
      checkout={makeCheckout()}
      savingSale={false}
      onConfirmPayment={onConfirmPayment}
      compact={compact}
    />,
  );
  return { onConfirmPayment };
}

describe("CheckoutDialog", () => {
  it("no celular, o confirmar fica na barra presa ao pé, junto do total", () => {
    const { onConfirmPayment } = renderCheckout(true);

    const confirmar = screen.getAllByRole("button", { name: /Confirmar Pagamento/ });
    expect(confirmar).toHaveLength(1);
    const barra = confirmar[0].parentElement!;
    expect(barra.className).toContain("sticky");
    expect(barra.textContent).toMatch(/Total\s*R\$\s25,00/);

    fireEvent.click(confirmar[0]);
    expect(onConfirmPayment).toHaveBeenCalledTimes(1);
  });

  it("no celular, o valor recebido não abre o teclado sozinho", () => {
    renderCheckout(true);

    const recebido = screen.getByPlaceholderText("R$ 0,00");
    expect(document.activeElement).not.toBe(recebido);
    expect(recebido.getAttribute("inputmode")).toBe("decimal");
  });

  it("no balcão, como sempre: o confirmar no fim da coluna e o recebido com o cursor", () => {
    renderCheckout(false);

    const confirmar = screen.getByRole("button", { name: /Confirmar Pagamento/ });
    expect(confirmar.parentElement!.className).not.toContain("sticky");
    expect(document.activeElement).toBe(screen.getByPlaceholderText("R$ 0,00"));
  });
});
