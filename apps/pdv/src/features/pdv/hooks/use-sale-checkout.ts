import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { CompanySettingsDto, PaymentMethodDto } from "@workspace/api-client-react";
import { describeApiError, formatCurrency, round2 } from "@workspace/core";
import { useToast } from "@workspace/ui";
import { usePdvStore } from "@/stores/use-pdv-store";
import type { CheckoutState } from "@/hooks/use-checkout";
import type { CashRegisterMode } from "@/lib/cash-register-mode";
import { LocalStockError, newClientReference, registerSale, updateSale } from "@/services/sales.service";
import { buildSalePayload } from "../lib/build-sale-payload";
import { buildSaleReceipt } from "../lib/build-sale-receipt";
import type { SavedSale } from "../types";
import { useReceiptPrinter } from "./use-receipt-printer";

/** O que a tela precisa entregar para o checkout conseguir gravar a venda. */
export interface UseSaleCheckoutParams {
  /** Formas escolhidas, valor recebido e troco — o estado do diálogo. */
  checkout: CheckoutState;
  /** Formas de pagamento em uso (API ou base local), com parcelas e taxas. */
  paymentMethods: PaymentMethodDto[];
  /** Nome de cada forma por ID, para o cupom. */
  paymentMethodNameById: Record<number, string>;
  /** Total da venda, já com os descontos de item e o desconto global. */
  total: number;
  /** Sessão de caixa aberta, ou `null`. */
  sessionId: number | null;
  /** O que as configurações da loja mudam no controle de caixa. */
  mode: CashRegisterMode;
  online: boolean;
  /** A base local existe neste navegador (sem ela não há venda offline). */
  hasLocalDatabase: boolean;
  operatorName: string;
  companySettings: CompanySettingsDto;
  /** Recarrega histórico e resumo — só faz sentido quando a venda chegou ao servidor. */
  onSaleRecorded: () => Promise<void> | void;
  /** Venda encerrada: limpar a busca do balcão. */
  onSaleFinished: () => void;
  /** Devolve o cursor à busca, depois que a impressão sai do caminho. */
  focusSearch: () => void;
}

/**
 * Confirmação do pagamento: valida, grava a venda e emite o cupom.
 *
 * ## O caminho da venda
 *
 * Com conexão, a venda vai inteira para a API numa requisição atômica. Sem
 * conexão, entra na fila local e o cupom sai com número provisório. Os dois
 * caminhos debitam o estoque local, então a venda seguinte já enxerga o saldo
 * certo. Uma reedição regrava a mesma venda e **exige** conexão — não há como
 * atualizar na fila uma venda que só existe no servidor.
 *
 * ## Ponto de extensão: CRUD de Cupom
 *
 * O cupom é montado por `lib/build-sale-receipt.ts`, uma função pura que recebe
 * a venda gravada e o carrinho. É ali que o CRUD de Cupom entra: o `ReceiptData`
 * devolvido é exatamente o que precisa ser persistido/consultado, e nada depois
 * dele depende de como foi obtido — trocar a montagem local por uma chamada ao
 * serviço de cupom não mexe no fluxo de gravação nem na impressão.
 */
