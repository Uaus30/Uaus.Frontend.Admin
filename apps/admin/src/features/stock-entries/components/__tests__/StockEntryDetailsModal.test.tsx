import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import type { ReceivedPurchaseEntryDto } from "@workspace/api-client-react";
import { StockEntryDetailsModal } from "../StockEntryDetailsModal";

const entryDetails = {
  id: 1081,
  supplierName: "Shopee",
  entryDate: "2026-09-14T00:00:00",
  invoiceNumber: "NF-1",
  total: 62.67,
  canEdit: true,
  canDelete: true,
  items: [
    {
      id: 1,
      productId: 10,
      productName: "CARRINHO CAMINHONETE PICKUP CORES",
      barcode: "100",
      productPrice: 19.9,
      quantity: 20,
      unitCost: 3.13,
      totalCost: 62.67,
      grossTotal: 62.67,
      salePrice: 19.9,
      availableQuantity: 20,
      hasConsumedStock: false,
    },
  ],
} as ReceivedPurchaseEntryDto;

function renderModal(overrides: Partial<ComponentProps<typeof StockEntryDetailsModal>> = {}) {
  const props: ComponentProps<typeof StockEntryDetailsModal> = {
    open: true,
    onOpenChange: vi.fn(),
    selectedEntryId: entryDetails.id,
    entryDetails,
    isLoadingDetails: false,
    formatCurrency: (val: number) => `R$ ${val.toFixed(2).replace(".", ",")}`,
    formatShortDate: () => "14/09/2026",
    onDelete: vi.fn(),
    ...overrides,
  };
  render(<StockEntryDetailsModal {...props} />);
  return props;
}

afterEach(() => cleanup());

