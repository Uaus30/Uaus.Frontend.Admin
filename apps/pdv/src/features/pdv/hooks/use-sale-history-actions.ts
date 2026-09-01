import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  apiGet,
  enumCode,
  PAYMENT_STATUS,
  type CompanySettingsDto,
  type ProductDto,
  type SaleDto,
} from "@workspace/api-client-react";
import { buildReceiptFromSale, resolveStoreInfo } from "@workspace/receipt";
import { describeApiError, round2 } from "@workspace/core";
import { useToast } from "@workspace/ui";
import { usePdvStore } from "@/stores/use-pdv-store";
import {
  cancelSale as cancelSaleRequest,
  getSaleItems,
  restoreCancelledSaleStock,
} from "@/services/sales.service";
import type { PdvItem } from "../types";
import { useReceiptPrinter } from "./use-receipt-printer";

export interface UseSaleHistoryActionsParams {
  /** Nome de cada forma de pagamento por ID, para o cupom de vendas antigas. */
  paymentMethodNameById: Record<number, string>;
  companySettings: CompanySettingsDto;
  /** Recarrega o histórico e o resumo do caixa depois de mexer numa venda. */
  onSaleChanged: () => Promise<void> | void;
  /** A venda entrou no carrinho para reedição — a tela fecha o histórico. */
  onSaleLoadedForEditing: () => void;
}

/**
 * As três coisas que o operador faz com uma venda já registrada: cancelar,
 * reimprimir e reabrir para edição.
 *
 * Todas travam a linha da venda (`busySaleId`) enquanto acontecem, porque todas
 * são de ida ao servidor e um duplo clique aqui cancela ou reimprime duas vezes.
 */