export function useSaleCheckout({
  checkout,
  paymentMethods,
  paymentMethodNameById,
  total,
  sessionId,
  mode,
  online,
  hasLocalDatabase,
  operatorName,
  companySettings,
  onSaleRecorded,
  onSaleFinished,
  focusSearch,
}: UseSaleCheckoutParams) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { sendReceiptToPrinter } = useReceiptPrinter();

  const [savingSale, setSavingSale] = useState(false);

  const status = usePdvStore((state) => state.status);
  const items = usePdvStore((state) => state.items);
  const globalDiscount = usePdvStore((state) => state.globalDiscount);
  const consumer = usePdvStore((state) => state.consumer);
  const editingSaleId = usePdvStore((state) => state.editingSaleId);
  const autoPrintReceipt = usePdvStore((state) => state.autoPrintReceipt);
  const finishSale = usePdvStore((state) => state.finishSale);
  const ensureSaleClientReference = usePdvStore((state) => state.ensureSaleClientReference);

  // O pagamento só é inicializado UMA vez por checkout. Sem o guard, qualquer
  // refetch de /PaymentMethods em segundo plano (foco na janela, reconexão
  // invalidando o cache) trocava a identidade do array `paymentMethods`, o
  // efeito rodava de novo e a seleção do operador (cartão, parcelas, divisão,
  // valor recebido) era silenciosamente trocada pela primeira forma da lista.
  const checkoutInitializedRef = useRef(false);

  // Setters de useState têm identidade estável, então declará-los nas deps
  // satisfaz o exhaustive-deps sem reintroduzir o disparo extra que o objeto
  // `checkout` inteiro causaria (ele é recriado a cada render).
  const { setPayments, setSplitPayment, setAmountReceived } = checkout;

  useEffect(() => {
    if (status !== "CHECKOUT") {
      // Saiu do checkout: o próximo abre zerado de novo.
      checkoutInitializedRef.current = false;
      return;
    }

    if (checkoutInitializedRef.current || paymentMethods.length === 0) return;
    checkoutInitializedRef.current = true;

    setPayments([{ paymentMethodId: paymentMethods[0].id, amount: round2(total), installmentNumber: 1 }]);
    setSplitPayment(false);
    setAmountReceived("");
  }, [status, paymentMethods, total, setPayments, setSplitPayment, setAmountReceived]);

  /**
   * Grava a venda com as formas de pagamento escolhidas.
   *
   * As três recusas do começo são checagens de tela: o servidor recusaria as
   * mesmas coisas, mas depois de o operador ter clicado em confirmar com o
   * cliente esperando. A montagem do payload (e o porquê de cada campo) está em
   * `lib/build-sale-payload.ts`.
   */
  const confirmPayment = useCallback(async () => {
    const { payments, receivedAmount, change } = checkout;

    if (mode.saleRequiresSession && !sessionId) {
      toast({
        title: "Caixa fechado",
        description: "Abra o caixa para registrar vendas.",
        variant: "destructive",
      });
      return;
    }
    if (editingSaleId && !online) {
      toast({ title: "Sem conexão para editar", variant: "destructive" });
      return;
    }
    if (!online && !hasLocalDatabase) {
      toast({ title: "Base local indisponível", variant: "destructive" });
      return;
    }

    const payload = buildSalePayload({
      sessionId,
      consumer,
      globalDiscount,
      items,
      payments,
      paymentMethods,
      paymentMethodNameById,
    });

    setSavingSale(true);
    try {
      // Os dois caminhos são normalizados no mesmo formato para que o cupom e o
      // aviso não precisem se ramificar: a reedição devolve o `SaleDto` da API, o
      // registro devolve o resultado do PDV (que pode ter ficado na fila).
      const saved: SavedSale = editingSaleId
        ? await updateSale(editingSaleId, payload).then((sale) => ({
            receiptNumber: sale.id as number | string,
            createdAt: sale.createdAt,
            total: sale.total,
            notes: sale.notes,
            customerDocument: sale.customerDocument ?? null,
            offline: false,
          }))
        : await registerSale(payload, {
            offline: !online,
            // A chave é do CHECKOUT, não da tentativa: gerada no primeiro
            // clique e reutilizada nas retentativas, para que um reenvio após
            // um 502/504 (com a venda já gravada no servidor) seja reconhecido
            // como duplicado em vez de virar uma segunda venda. `finishSale`
            // e o descarte da venda é que a liberam.
            clientReference: ensureSaleClientReference(newClientReference),
          }).then((sale) => ({
            receiptNumber: sale.receiptNumber,
            createdAt: sale.occurredAt,
            total: sale.total,
            notes: sale.notes,
            customerDocument: null as string | null,
            offline: sale.offline,
          }));

      // Uma venda que ficou na fila não mudou nada no servidor; recarregar o
      // histórico ali só geraria requisição condenada a falhar.
      if (!saved.offline) {
        await onSaleRecorded();
        await queryClient.invalidateQueries({ queryKey: ["pdv-products"] });
      }

      toast({
        title: saved.offline
          ? "Venda registrada offline"
          : editingSaleId
            ? "Venda atualizada!"
            : "Venda finalizada!",
        description: saved.offline
          ? `Cupom ${saved.receiptNumber} — ${formatCurrency(saved.total)}. Sobe para o servidor quando a conexão voltar.`
          : `Venda #${saved.receiptNumber} — ${formatCurrency(saved.total)}`,
        duration: saved.offline ? 6000 : 3000,
        className: saved.offline
          ? "bg-amber-500 text-amber-950 border-none"
          : "bg-emerald-500 text-white border-none",
      });

      // ─── Ponto de extensão: CRUD de Cupom ───────────────────────────────
      // A venda já existe daqui para baixo. O cupom é um artefato dela, e é
      // este objeto que o futuro CRUD vai gravar e reler.
      const receipt = buildSaleReceipt({
        saved,
        items,
        payments,
        paymentMethodNameById,
        globalDiscount,
        operatorName,
        consumerDocument: consumer.document,
        receivedAmount,
        change,
        isReedition: Boolean(editingSaleId),
        companySettings,
      });

      finishSale();
      setPayments([]);
      setAmountReceived("");
      onSaleFinished();

      // Sem await: a caixa de impressão é modal e não pode segurar o botão de
      // finalizar, que já pode liberar para a próxima venda. O cursor volta para
      // a busca quando a impressão sai do caminho.
      if (autoPrintReceipt) void sendReceiptToPrinter(receipt).then(focusSearch);
      else focusSearch();
    } catch (error) {
      // A venda offline foi recusada pela conferência da base local. A mesma regra
      // vale no servidor, então deixar passar só adiaria o "não" para a
      // sincronização — com o cliente já fora da loja.
      if (error instanceof LocalStockError) {
        toast({
          title: "Estoque insuficiente na base local",
          description: error.shortages
            .map((item) => `${item.productName}: pedido ${item.requested}, disponível ${item.available}`)
            .join(" · "),
          variant: "destructive",
          duration: 8000,
        });
        return;
      }

      toast({
        title: "Não foi possível registrar a venda",
        description: describeApiError(error),
        variant: "destructive",
        duration: 6000,
      });
    } finally {
      setSavingSale(false);
    }
  }, [
    autoPrintReceipt,
    checkout,
    companySettings,
    consumer,
    editingSaleId,
    ensureSaleClientReference,
    finishSale,
    focusSearch,
    globalDiscount,
    hasLocalDatabase,
    items,
    mode,
    onSaleFinished,
    onSaleRecorded,
    online,
    operatorName,
    paymentMethodNameById,
    paymentMethods,
    queryClient,
    sendReceiptToPrinter,
    sessionId,
    setAmountReceived,
    setPayments,
    toast,
  ]);

  return {
    /** A gravação está em andamento — o diálogo de checkout trava o botão. */
    savingSale,
    confirmPayment,
  };
}
