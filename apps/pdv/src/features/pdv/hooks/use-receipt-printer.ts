import { useCallback } from "react";
import { printReceipt, type ReceiptData } from "@workspace/receipt";
import { useToast } from "@workspace/ui";
import { classifyScreen } from "@/hooks/use-pdv-screen";
import { useReceiptShare } from "./use-receipt-share";

/** O que a saída do comprovante precisa saber além do próprio comprovante. */
export interface ReceiptOutputOptions {
  /**
   * Telefone do cliente da venda. No celular, a conversa do WhatsApp abre direto
   * com ele; no balcão não faz diferença.
   */
  customerPhone?: string | null;
}

/**
 * Impressão de cupom que não derruba o fluxo da venda.
 *
 * Quando a impressão é chamada, a venda **já está gravada** — no servidor ou na
 * fila local. Deixar o erro subir faria a tela mostrar "não foi possível
 * registrar a venda" para uma venda que existe, e o operador registraria de
 * novo. Por isso a falha vira aviso com a saída: reimprimir pelo histórico.
 *
 * **No celular, não imprime: oferece o WhatsApp** (decisão do dono, 07/10/2026 —
 * não há impressora, e o comprovante sai só por lá). É aqui, e não em cada
 * chamador, porque são três os lugares que imprimem (o fim da venda, o cartão
 * digital da fidelidade e a reimpressão do histórico), e todos passam por este
 * ponto. A forma da tela é lida na hora do pedido: é ela que diz se há balcão.
 */
export function useReceiptPrinter() {
  const { toast } = useToast();

  const sendReceiptToPrinter = useCallback(
    async (receipt: ReceiptData, options: ReceiptOutputOptions = {}) => {
      if (classifyScreen(window.innerWidth, window.innerHeight) !== "desk") {
        useReceiptShare.getState().show(receipt, options.customerPhone ?? null);
        return;
      }

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
