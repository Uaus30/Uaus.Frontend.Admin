import { useQueryClient } from "@tanstack/react-query";
import type { CashRegisterSessionDto, CashRegisterSessionSummaryDto, SaleDto } from "@workspace/api-client-react";
import { CheckoutDialog } from "@/components/checkout-dialog";
import { DiscountDialog } from "@/components/discount-dialog";
import { SalesHistoryDialog } from "@/components/sales-history-dialog";
import { HeldSalesDialog } from "@/components/held-sales-dialog";
import { StockWriteOffDialog } from "@/components/stock-write-off-dialog";
import { OpenCashRegisterDialog, CloseCashRegisterDialog } from "@/components/cash-register-dialogs";
import { PerformanceDialog } from "@/components/performance-dialog";
import { usePdvStore } from "@/stores/use-pdv-store";
import type { CheckoutState } from "@/hooks/use-checkout";
import type { CashRegisterMode } from "@/lib/cash-register-mode";
import type { PdvDialogs as PdvDialogControls } from "../hooks/use-pdv-dialogs";
import type { useSaleHistoryActions } from "../hooks/use-sale-history-actions";
import { ConfirmDiscardDialog } from "./confirm-discard-dialog";
import { PreferencesDialog } from "./preferences-dialog";

type PdvDialogsProps = {
  dialogs: PdvDialogControls;
  checkout: CheckoutState;
  /** Uma venda está sendo gravada — o botão de confirmar trava. */
  savingSale: boolean;
  onConfirmPayment: () => void;
  /** Ações sobre vendas já registradas, vindas de `useSaleHistoryActions`. */
  history: ReturnType<typeof useSaleHistoryActions>;
  /** Sessão de caixa e o que o fechamento precisa saber. */
  register: {
    mode: CashRegisterMode;
    session: CashRegisterSessionDto | null;
    sessionId: number | null;
    summary: CashRegisterSessionSummaryDto | null;
    loadingSession: boolean;
    sales: SaleDto[];
    loadingSales: boolean;
    /** Vendas guardadas localmente, avisadas no histórico. */
    queuedSalesCount: number;
    onOpenRegister: (openingBalance: number, notes: string) => Promise<boolean>;
    onCloseRegister: (countedAmount: number, notes?: string) => Promise<unknown>;
    onLeaveWithoutSession: () => void;
    isCloseOpen: boolean;
    setCloseOpen: (open: boolean) => void;
  };
  /** Relatório do turno, acionado de dentro do histórico. */
  report: { printingReport: boolean; printReport: () => Promise<void> };
  /** Venda retomada da fila de espera. */
  onHeldSaleResumed: Parameters<typeof HeldSalesDialog>[0]["onResumed"];
  /** O store pausou uma venda para abrir espaço na fila. */
  onHeldToMakeRoom: () => void;
};

/**
 * Todos os modais do PDV, num lugar só.
 *
 * Eles ficam fora do fluxo da tela — nenhum ocupa espaço até ser aberto —, mas
 * espalhados pelo corpo da página escondiam o layout de verdade (cabeçalho,
 * busca, carrinho) no meio de duzentas linhas de diálogo.
 *
 * O que dá para ler do store é lido aqui, e não recebido por prop: assim uma
 * mudança de carrinho re-renderiza este bloco, e não a tela inteira.
 */
export function PdvDialogs({
  dialogs,
  checkout,
  savingSale,
  onConfirmPayment,
  history,
  register,
  report,
  onHeldSaleResumed,
  onHeldToMakeRoom,
}: PdvDialogsProps) {
  const queryClient = useQueryClient();

  const status = usePdvStore((state) => state.status);
  const items = usePdvStore((state) => state.items);
  const globalDiscount = usePdvStore((state) => state.globalDiscount);
  const consumer = usePdvStore((state) => state.consumer);
  const setConsumer = usePdvStore((state) => state.setConsumer);
  const backToSelling = usePdvStore((state) => state.backToSelling);
  const applyGlobalDiscount = usePdvStore((state) => state.applyGlobalDiscount);
  const applyItemDiscount = usePdvStore((state) => state.applyItemDiscount);
  const subtotal = usePdvStore((state) => state.getSubtotal());
  const total = usePdvStore((state) => state.getTotal());

  return (
    <>
      <CheckoutDialog
        open={status === "CHECKOUT"}
        onOpenChange={(open) => !open && backToSelling()}
        consumer={consumer}
        setConsumer={setConsumer}
        total={total}
        checkout={checkout}
        savingSale={savingSale}
        onConfirmPayment={onConfirmPayment}
      />

      <DiscountDialog
        open={dialogs.discount.open}
        onOpenChange={dialogs.discount.setOpen}
        // Sempre o desconto da venda: o desconto por item é aplicado digitando o
        // preço direto na linha do carrinho, e o modo "item" deste diálogo não
        // tem hoje quem o acione.
        target={{ type: "global" }}
        globalDiscount={globalDiscount}
        items={items}
        subtotal={subtotal}
        applyGlobalDiscount={applyGlobalDiscount}
        applyItemDiscount={applyItemDiscount}
      />

      <SalesHistoryDialog
        open={dialogs.salesHistory.open}
        onOpenChange={dialogs.salesHistory.setOpen}
        queuedSalesCount={register.queuedSalesCount}
        loadingSales={register.loadingSales}
        sales={register.sales}
        busySaleId={history.busySaleId}
        sessionId={register.sessionId}
        printingReport={report.printingReport}
        onPrintSaleReceipt={history.printSaleReceipt}
        onEditSale={history.editSale}
        onCancelSale={history.cancelSale}
        onPrintSalesReport={report.printReport}
      />

      <PreferencesDialog open={dialogs.preferences.open} onOpenChange={dialogs.preferences.setOpen} />

      <ConfirmDiscardDialog
        open={history.isConfirmDiscardOpen}
        onOpenChange={history.setIsConfirmDiscardOpen}
        onConfirm={history.confirmDiscardAndEdit}
      />

      {/* BAIXA DE ESTOQUE — aberta pelo menu, nunca pelo checkout */}
      <StockWriteOffDialog
        open={dialogs.stockWriteOff.open}
        onOpenChange={dialogs.stockWriteOff.setOpen}
        onRegistered={async () => {
          await queryClient.invalidateQueries({ queryKey: ["pdv-products"] });
        }}
      />

      <OpenCashRegisterDialog
        requiresOpenSession={register.mode.requiresOpenSession}
        sessionId={register.sessionId}
        loadingSession={register.loadingSession}
        onOpenRegister={register.onOpenRegister}
        onLogout={register.onLeaveWithoutSession}
      />

      <CloseCashRegisterDialog
        open={register.isCloseOpen}
        onOpenChange={register.setCloseOpen}
        summary={register.summary}
        session={register.session}
        onCloseRegister={register.onCloseRegister}
      />

      <PerformanceDialog open={dialogs.performance.open} onOpenChange={dialogs.performance.setOpen} />

      <HeldSalesDialog
        open={dialogs.heldSales.open}
        onOpenChange={dialogs.heldSales.setOpen}
        onResumed={onHeldSaleResumed}
        onHeldToMakeRoom={onHeldToMakeRoom}
      />
    </>
  );
}
