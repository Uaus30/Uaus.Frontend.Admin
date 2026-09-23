import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductEditorDialogs } from "../ProductEditorDialogs";

/** Os diálogos do editor com só a pergunta da primeira foto em jogo. */
function renderDialogs(sitePrompt: { open: boolean; publish: () => void; dismiss: () => void }) {
  render(
    <ProductEditorDialogs
      variationToDelete={null}
      setVariationToDelete={vi.fn()}
      onConfirmDeleteVariation={vi.fn()}
      purchaseConflict={null}
      onGoToConflictingPurchase={vi.fn()}
      onDismissPurchaseConflict={vi.fn()}
      sitePrompt={sitePrompt}
    />,
  );
}

describe("A pergunta da primeira foto nos diálogos do editor", () => {
  it("fechada, não aparece", () => {
    renderDialogs({ open: false, publish: vi.fn(), dismiss: vi.fn() });

    expect(screen.queryByText("Exibir o produto no site?")).toBeNull();
  });

  it("Exibir no site liga o interruptor; Agora não só fecha", () => {
    const publish = vi.fn();
    const dismiss = vi.fn();
    renderDialogs({ open: true, publish, dismiss });

    expect(screen.getByText("Exibir o produto no site?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Exibir no site" }));
    expect(publish).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(dismiss).toHaveBeenCalled();
  });
});
