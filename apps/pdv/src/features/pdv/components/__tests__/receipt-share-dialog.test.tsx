import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReceiptData } from "@workspace/receipt";
import { useOfflineStore } from "@/stores/use-offline-store";
import { useReceiptShare } from "../../hooks/use-receipt-share";
import { ReceiptShareDialog } from "../receipt-share-dialog";

const RECEIPT: ReceiptData = {
  saleId: 321,
  createdAt: "2026-10-07T15:00:00",
  items: [{ name: "CANECA PORCELANA", quantity: 1, unitPrice: 25 }],
  payments: [{ name: "Pix", amount: 25 }],
  total: 25,
};

describe("ReceiptShareDialog", () => {
  const open = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("open", open);
    useOfflineStore.setState({ online: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    open.mockReset();
    act(() => useReceiptShare.getState().close());
  });

  it("sem pedido, nada na tela", () => {
    render(<ReceiptShareDialog />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("com o telefone do cliente, abre a conversa com ele e leva o comprovante escrito", () => {
    render(<ReceiptShareDialog />);
    act(() => useReceiptShare.getState().show(RECEIPT, "44999990001"));

    expect(screen.getByRole("dialog").textContent).toContain("(44) 99999-0001");

    fireEvent.click(screen.getByRole("button", { name: /Enviar pelo WhatsApp/ }));

    const url = open.mock.calls[0][0] as string;
    expect(url.startsWith("https://wa.me/5544999990001?text=")).toBe(true);
    const text = decodeURIComponent(url.split("text=")[1]);
    expect(text).toContain("Comprovante da venda 321");
    expect(text).toContain("CANECA PORCELANA");
    expect(text).toContain("*TOTAL: R$ 25,00*");
    // Mandou: o diálogo fecha e o caixa segue para a próxima venda.
    expect(useReceiptShare.getState().request).toBeNull();
  });

  it("sem telefone, o WhatsApp pergunta o contato", () => {
    render(<ReceiptShareDialog />);
    act(() => useReceiptShare.getState().show(RECEIPT));

    expect(screen.getByRole("dialog").textContent).toContain("vai perguntar para quem mandar");
    fireEvent.click(screen.getByRole("button", { name: /Enviar pelo WhatsApp/ }));

    expect((open.mock.calls[0][0] as string).startsWith("https://wa.me/?text=")).toBe(true);
  });

  it("sem internet, avisa que a mensagem sai quando a conexão voltar", () => {
    useOfflineStore.setState({ online: false });
    render(<ReceiptShareDialog />);
    act(() => useReceiptShare.getState().show(RECEIPT));

    expect(screen.getByRole("dialog").textContent).toContain("quando a conexão voltar");
  });

  it("'Agora não' fecha sem mandar nada", () => {
    render(<ReceiptShareDialog />);
    act(() => useReceiptShare.getState().show(RECEIPT));

    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));

    expect(open).not.toHaveBeenCalled();
    expect(useReceiptShare.getState().request).toBeNull();
  });
});
