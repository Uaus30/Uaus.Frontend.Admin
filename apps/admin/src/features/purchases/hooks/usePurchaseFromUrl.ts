import { useEffect, useRef, useState } from "react";
import { useToast } from "@workspace/ui";
import { getPurchase, type PurchaseDto } from "@workspace/api-client-react";
import { purchaseIdFromSearch, syncPurchaseDetailParam } from "../purchases-route";

/** O id pedido na URL. Lido UMA vez: o link é instrução de chegada, não estado vivo. */
function pedidoInicialDaUrl(): number | null {
  if (typeof window === "undefined") return null;
  return purchaseIdFromSearch(window.location.search);
}

type UsePurchaseFromUrlParams = {
  /** Abre a modal da compra — em edição ou em leitura, conforme a situação. */
  abrirCompra: (purchase: PurchaseDto) => void;
};

/**
 * Abre a tela de Compras já com a modal de UMA compra: `/estoque/compras?compra=12`.
 *
 * É o link que se copia da barra de endereços para mandar a compra a alguém.
 * Quem clica na linha vê a URL ganhar o parâmetro (`usePurchaseForm.openEdit`);
 * quem chega pela URL cai na mesma modal. A compra é buscada pelo id, e não
 * procurada na lista: ela pode estar em outra página, ou fora do filtro padrão
 * — "Não lançadas" esconde a lançada, e um link para uma compra lançada tem
 * que abrir do mesmo jeito (em leitura).
 *
 * Se o id não existir, a URL é limpa e a tela avisa; a lista continua
 * utilizável. Mesmo desenho do `useNewPurchaseFromUrl`, vizinho de arquivo.
 */
export function usePurchaseFromUrl({ abrirCompra }: UsePurchaseFromUrlParams): void {
  const [pedido] = useState(pedidoInicialDaUrl);
  const jaAbriu = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    if (pedido === null || jaAbriu.current) return;
    jaAbriu.current = true;

    let cancelado = false;

    (async () => {
      try {
        const compra = await getPurchase(pedido);
        if (cancelado) return;
        abrirCompra(compra);
      } catch {
        if (cancelado) return;
        syncPurchaseDetailParam(null);
        toast({
          title: "Compra não encontrada",
          description: `O link pedia a compra ${pedido}, que não existe ou foi excluída.`,
          variant: "destructive",
        });
      }
    })();

    return () => {
      cancelado = true;
    };
    // `abrirCompra` é declaração de função do hook de formulário (estável).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido, toast]);
}