export function useSaleHistoryActions({
  paymentMethodNameById,
  companySettings,
  onSaleChanged,
  onSaleLoadedForEditing,
}: UseSaleHistoryActionsParams) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { sendReceiptToPrinter } = useReceiptPrinter();

  const [busySaleId, setBusySaleId] = useState<number | null>(null);
  const [pendingSaleToEdit, setPendingSaleToEdit] = useState<SaleDto | null>(null);
  const [isConfirmDiscardOpen, setIsConfirmDiscardOpen] = useState(false);

  const loadSaleForEditing = usePdvStore((state) => state.loadSaleForEditing);

  /** Cancela uma venda da sessão, devolvendo ao estoque os itens já baixados. */
  const cancelSale = useCallback(
    async (sale: SaleDto) => {
      setBusySaleId(sale.id);
      try {
        await cancelSaleRequest(sale.id, "Cancelada no PDV");

        // O servidor devolveu o estoque dele; a projeção local precisa acompanhar,
        // senão a base local fica subestimada até o próximo snapshot e o PDV
        // recusa venda offline de produto que está na prateleira.
        try {
          await restoreCancelledSaleStock(sale.id);
          await queryClient.invalidateQueries({ queryKey: ["pdv-products"] });
        } catch {
          // A venda foi cancelada; se a devolução local falhar (base indisponível),
          // a projeção se corrige no próximo snapshot.
        }

        await onSaleChanged();
        toast({
          title: "Venda cancelada",
          description: `A venda #${sale.id} foi cancelada e o estoque devolvido.`,
        });
      } catch (error) {
        toast({
          title: "Não foi possível cancelar",
          description: describeApiError(error),
          variant: "destructive",
        });
      } finally {
        setBusySaleId(null);
      }
    },
    [onSaleChanged, queryClient, toast],
  );

  /** Reimprime o cupom de uma venda da sessão, marcado como segunda via. */
  const printSaleReceipt = useCallback(
    async (sale: SaleDto) => {
      setBusySaleId(sale.id);
      try {
        const saleItems = await getSaleItems(sale.id);
        await sendReceiptToPrinter(
          // Sem `operatorName`: a segunda via tem que nomear quem vendeu, e não
          // quem está no caixa agora. O nome sai da própria venda, que é o mesmo
          // caminho da reimpressão pelo painel administrativo — os dois cupons
          // precisam sair idênticos.
          buildReceiptFromSale(sale, saleItems, {
            paymentMethodNameById,
            reprint: true,
            cancelled: enumCode(sale.paymentStatus, PAYMENT_STATUS) === PAYMENT_STATUS.Cancelled,
            // Identidade do cadastro da empresa; campo vazio cai no padrão embutido.
            store: resolveStoreInfo(companySettings),
          }),
        );
      } catch (error) {
        toast({
          title: "Não foi possível montar o cupom",
          description: describeApiError(error),
          variant: "destructive",
        });
      } finally {
        setBusySaleId(null);
      }
    },
    [companySettings, paymentMethodNameById, sendReceiptToPrinter, toast],
  );

  /**
   * Carrega uma venda finalizada de volta no carrinho para reedição,
   * reconstruindo o desconto de cada item.
   */
  const loadSaleToCart = useCallback(
    async (sale: SaleDto) => {
      setBusySaleId(sale.id);
      try {
        const saleItems = await getSaleItems(sale.id);
        const productIds = [...new Set(saleItems.map((item) => item.productId))];
        const products = await Promise.all(
          productIds.map((id) => apiGet<ProductDto>(`/Products/${id}`).catch(() => null)),
        );
        const productById = new Map(products.filter(Boolean).map((p) => [p!.id, p!]));

        const cartItems: PdvItem[] = saleItems.map((item) => {
          const product = productById.get(item.productId);
          // O preço de tabela vem da PRÓPRIA venda (`unitPrice + discount`), não
          // do cadastro atual. Usar o preço de hoje reescrevia o histórico: mudar
          // o preço no admin alterava retroativamente o desconto de uma venda
          // antiga ao reabri-la para edição.
          const originalPriceFromSale = round2(item.unitPrice + (item.discount ?? 0));
          return {
            id: `${item.id}`,
            productId: item.productId,
            name: item.productName || product?.name || `Produto #${item.productId}`,
            barcode: product?.barcode || item.barcode || undefined,
            price: originalPriceFromSale,
            quantity: item.quantity,
            discount: round2(item.discount ?? 0),
            // O estoque atual já não contém as unidades desta venda.
            availableStock: (product?.stock ?? 0) + item.quantity,
            // A foto é do cadastro de hoje, e não da venda: ela não é dado da
            // venda, é como o produto é reconhecido no balcão. Nulo quando o
            // produto não tem foto ou quando a consulta dele falhou — o carrinho
            // mostra o ícone e a reedição segue.
            imageUrl: product?.imageUrl ?? null,
          };
        });

        loadSaleForEditing(sale.id, cartItems, sale.discount);
        onSaleLoadedForEditing();
        toast({
          title: "Venda carregada",
          description: `Editando a venda #${sale.id}. Faça as alterações e finalize.`,
          duration: 3000,
        });
      } catch (error) {
        toast({
          title: "Não foi possível carregar a venda",
          description: describeApiError(error),
          variant: "destructive",
        });
      } finally {
        setBusySaleId(null);
      }
    },
    [loadSaleForEditing, onSaleLoadedForEditing, toast],
  );

  /**
   * Inicia a edição de uma venda.
   *
   * Com carrinho em andamento a edição não pode simplesmente entrar por cima: o
   * operador perderia os itens já bipados sem aviso. Daí a confirmação.
   */
  const editSale = useCallback(
    (sale: SaleDto) => {
      if (usePdvStore.getState().items.length > 0) {
        setPendingSaleToEdit(sale);
        setIsConfirmDiscardOpen(true);
        return;
      }
      void loadSaleToCart(sale);
    },
    [loadSaleToCart],
  );

  /** Descarta o carrinho atual e carrega a venda escolhida para edição. */
  const confirmDiscardAndEdit = useCallback(() => {
    if (pendingSaleToEdit) {
      void loadSaleToCart(pendingSaleToEdit);
      setPendingSaleToEdit(null);
    }
    setIsConfirmDiscardOpen(false);
  }, [loadSaleToCart, pendingSaleToEdit]);

  return {
    /** Venda com operação em andamento; a linha dela fica travada na lista. */
    busySaleId,
    cancelSale,
    printSaleReceipt,
    editSale,
    /** Confirmação de descarte do carrinho antes de abrir uma venda para edição. */
    isConfirmDiscardOpen,
    setIsConfirmDiscardOpen,
    confirmDiscardAndEdit,
  };
}
