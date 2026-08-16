import { BadgePercent, Receipt, Ticket, TrendingUp, Undo2, Wallet, type LucideIcon } from "lucide-react";
import { Card, CardContent, Skeleton, cn } from "@workspace/ui";
import { formatCurrency, formatPercentage } from "@workspace/core";
import type { CampaignReportCard } from "../hooks/useCampaignReport";

type CampaignReportCardsProps = {
  cards: CampaignReportCard[];
  isLoading: boolean;
};

/** Ícone de cada indicador. Chave desconhecida cai no ícone genérico de recibo. */
const ICONS: Record<string, LucideIcon> = {
  redemptions: Ticket,
  reversed: Undo2,
  revenue: Wallet,
  profit: TrendingUp,
  averageTicket: Receipt,
  couponDiscount: BadgePercent,
};

/** Formata o valor conforme a natureza do indicador. */
function formatValue(value: number, kind: CampaignReportCard["kind"]): string {
  return kind === "money" ? formatCurrency(value) : value.toLocaleString("pt-BR");
}

/**
 * Um indicador com o denominador embaixo.
 *
 * A hierarquia é deliberada: o número da campanha é o valor grande, o da loja
 * vem menor logo abaixo e a participação fica destacada ao lado. Dar o mesmo
 * peso aos dois faria a leitura virar um jogo de encontrar qual é qual — e é
 * justamente a relação entre eles que a tela existe para mostrar.
 */
function ReportCard({ card }: { card: CampaignReportCard }) {
  const Icon = ICONS[card.key] ?? Receipt;

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {card.label}
          </span>
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground/70" />
        </div>

        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
          <p
            className={cn(
              "text-2xl font-display font-bold tracking-tight tabular-nums",
              card.campaignValue < 0 && "text-destructive",
            )}
          >
            {formatValue(card.campaignValue, card.kind)}
          </p>

          {card.sharePercentage !== null && (
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
              {formatPercentage(card.sharePercentage)} da loja
            </span>
          )}
        </div>

        {card.periodValue !== null ? (
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            <span className="font-medium text-foreground/80">{formatValue(card.periodValue, card.kind)}</span>{" "}
            na loja no mesmo intervalo
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">Sem equivalente na loja</p>
        )}

        {card.note && (
          <p className="mt-2 border-t border-border/40 pt-2 text-[11px] leading-snug text-muted-foreground">
            {card.note}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * CampaignReportCards
 *
 * Os indicadores da campanha com os mesmos números da loja no MESMO intervalo.
 *
 * Sem esse denominador, "a campanha funcionou" é afirmação sem grupo de
 * controle: R$ 18 mil faturados podem ser 15% de um mês bom ou 90% de um mês
 * morto, e os dois casos exigem decisões opostas.
 */
export function CampaignReportCards({ cards, isLoading }: CampaignReportCardsProps) {
  if (isLoading || cards.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton key={index} className="h-[140px] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <ReportCard key={card.key} card={card} />
      ))}
    </div>
  );
}
