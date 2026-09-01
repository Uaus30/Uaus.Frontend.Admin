import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PdvCartActionsCompact, PdvCartActionsExtended } from "../pdv-cart-actions";

function props(overrides: Partial<Parameters<typeof PdvCartActionsCompact>[0]> = {}) {
  return {
    hasItems: true,
    editingSaleId: null,
    blockedWithoutSession: false,
    onCheckout: vi.fn(),
    onDiscount: vi.fn(),
    onCoupon: vi.fn(),
    onHoldSale: vi.fn(),
    onCancelSale: vi.fn(),
    ...overrides,
  };
}

/** Abre a gaveta da engrenagem e devolve o botão que a abriu. */
function openDrawer() {
  const gear = screen.getByTitle("Mais ações da venda");
  fireEvent.click(gear);
  return gear;
}

describe("PdvCartActionsExtended", () => {
  it("deve mostrar os quatro botões secundários sem nenhum clique", () => {
    render(<PdvCartActionsExtended {...props()} />);

    expect(screen.getByRole("button", { name: "DESCONTO" })).toBeDefined();
    expect(screen.getByRole("button", { name: "CUPOM" })).toBeDefined();
    expect(screen.getByRole("button", { name: /PAUSAR/ })).toBeDefined();
    expect(screen.getByRole("button", { name: "CANCELAR VENDA" })).toBeDefined();
  });
});

describe("PdvCartActionsCompact", () => {
  it("deve esconder os quatro botões até a engrenagem ser tocada", () => {
    render(<PdvCartActionsCompact {...props()} />);

    // O finalizar continua à vista: é o que o compacto preserva.
    expect(screen.getByRole("button", { name: "FINALIZAR" })).toBeDefined();
    expect(screen.queryByRole("button", { name: /DESCONTO/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "CANCELAR VENDA" })).toBeNull();

    openDrawer();

    expect(screen.getByRole("button", { name: /DESCONTO/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /CUPOM/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /PAUSAR/ })).toBeDefined();
    expect(screen.getByRole("button", { name: "CANCELAR VENDA" })).toBeDefined();
  });

  it("deve pedir a confirmação em vez de cancelar direto", () => {
    const config = props();
    render(<PdvCartActionsCompact {...config} />);

    openDrawer();
    fireEvent.click(screen.getByRole("button", { name: "CANCELAR VENDA" }));

    // Quem cancela de fato é o painel, depois da confirmação: daqui sai só o pedido.
    expect(config.onCancelSale).toHaveBeenCalledTimes(1);
  });

  it("deve fechar a gaveta pelo x", async () => {
    render(<PdvCartActionsCompact {...props()} />);

    openDrawer();
    fireEvent.click(screen.getByLabelText("Fechar ações da venda"));

    // `waitFor` porque a saída é animada (AnimatePresence): o nó só deixa o DOM
    // quando a animação termina.
    await waitFor(() => expect(screen.queryByRole("button", { name: /DESCONTO/ })).toBeNull());
  });

  it("deve fechar a gaveta ao apontar para fora dela", async () => {
    render(
      <div>
        <PdvCartActionsCompact {...props()} />
        <main data-testid="fora">lista de itens</main>
      </div>,
    );

    openDrawer();
    fireEvent.pointerDown(screen.getByTestId("fora"));

    await waitFor(() => expect(screen.queryByRole("button", { name: /DESCONTO/ })).toBeNull());
  });

  it("deve fechar a gaveta com Escape", async () => {
    // A gaveta cobre o total da venda. Sem o Escape, o operador que a abriu por
    // engano fica sem o número que ele dita para o cliente.
    render(<PdvCartActionsCompact {...props()} />);

    openDrawer();
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("button", { name: /DESCONTO/ })).toBeNull());
  });

  it("não deve oferecer pausar durante a reedição de uma venda", () => {
    // Reedição mexe numa venda que já existe na API; pausá-la deixaria a fila
    // apontando para um registro que pode mudar por fora.
    render(<PdvCartActionsCompact {...props({ editingSaleId: 42 })} />);

    openDrawer();

    expect(screen.getByRole("button", { name: /PAUSAR/ })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "DESCARTAR EDIÇÃO" })).toBeDefined();
  });
});
