import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ClipboardList } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import type { SupplierDto } from "@workspace/api-client-react";
import { getProductById } from "@/services/products.service";
import { useStockCount } from "@/features/inventory-count/hooks/useStockCount";
import { StockCountModal } from "@/features/inventory-count/components/StockCountModal";

type ProductStockCountButtonProps = {
  /** A variação aberta na aba — a contagem é do SKU, não do grupo. */
  productId: number;
  /** Nome composto da variação, para a modal dizer QUAL está sendo contada. */
  productName: string;
  barcode: string | null;
  suppliers: SupplierDto[];
  /**
   * Abre a contagem sozinha, uma vez, assim que a aba monta. É o atalho do PDV
   * (`?corrigir=1`): o caixa recusou "sem estoque" e quem clicou quer corrigir,
   * não ver a lista de entradas.
   */
  autoOpen?: boolean;
  /** Avisa quem pediu a abertura automática que ela aconteceu. */
  onAutoOpened?: () => void;
};

/**
 * "Corrigir estoque" da aba Estoque do produto (fase 3 do plano de 14/10/2026).
 *
 * É a mesma contagem do menu da linha na listagem — mesmo endpoint, mesmo
 * `useStockCount`, mesma modal. Ela tinha saído desta aba em 23/09/2026, quando a
 * listagem virou o único lugar dela; voltou com o nome do menu, a pedido do dono,
 * para estar onde o estoque do produto já está à vista.
 *
 * **O saldo é relido a cada abertura**, pelo mesmo motivo da listagem
 * (`useProductListStockCount`): a prévia promete o documento, e o servidor
 * calcula a diferença com o saldo DELE. O da aba pode ter ficado velho com uma
 * venda no PDV enquanto a tela estava aberta. A modal só libera com uma leitura
 * terminada DEPOIS do clique.
 */
export function ProductStockCountButton({
  productId,
  productName,
  barcode,
  suppliers,
  autoOpen = false,
  onAutoOpened,
}: ProductStockCountButtonProps) {
  const queryClient = useQueryClient();
  // A mesma chave da aba e da contagem: a leitura é uma só no cache.
  const productQuery = useQuery({
    queryKey: ["product-for-entry", productId],
    queryFn: () => getProductById(productId),
  });
  /** Quando a contagem abriu. Leitura anterior a isto não vale para ela. */
  const [openedAt, setOpenedAt] = useState(0);

  const fresh =
    productQuery.data !== undefined &&
    productQuery.dataUpdatedAt >= openedAt &&
    !productQuery.isFetching &&
    !productQuery.isError;
  const currentStock = fresh ? (productQuery.data?.stock ?? null) : null;
  // Sem o saldo não há contagem: a saída é ler de novo, e não esperar para sempre.
  const loadFailed = productQuery.isError && !productQuery.isFetching;
  const count = useStockCount(productId, currentStock);

  function open() {
    setOpenedAt(Date.now());
    void queryClient.invalidateQueries({ queryKey: ["product-for-entry", productId] });
    // Fornecedor e custo em branco: o servidor herda os do último lote.
    count.openCount(null, null);
  }

  // Uma vez só: fechar a modal e trocar de variação não a reabre (quem pediu
  // também desliga o pedido, para valer depois de trocar de aba e voltar).
  const autoOpened = useRef(false);
  useEffect(() => {
    if (!autoOpen || autoOpened.current) return;
    autoOpened.current = true;
    open();
    onAutoOpened?.();
    // `open` muda a cada render; o que decide é a montagem com o pedido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  return (
    <>
      <Button type="button" variant="outline" onClick={open} className="gap-2 hover-elevate">
        <ClipboardList className="h-4 w-4" /> Corrigir estoque
      </Button>
      <StockCountModal
        count={count}
        productName={productName}
        barcode={barcode}
        currentStock={currentStock}
        suppliers={suppliers}
        ready={currentStock !== null}
        header={
          loadFailed ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <p>
                  Não foi possível ler o saldo deste produto.{" "}
                  {describeApiError(productQuery.error, "Confira a conexão e tente de novo.")}
                </p>
                <Button type="button" size="sm" variant="outline" onClick={open}>
                  Tentar de novo
                </Button>
              </div>
            </div>
          ) : undefined
        }
      />
    </>
  );
}