describe("StockEntryDetailsModal", () => {
  it("avisa que a compra volta para A caminho antes de cancelar", () => {
    // Desde 14/09/2026 cancelar a entrada devolve a compra que a lançou. Quem
    // cancela está na aba Estoque do produto e não vê a tela de Compras: sem
    // este aviso, a situação de uma compra muda sem ninguém contar.
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: /Cancelar Entrada/i }));

    expect(screen.getByText(/a compra volta para A caminho/i)).toBeTruthy();
  });

  it("não oferece o cancelamento quando parte do lote já saiu, e diz por quê", () => {
    renderModal({ entryDetails: { ...entryDetails, canDelete: false } });

    expect(screen.queryByRole("button", { name: /Cancelar Entrada/i })).toBeNull();
    expect(screen.getByText(/Contagem Física/i)).toBeTruthy();
  });

  describe("Recebimento", () => {
    // A entrada é de um produto só, com as variações dele (23/09/2026): a seção
    // é o recebimento, e não uma lista de "itens recebidos".
    it("se chama Recebimento e leva à compra que lançou a nota, em nova aba", () => {
      renderModal({ entryDetails: { ...entryDetails, purchaseId: 26 } });

      expect(screen.getByRole("heading", { name: "Recebimento" })).toBeTruthy();
      const link = screen.getByRole("link", { name: /Abrir a compra #26/i });
      expect(link.getAttribute("href")).toMatch(/estoque\/compras\?compra=26$/);
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noreferrer");
    });

    it("sem compra, não há link", () => {
      renderModal();

      expect(screen.queryByRole("link", { name: /Abrir a compra/i })).toBeNull();
    });
  });

  describe("correção do custo", () => {
    const ultima = {
      ...entryDetails,
      purchaseId: 26,
      items: [{ ...entryDetails.items[0]!, canEditUnitCost: true, availableQuantity: 15 }],
    } as ReceivedPurchaseEntryDto;

    it("só o item da última entrada oferece o lápis", () => {
      renderModal({ onCorrectUnitCost: vi.fn() });
      expect(screen.queryByRole("button", { name: /Corrigir o custo/i })).toBeNull();

      cleanup();
      renderModal({ entryDetails: ultima, onCorrectUnitCost: vi.fn() });
      expect(screen.getByRole("button", { name: /Corrigir o custo de CARRINHO/i })).toBeTruthy();
    });

    it("pede confirmação dizendo o que muda junto, e só então corrige", async () => {
      const onCorrectUnitCost = vi.fn(() => Promise.resolve());
      renderModal({ entryDetails: ultima, onCorrectUnitCost });

      fireEvent.click(screen.getByRole("button", { name: /Corrigir o custo de CARRINHO/i }));
      fireEvent.change(screen.getByRole("textbox", { name: /Novo custo unitário/i }), {
        target: { value: "1,34" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Confirmar o novo custo" }));

      expect(onCorrectUnitCost).not.toHaveBeenCalled();
      expect(screen.getByText(/As 5 unidades que já saíram desta entrada/)).toBeTruthy();
      expect(screen.getByText(/A compra #26 também não muda/)).toBeTruthy();
      // E o efeito no lucro: (19,90 − 3,13) / 19,90 = 84,27% → (19,90 − 1,34) / 19,90 = 93,27%.
      expect(screen.getByText(/Margem sobre o preço de venda/).textContent).toBe(
        "Margem sobre o preço de venda (R$ 19,90): de 84,27% para 93,27%",
      );
      expect(screen.getByText("93,27%").className).toContain("text-emerald-600");

      fireEvent.click(screen.getByRole("button", { name: "Sim, corrigir o custo" }));

      expect(onCorrectUnitCost).toHaveBeenCalledWith({ entryId: 1081, itemId: 1, unitCost: 1.34 });
    });

    it("campo apagado não vira custo zero", () => {
      renderModal({ entryDetails: ultima, onCorrectUnitCost: vi.fn() });

      fireEvent.click(screen.getByRole("button", { name: /Corrigir o custo de CARRINHO/i }));
      fireEvent.change(screen.getByRole("textbox", { name: /Novo custo unitário/i }), {
        target: { value: "" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Confirmar o novo custo" }));

      expect(screen.getByText("Informe o custo unitário.")).toBeTruthy();
      expect(screen.queryByText(/Corrigir o custo desta entrada\?/)).toBeNull();
    });

    it("sem a correção ligada, o lápis fica desligado", () => {
      renderModal({ entryDetails: ultima });

      expect(
        (screen.getByRole("button", { name: /Corrigir o custo de CARRINHO/i }) as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    it("'3.70' digitado com ponto é R$ 3,70, e não R$ 370,00", () => {
      // O caso da JARRA (37,00 por 3,70), digitado no teclado numérico.
      const onCorrectUnitCost = vi.fn(() => Promise.resolve());
      renderModal({ entryDetails: ultima, onCorrectUnitCost });

      fireEvent.click(screen.getByRole("button", { name: /Corrigir o custo de CARRINHO/i }));
      fireEvent.change(screen.getByRole("textbox", { name: /Novo custo unitário/i }), {
        target: { value: "3.70" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Confirmar o novo custo" }));
      fireEvent.click(screen.getByRole("button", { name: "Sim, corrigir o custo" }));

      expect(onCorrectUnitCost).toHaveBeenCalledWith({ entryId: 1081, itemId: 1, unitCost: 3.7 });
    });

    it("Esc no campo desiste da correção sem fechar a nota", () => {
      // O Radix escuta o Esc no documento, antes do campo: sem a modal saber da
      // edição, o Esc de quem desiste fecharia o espelho inteiro.
      const props = renderModal({ entryDetails: ultima, onCorrectUnitCost: vi.fn() });

      fireEvent.click(screen.getByRole("button", { name: /Corrigir o custo de CARRINHO/i }));
      fireEvent.keyDown(screen.getByRole("textbox", { name: /Novo custo unitário/i }), { key: "Escape" });

      expect(props.onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByRole("textbox", { name: /Novo custo unitário/i })).toBeNull();
      expect(screen.getByRole("button", { name: /Corrigir o custo de CARRINHO/i })).toBeTruthy();
    });
  });
});
