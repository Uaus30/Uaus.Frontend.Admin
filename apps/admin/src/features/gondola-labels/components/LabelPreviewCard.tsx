import Barcode from "react-barcode";
import { resolveBarcodeFormat } from "../barcode";
import { formatLabelPrice } from "../print";
import { getLabelTypeInfo, type PrintableLabel } from "../types";

/**
 * Réplica em tela de uma etiqueta impressa (proporção ~92mm × 32mm): nome em
 * caixa alta no topo, código de barras à esquerda e preço grande à direita,
 * com o fundo do tipo (branca, amarela ou vermelha).
 */
export function LabelPreviewCard({ label }: { label: PrintableLabel }) {
  const info = getLabelTypeInfo(label.labelType);

  return (
    <div
      className="relative flex h-28 flex-col justify-between overflow-hidden rounded-lg border border-border/60 px-3 py-2 shadow-sm"
      style={{ background: info.background, color: info.foreground }}
    >
      {label.quantity > 1 && (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-black/75 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
          ×{label.quantity}
        </span>
      )}

      <div className="line-clamp-2 px-4 text-center text-[11px] font-extrabold uppercase leading-tight">
        {label.productName}
      </div>

      <div className="flex items-end justify-between gap-2">
        <div className="flex min-h-8 items-end overflow-hidden">
          {label.barcode ? (
            <Barcode
              value={label.barcode}
              format={resolveBarcodeFormat(label.barcode)}
              height={26}
              width={1.1}
              fontSize={9}
              margin={0}
              background="transparent"
            />
          ) : (
            <span className="text-[9px] font-medium text-black/50">sem código de barras</span>
          )}
        </div>

        <div className="flex items-baseline gap-0.5 whitespace-nowrap">
          <span className="text-xs font-extrabold">R$</span>
          <span className="text-3xl font-black leading-none tracking-tight">
            {formatLabelPrice(label.price)}
          </span>
        </div>
      </div>
    </div>
  );
}
