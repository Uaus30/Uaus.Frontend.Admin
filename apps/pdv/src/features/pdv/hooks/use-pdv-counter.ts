import { useCallback, useEffect, useRef } from "react";
import type { ProductPdvSearchDto } from "@workspace/api-client-react";
import { formatCurrency } from "@workspace/core";
import { useToast } from "@workspace/ui";
import { usePdvStore, type HeldSale } from "@/stores/use-pdv-store";
import type { CheckoutState } from "@/hooks/use-checkout";
import { useProductSearch } from "./use-product-search";

export interface UsePdvCounterParams {
  online: boolean;
  /** Sessão de caixa aberta; abrir o caixa devolve o cursor para a busca. */
  sessionId: number | null;
  /** Estado do checkout, zerado ao pausar ou retomar uma venda. */
  checkout: CheckoutState;
}

/**
 * O balcão: buscar produto, colocar no carrinho, pausar e retomar a venda.
 *
 * O fio condutor destas ações é o **cursor**. O caixa é operado com leitor de
 * código de barras, que digita no campo que estiver focado — se o foco escapa
 * para outro lugar, o próximo bipe some (ou pior, entra num campo de preço). Por
 * isso todo caminho que encerra uma venda passa por aqui e devolve o cursor.
 */
export function usePdvCounter({ online, sessionId, checkout }: UsePdvCounterParams) {
  const { toast } = useToast();
  const addItem = usePdvStore((state) => state.addItem);
  const holdSaleInStore = usePdvStore((state) => state.holdSale);

  const searchInputRef = useRef<HTMLInputElement>(null);

  /** Devolve o cursor para a busca de produtos, onde o leitor de código digita. */
  const focusSearch = useCallback(() => searchInputRef.current?.focus(), []);

  /**
   * Adiciona o produto ao carrinho recusando produto zerado ou quantidade
   * acima do estoque disponível.
   *
   * O saldo consultado é o do **store**, e não o do render: entre a busca e o
   * clique o operador pode ter adicionado o mesmo produto pelo leitor.
   */
  const addProductToCart = useCallback(
    (product: ProductPdvSearchDto) => {
      if (product.stock <= 0) {
        toast({
          title: "Produto sem estoque",
          description: `${product.name} está zerado no estoque e não pode ser vendido.`,
          variant: "destructive",
        });
        return;
      }

      const inCart = usePdvStore.getState().items.find((i) => i.productId === product.id);
      if (inCart && inCart.quantity + 1 > product.stock) {
        toast({
          title: "Estoque insuficiente",
          description: `Só há ${product.stock} unidade(s) de ${product.name}.`,
          variant: "destructive",
        });
        return;
      }

      addItem({
        productId: product.id,
        name: product.name,
        barcode: product.barcode,
        price: product.price,
        quantity: 1,
        discount: 0,
        availableStock: product.stock,
      });

      toast({ title: "Item adicionado", description: `${product.name} no carrinho.`, duration: 1500 });
    },
    [addItem, toast],
  );

  /**
   * Busca do balcão. O produto bipado vai direto para o carrinho; a busca vazia
   * vira aviso — com texto diferente offline, porque ali "não encontrei" quase
   * sempre quer dizer "a base local está velha".
   */
  const search = useProductSearch({
    online,
    onExactBarcodeMatch: addProductToCart,
    onEmptyResult: (term) =>
      toast({
        title: "Produto não encontrado",
        description: online
          ? `Nenhum produto encontrado para "${term}".`
          : `Nenhum produto com "${term}" na base local. Verifique no badge OFFLINE se o catálogo foi baixado.`,
        variant: "destructive",
        duration: 4000,
      }),
  });

  /**
   * Foco no campo de busca só ao abrir o PDV — e, no fim de cada venda, pelos
   * caminhos que chamam `focusSearch`. Refocar a cada mudança de carrinho
   * roubava o cursor de quem estava editando a quantidade ou o preço de um item.
   */
  useEffect(() => {
    if (!sessionId) return;
    focusSearch();
  }, [sessionId, focusSearch]);

  const { setPayments, setAmountReceived } = checkout;

  /** Zera as formas escolhidas; a venda que estava no checkout deixou de existir. */
  const resetCheckoutFields = useCallback(() => {
    setPayments([]);
    setAmountReceived("");
  }, [setAmountReceived, setPayments]);

  /** Guarda a venda em andamento na fila de espera e libera o caixa. */
  const holdSale = useCallback(() => {
    const held = holdSaleInStore();
    if (!held) return;

    resetCheckoutFields();
    search.clear();

    toast({
      title: "Venda pausada",
      description: `${formatCurrency(held.total)} guardados em espera. Retome pelo botão no topo da tela.`,
      duration: 3000,
    });
  }, [holdSaleInStore, resetCheckoutFields, search, toast]);

  /** Volta uma venda em espera para o carrinho. O carrinho vem do próprio store. */
  const handleHeldSaleResumed = useCallback(
    (held: HeldSale) => {
      resetCheckoutFields();
      search.clear();

      toast({
        title: "Venda retomada",
        description: `${held.items.length} ${held.items.length === 1 ? "item" : "itens"} de volta no carrinho.`,
        duration: 3000,
      });
    },
    [resetCheckoutFields, search, toast],
  );

  return {
    search,
    searchInputRef,
    focusSearch,
    addProductToCart,
    holdSale,
    handleHeldSaleResumed,
    resetCheckoutFields,
  };
}
