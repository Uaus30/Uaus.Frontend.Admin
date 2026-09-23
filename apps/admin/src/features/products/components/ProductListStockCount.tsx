import { AlertTriangle } from "lucide-react";
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { StockCountModal } from "@/features/inventory-count/components/StockCountModal";
import type { useProductListStockCount } from "../hooks/useProductListStockCount";

type ProductListStockCountProps = {
  state: ReturnType<typeof useProductListStockCount>;
};

/**
 * A modal da contagem aberta pela listagem: a mesma da aba Estoque, com a
 * escolha da variação por cima quando o grupo tem mais de uma.
 *
 * A lista de variações mostra só o nome, sem o saldo: o saldo da linha pode
 * estar velho, e o que vale — o do servidor — aparece logo abaixo assim que a
 * variação é escolhida. Dois números diferentes para o mesmo SKU, na mesma
 * modal, fariam a pessoa duvidar da conta que está fazendo.
 */
export function ProductListStockCount({ state }: ProductListStockCountProps) {
  const picker =
    state.variationChoices.length > 0 ? (
      <div className="space-y-1.5">
        <Label htmlFor="contagem-variacao">Variação</Label>
        <Select
          value={state.pickedVariationId !== null ? String(state.pickedVariationId) : ""}
          onValueChange={(value) => state.pickVariation(Number(value))}
        >
          <SelectTrigger id="contagem-variacao" className="h-9">
            <SelectValue placeholder="Escolha a variação que você contou" />
          </SelectTrigger>
          <SelectContent>
            {state.variationChoices.map((variation) => (
              <SelectItem key={variation.id} value={String(variation.id)}>
                {variation.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    ) : null;

  // Vermelho: sem o saldo não há contagem possível, e a saída é tentar de novo.
  const loadError = state.loadError ? (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <p>Não foi possível ler o saldo deste produto. {state.loadError}</p>
        <Button type="button" size="sm" variant="outline" onClick={state.retryLoad}>
          Tentar de novo
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <StockCountModal
      count={state.count}
      productName={state.productName}
      barcode={state.barcode}
      currentStock={state.currentStock}
      suppliers={state.suppliers}
      header={
        picker || loadError ? (
          <>
            {picker}
            {loadError}
          </>
        ) : undefined
      }
      ready={state.ready}
    />
  );
}
