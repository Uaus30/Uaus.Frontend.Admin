import { useMemo } from "react";
import { buildLabelBarcodeSvg, formatLabelPrice, getProductNameFontSizePt } from "../print";
import { getLabelTypeInfo, type PrintableLabel } from "../types";

/**
 * Réplica em tela de uma etiqueta impressa (proporção ~95mm × 24mm): nome em
 * caixa alta no topo com tamanho dinâmico, código de barras SVG à esquerda
 * e preço grande à direita, com o fundo do tipo (branca, amarela ou vermelha).
 *
 * O contorno é retângulo de canto vivo igual ao do papel (ver `print.ts`): a
 * borda é a linha de corte, e a prévia só serve se mostrar o que vai sair na
 * impressora. Pelo mesmo motivo, largura das barras e alinhamento pelo centro
 * saem das mesmas constantes e regras do documento impresso.
 */
export function LabelPreviewCard({ label }: { label: PrintableLabel }) {
  const info = getLabelTypeInfo(label.labelType);
  // Mesmo desenho do papel (largura, corpo do número e formato reto).
  const barcodeSvg = useMemo(() => {
    return label.barcode ? buildLabelBarcodeSvg(label.barcode) : null;
  }, [label.barcode]);

  const fontSizePt = getProductNameFontSizePt(label.productName);
  const hasBarcode = Boolean(label.barcode && barcodeSvg);

  return (
    <div
      className="relative flex h-[24mm] flex-col justify-between overflow-hidden border border-[#9a9a9a] px-[3.5mm] py-[1.5mm] shadow-sm select-none"
      style={{ background: info.background, color: info.foreground }}
    >
      {label.quantity > 1 && (
        <span className="absolute right-1.5 top-1.5 z-10 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
          ×{label.quantity}
        </span>
      )}

      <div
        className="line-clamp-2 px-[1mm] text-center uppercase tracking-tight"
        style={{
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontWeight: 900,
          fontSize: `${fontSizePt}pt`,
          lineHeight: 1.05,
          maxHeight: "7.2mm",
        }}
      >
        {label.productName}
      </div>

      <div className={`flex items-center gap-[2mm] ${hasBarcode ? "justify-between" : "justify-center"}`}>
        {hasBarcode && (
          <div className="flex min-w-0 max-w-[50%] shrink items-center overflow-hidden">
            <div
              className="flex min-w-0 items-center [&>svg]:h-[12.6mm] [&>svg]:w-auto [&>svg]:max-w-full"
              dangerouslySetInnerHTML={{ __html: barcodeSvg! }}
            />
          </div>
        )}

        <div
          className="flex shrink-0 items-baseline gap-[0.8mm] whitespace-nowrap"
          style={{ fontFamily: '"Arial Black", Arial, sans-serif', fontWeight: 900 }}
        >
          <span style={{ fontSize: "13pt", fontWeight: 900, lineHeight: 1 }}>R$</span>
          <span
            style={{
              fontSize: "32pt",
              fontWeight: 900,
              letterSpacing: "-0.04em",
              lineHeight: 0.8,
            }}
          >
            {formatLabelPrice(label.price)}
          </span>
        </div>
      </div>
    </div>
  );
}
