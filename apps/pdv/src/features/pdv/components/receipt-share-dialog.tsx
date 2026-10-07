import { CheckCircle2, MessageCircle } from "lucide-react";
import { formatPhone } from "@workspace/core";
import { buildReceiptText, formatReceiptCurrency } from "@workspace/receipt";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui";
import { toWhatsappNumber, whatsappReceiptUrl } from "@/lib/whatsapp";
import { useOfflineStore } from "@/stores/use-offline-store";
import { useReceiptShare } from "../hooks/use-receipt-share";

/**
 * O comprovante no celular: mandar pelo WhatsApp (07/10/2026).
 *
 * No celular não há impressora — decisão do dono: o comprovante sai **só pelo
 * WhatsApp**. Este diálogo aparece onde o balcão imprimiria (fim da venda,
 * cartão fidelidade, reimpressão do histórico; ver `useReceiptPrinter`) e não
 * manda nada sozinho: o operador decide, porque nem toda venda de balcão quer
 * comprovante. Na entrega, em que o cliente não está ali, é o comprovante dele.
 *
 * Com o telefone do cliente da venda, a conversa abre direto com ele; sem, o
 * WhatsApp pergunta o contato. Sem internet o WhatsApp abre do mesmo jeito e
 * guarda a mensagem até a conexão voltar.
 */
export function ReceiptShareDialog() {
  const request = useReceiptShare((state) => state.request);
  const close = useReceiptShare((state) => state.close);
  const online = useOfflineStore((state) => state.online);

  const receipt = request?.receipt;
  const phone = request?.customerPhone ?? null;
  const toCustomer = toWhatsappNumber(phone) !== null;

  const send = () => {
    if (!receipt) return;
    // Nova aba/app, e não navegação: o PDV continua aberto atrás, com a venda
    // seguinte esperando. No app instalado, o sistema entrega ao WhatsApp.
    window.open(whatsappReceiptUrl(buildReceiptText(receipt), phone), "_blank", "noopener");
    close();
  };

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="border-border bg-card p-6 shadow-2xl sm:max-w-[420px]">
        <DialogTitle className="flex items-center gap-2 text-xl font-display font-bold">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Venda {receipt?.saleId}
        </DialogTitle>
        <DialogDescription>
          {receipt ? `Total ${formatReceiptCurrency(receipt.total)}.` : ""} Quer mandar o comprovante?
        </DialogDescription>

        <p className="text-sm text-muted-foreground">
          {toCustomer
            ? `Vai para a conversa com ${formatPhone(phone ?? "")}.`
            : "O WhatsApp vai perguntar para quem mandar."}
          {!online && " Sem internet, ele envia quando a conexão voltar."}
        </p>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            onClick={send}
            className="h-12 gap-2 bg-emerald-600 text-base font-bold text-white hover:bg-emerald-700"
          >
            <MessageCircle className="h-5 w-5" /> Enviar pelo WhatsApp
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={close}>
            Agora não
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
