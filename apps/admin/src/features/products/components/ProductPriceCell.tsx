import React, { useState } from "react";
import { Input } from "@workspace/ui";
import { ShelfPriceView } from "@/components/shelf-price";
import type { ProductTableRow } from "../types";

/**
 * O preço de TABELA editável direto na célula — a correção de preço é a operação
 * mais frequente da listagem (ver `useProductTable`).
 *
 * `struck` é a linha do "De" de uma promoção (05/10/2026): o campo continua
 * editando o preço de tabela, menor e riscado, porque o preço que o cliente paga
 * agora é o promocional logo abaixo. O risco some no foco — riscado é leitura,
 * não edição.
 */
export function CurrencyInputInline({
  value,
  onSave,
  disabled,
  struck = false,
}: {
  value: number;
  onSave: (val: number) => void;
  disabled?: boolean;
  struck?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  // O rascunho do que se digita. Fora do foco o campo mostra `value` direto; o
  // rascunho nasce do valor atual a cada foco — sem efeito para "sincronizar"
  // com o valor de fora.
  const [localValue, setLocalValue] = useState(value.toFixed(2).replace(".", ","));

  const handleBlurOrEnter = () => {
    setFocused(false);
    const numericValue = Number(localValue.replace(",", "."));
    if (!isNaN(numericValue) && numericValue !== value) {
      onSave(numericValue);
    } else {
      setLocalValue(value.toFixed(2).replace(".", ","));
    }
  };

  const aparencia = struck
    ? "h-6 w-16 text-[11px] text-muted-foreground line-through focus:no-underline focus:text-foreground"
    : "h-8 w-20 font-medium text-orange-500";

  return (
    <Input
      type="text"
      inputMode="decimal"
      aria-label={struck ? "Preço de tabela (sem a promoção)" : "Preço de venda"}
      value={focused ? localValue : value.toFixed(2).replace(".", ",")}
      disabled={disabled}
      onChange={(e) => {
        let val = e.target.value;
        val = val.replace(/\./g, ",");
        val = val.replace(/[^\d,]/g, "");
        const parts = val.split(",");
        if (parts.length > 2) {
          val = parts[0] + "," + parts.slice(1).join("");
        }
        setLocalValue(val);
      }}
      onFocus={() => {
        setLocalValue(value.toFixed(2).replace(".", ","));
        setFocused(true);
      }}
      onBlur={handleBlurOrEnter}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      className={`${aparencia} bg-transparent border-transparent hover:border-border/50 focus:bg-background focus:border-border px-1.5 text-left shadow-none focus-visible:ring-1 focus-visible:ring-primary/30`}
    />
  );
}

type ProductPriceCellProps = {
  product: ProductTableRow;
  onUpdatePrice?: (product: ProductTableRow, newPrice: number) => Promise<void>;
  updatingPriceId?: number | null;
  /** O botão "Variações", que abre a lista aninhada — só no grupo com variações. */
  variationsToggle?: React.ReactNode;
};

/**
 * A célula de preço da listagem: o preço com a promoção que vale agora e, no
 * produto simples, a edição rápida do preço de tabela.
 *
 * No grupo com variações o preço é o de UMA delas (a de maior id) e não se edita
 * aqui; o rótulo "Variações" abre a lista com o de cada uma.
 */
export function ProductPriceCell({
  product,
  onUpdatePrice,
  updatingPriceId,
  variationsToggle,
}: ProductPriceCellProps) {
  const shelf = product.shelf ?? { kind: "regular" as const, price: product.price };

  if (product.productGroup?.hasVariations) {
    return (
      <div className="flex flex-col">
        <ShelfPriceView shelf={shelf} />
        {variationsToggle}
      </div>
    );
  }

  return (
    <ShelfPriceView
      shelf={shelf}
      // O campo edita SEMPRE o preço de tabela (`product.price`), esteja ele na
      // linha principal ou no "De" de uma promoção.
      renderReferencePrice={(_, struck) => (
        <span className="flex items-center gap-1">
          <span className={struck ? "line-through" : "text-orange-500 font-semibold"}>R$</span>
          <CurrencyInputInline
            value={product.price}
            onSave={(newPrice) => onUpdatePrice?.(product, newPrice)}
            disabled={updatingPriceId === product.id}
            struck={struck}
          />
        </span>
      )}
    />
  );
}
