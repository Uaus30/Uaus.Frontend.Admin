import { Input } from "@workspace/ui";
import type { useProductEditor } from "../../hooks/useProductEditor";
import { useProductForEntry } from "../../hooks/useProductForEntry";
import { describeCostAndStock } from "../../lib/costAndStock";

type ProductCostAndStockProps = {
  editor: ReturnType<typeof useProductEditor>;
};

/**
 * "Último custo" e "Estoque atual" do produto SIMPLES, só para leitura, acima
 * de preço e status (pedido do dono, 23/09/2026) — é com eles na vista que se
 * decide o preço.
 *
 * Os números vêm do servidor a cada abertura, e não do formulário: a aba Estoque
 * lança entradas e a contagem corrige o saldo com a tela aberta, e o formulário
 * carregado na abertura não ficaria sabendo. A consulta é a mesma das entradas
 * e da contagem (`product-for-entry`), que as invalidam ao gravar.
 *
 * Some no grupo com variações, como preço e status: aí cada variação tem os seus.
 */
export function ProductCostAndStock({ editor }: ProductCostAndStockProps) {
  const { form, productEditor } = editor;
  const productId = form.hasVariations ? null : productEditor.id;

  const { data: product, isLoading } = useProductForEntry(productId);

  if (form.hasVariations) return null;

  const valores = isLoading ? { cost: "…", stock: "…" } : describeCostAndStock(product);

  return (
    <>
      <div className="space-y-2">
        <label htmlFor="readonly-last-cost" className="text-sm font-medium">
          Último custo
        </label>
        <Input
          id="readonly-last-cost"
          value={valores.cost}
          readOnly
          className="bg-muted/30 text-muted-foreground cursor-not-allowed"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="readonly-current-stock" className="text-sm font-medium">
          Estoque atual
        </label>
        <Input
          id="readonly-current-stock"
          value={valores.stock}
          readOnly
          className="bg-muted/30 text-muted-foreground cursor-not-allowed"
        />
      </div>
    </>
  );
}
