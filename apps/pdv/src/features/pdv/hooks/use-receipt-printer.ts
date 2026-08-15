import { useCallback } from "react";
import { printReceipt, type ReceiptData } from "@workspace/receipt";
import { useToast } from "@workspace/ui";

/**
 * Impressão de cupom que não derruba o fluxo da venda.
 *
 * Quando a impressão é chamada, a venda **já está gravada** — no servidor ou na
 * fila local. Deixar o erro subir faria a tela mostrar "não foi possível
 * registrar a venda" para uma venda que existe, e o operador registraria de
 * novo. Por isso a falha vira aviso com a saída: reimprimir pelo histórico.
 */
export function useReceiptPrinter() {
  const { toast } = useToast();

  const sendReceiptToPrinter = useCallback(
    async (receipt: ReceiptData) => {
      try {
        await printReceipt(receipt);
      } catch {
        toast({
          title: "Não foi possível abrir a impressão",
          description: `A venda #${receipt.saleId} foi gravada. Reimprima o cupom pelo histórico.`,
          variant: "destructive",
          duration: 6000,
        });
      }
    },
    [toast],
  );

  return { sendReceiptToPrinter };
}
