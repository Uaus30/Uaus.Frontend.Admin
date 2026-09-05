import { Flame } from "lucide-react";
import { enumCode, STOREFRONT_STOCK_BADGE, type EnumValue } from "@workspace/api-client-react";

interface StockBadgeProps {
  /** `stockBadge` do DTO da vitrine — nome ou código do enum, ou ausente. */
  badge: EnumValue;
  /** `lg` no detalhe, `md` no card. */
  size?: "md" | "lg";
}

/** Rótulo e cor de cada tag. Fora daqui não há "Últimas unidades" escrito em lugar nenhum do site. */
const BADGES: Record<number, { label: string; className: string }> = {
  [STOREFRONT_STOCK_BADGE.LastUnits]: {
    label: "Últimas unidades",
    className: "bg-amber-500 text-white",
  },
  [STOREFRONT_STOCK_BADGE.LastUnit]: {
    label: "Último disponível",
    className: "bg-red-600 text-white",
  },
};

/**
 * Rótulo da tag de escassez, ou `null` quando não há tag. `enumCode` aceita
 * nome e número porque o backend serializa enum como NOME.
 */
function resolveStockBadge(badge: EnumValue): { label: string; className: string } | null {
  return BADGES[enumCode(badge, STOREFRONT_STOCK_BADGE)] ?? null;
}

/**
 * Selo de escassez do site — "Últimas unidades" ou "Último disponível".
 *
 * O site NÃO decide quando mostrar: a tag chega pronta do backend, que compara
 * o saldo somado do grupo com o limiar configurado em Admin > Configurações
 * (zero desliga). A quantidade em estoque nunca chega aqui, de propósito — o
 * DTO público não carrega estoque, e um número na tela viraria "por que diz 3
 * se eu vi 2 na loja?".
 *
 * A reserva por WhatsApp não mexe em estoque; só a venda registrada no PDV
 * mexe. A tag pode ficar defasada até a próxima venda — é apelo comercial, não
 * promessa de disponibilidade.
 */
export function StockBadge({ badge, size = "md" }: StockBadgeProps) {
  const resolved = resolveStockBadge(badge);
  if (!resolved) return null;

  const sizeClass = size === "lg" ? "px-4 py-1.5 text-xs" : "px-3 py-1 text-[10px]";

  return (
    <span
      data-testid="stock-badge"
      className={`inline-flex items-center gap-1 rounded-full font-bold tracking-wide uppercase shadow-sm ${sizeClass} ${resolved.className}`}
    >
      <Flame aria-hidden className={size === "lg" ? "h-3.5 w-3.5" : "h-3 w-3"} />
      {resolved.label}
    </span>
  );
}
