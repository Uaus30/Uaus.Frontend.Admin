import { useEffect, useRef, useState } from "react";
import { useToast } from "@workspace/ui";
import { getProductById } from "@/services/products.service";
import { NEW_PURCHASE_PRODUCT_PARAM } from "../purchases-route";

/** Parâmetro opcional: fornecedor que já vem escolhido no formulário. */
const PARAM_FORNECEDOR = "fornecedor";

/** Número inteiro positivo, ou `null` — ids nunca são outra coisa. */
function idValido(bruto: string | null): number | null {
  if (bruto === null) return null;
  const id = Number(bruto);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** O que a URL pede. Lido UMA vez: a instrução é de uma vez só. */
type PedidoDaUrl = { productId: number; supplierId: number | null } | null;

function pedidoInicialDaUrl(): PedidoDaUrl {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const productId = idValido(params.get(NEW_PURCHASE_PRODUCT_PARAM));
  if (productId === null) return null;

  return { productId, supplierId: idValido(params.get(PARAM_FORNECEDOR)) };
}

/** Tira os parâmetros da barra de endereços, preservando o resto. */
function limparUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(NEW_PURCHASE_PRODUCT_PARAM);
  url.searchParams.delete(PARAM_FORNECEDOR);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

type UseNewPurchaseFromUrlParams = {
  /** Abre o formulário de compra já preenchido. */
  abrirCompra: (dados: {
    productId: number;
    productName: string;
    productBarcode: string | null;
    supplierId: number | null;
    quantity: number;
  }) => void;
};

/**
 * Abre a tela de Compras com o pedido de reposição já começado.
 *
 * É o caminho do "Resolver" do relatório de estoque baixo: resolver um alerta é
 * **registrar a compra**, não apenas apagar o vermelho. O link traz o produto e
 * o último fornecedor (`/estoque/compras?produto=10&fornecedor=13`), e a tela
 * completa o resto.
 *
 * **A quantidade nasce sugerida como o que recompõe o mínimo**
 * (`minStock - stock`, no mínimo 1). É palpite, não regra: quem compra ajusta.
 * Deixar 1 seria quase sempre errado numa reposição, e deixar vazio jogaria a
 * conta de volta para quem já sabe o que quer.
 *
 * Os parâmetros saem da barra de endereços assim que são consumidos — o link é
 * instrução de uma vez só; sem isso, fechar o formulário e recarregar reabriria
 * tudo.
 */
export function useNewPurchaseFromUrl({ abrirCompra }: UseNewPurchaseFromUrlParams): void {
  const [pedido] = useState(pedidoInicialDaUrl);
  const jaAbriu = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    if (pedido === null || jaAbriu.current) return;
    jaAbriu.current = true;

    let cancelado = false;

    (async () => {
      try {
        const produto = await getProductById(pedido.productId);
        if (cancelado) return;

        limparUrl();

        if (!produto) {
          toast({
            title: "Produto não encontrado",
            description: "O id da URL não corresponde a nenhum produto.",
            variant: "destructive",
          });
          return;
        }

        abrirCompra({
          productId: produto.id,
          productName: produto.displayName || produto.name,
          productBarcode: produto.barcode || null,
          supplierId: pedido.supplierId,
          quantity: Math.max(1, (produto.minStock ?? 0) - (produto.stock ?? 0)),
        });
      } catch {
        if (cancelado) return;
        limparUrl();
        toast({
          title: "Não foi possível abrir a compra",
          description: "Tente registrar o pedido manualmente.",
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
