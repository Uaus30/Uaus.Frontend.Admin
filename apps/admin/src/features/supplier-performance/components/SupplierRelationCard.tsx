import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card } from "@workspace/ui";
import { formatCurrency, formatPhone } from "@workspace/core";
import type { SupplierDetailDto } from "@workspace/api-client-react";
import { formatDaysAgo, formatInteger, formatIsoDate, formatPercent, plural } from "../lib/format";

type SupplierRelationCardProps = {
  detail: SupplierDetailDto;
};

/**
 * A relação comercial: ritmo de compra, ficha do cadastro e o alerta de
 * reajuste.
 *
 * A previsão da próxima compra é o intervalo MÉDIO entre notas menos os dias
 * desde a última. É estimativa grosseira de propósito — serve para responder
 * "está na hora?", não para agendar.
 */
export function SupplierRelationCard({ detail }: SupplierRelationCardProps) {
  const { summary, contact } = detail;

  const proximaCompra =
    summary.averagePurchaseIntervalDays != null && summary.daysWithoutBuying != null
      ? Math.max(0, summary.averagePurchaseIntervalDays - summary.daysWithoutBuying)
      : null;

  const linhas: Array<[string, string]> = [
    ["Compras em 12 meses", formatInteger(summary.purchaseCountLastYear)],
    ["Investido em 12 meses", formatCurrency(summary.purchaseTotalLastYear)],
    [
      "Última compra",
      summary.lastPurchaseDate
        ? `${formatIsoDate(summary.lastPurchaseDate)} (${formatDaysAgo(summary.daysWithoutBuying)})`
        : "—",
    ],
    [
      "Intervalo médio entre compras",
      summary.averagePurchaseIntervalDays != null
        ? `${formatInteger(summary.averagePurchaseIntervalDays)} dias`
        : "—",
    ],
    [
      "Próxima compra prevista",
      proximaCompra == null ? "—" : proximaCompra === 0 ? "agora" : `em ~${proximaCompra} dias`,
    ],
    [
      "Compra mínima",
      contact.minimumPurchaseValue > 0 ? formatCurrency(contact.minimumPurchaseValue) : "sem mínimo",
    ],
    ["Vendedor", contact.salesRepresentative || "não informado"],
    ["Contato", contact.phone ? formatPhone(contact.phone) : contact.email || "não informado"],
    ["Cidade/UF", [contact.city, contact.state].filter(Boolean).join("/") || "não informado"],
  ];

  return (
    <Card className="border-border/60 p-5">
      <h2 className="text-[14.5px] font-semibold">Relação comercial</h2>

      <dl className="mt-3 flex flex-col gap-2 text-[12.5px]">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{rotulo}</dt>
            <dd className="text-right font-semibold text-foreground/80">{valor}</dd>
          </div>
        ))}
      </dl>

      {summary.repricedProducts > 0 && summary.averageCostIncreasePercent != null ? (
        <div className="mt-4 flex gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>{plural(summary.repricedProducts, "produto subiu", "produtos subiram")}</strong> de custo
            na última compra — média de +{formatPercent(summary.averageCostIncreasePercent, 0)}. Vale revisar
            o preço de venda ou renegociar.
          </span>
        </div>
      ) : (
        <div className="mt-4 flex gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-xs leading-relaxed text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Nenhum reajuste de custo relevante na última compra.</span>
        </div>
      )}
    </Card>
  );
}
