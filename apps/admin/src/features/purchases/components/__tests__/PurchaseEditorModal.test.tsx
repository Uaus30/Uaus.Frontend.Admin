import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/images.service", () => ({
  createImageFromFile: vi.fn(),
  downloadWebImageAsFile: vi.fn(),
  buildImageProxyUrl: vi.fn((url: string) => url),
}));

const { usePurchaseForm } = await import("../../hooks/usePurchaseForm");
const { PurchaseEditorModal } = await import("../PurchaseEditorModal");

/**
 * O hook de verdade por trás da modal: o que está em teste é o campo
 * controlado reagindo ao estado, e um stub do hook esconderia exatamente isso.
 *
 * A modal abre DURANTE o render, uma vez — num efeito seria o `setState`
 * síncrono que o lint recusa, o mesmo ajuste de `useProductStockEntries`.
 */
function Harness() {
  const form = usePurchaseForm({ onSaved: vi.fn(), suppliers: [] });
  const [opened, setOpened] = useState(false);
  if (!opened) {
    setOpened(true);
    form.openNew();
  }
  return <PurchaseEditorModal form={form} suppliers={[]} />;
}

function renderModal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>,
  );
}

describe("PurchaseEditorModal — campo de quantidade", () => {
  afterEach(() => cleanup());

  it("apagar a quantidade deixa o campo vazio, e o que se digita depois não ganha zero à esquerda", () => {
    renderModal();
    const input = screen.getByLabelText("Quantidade comprada") as HTMLInputElement;
    expect(input.value).toBe("1");

    // Backspace até o fim: o estado vira 0, e 0 é "em branco" — não "0".
    fireEvent.change(input, { target: { value: "" } });
    expect(input.value).toBe("");

    // Digitar "2" e "0" sobre o campo vazio. Sem a regra, o React já teria
    // escrito "0" no campo apagado e o resultado seria "020".
    fireEvent.change(input, { target: { value: `${input.value}2` } });
    fireEvent.change(input, { target: { value: `${input.value}0` } });
    expect(input.value).toBe("20");
  });
});
