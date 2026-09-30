import type { ComponentType } from "react";
import { Clock, Eye, Globe, MessageCircle, Radio, Users } from "lucide-react";
import { Card } from "@workspace/ui";
import type { SiteMetricsTotalsDto } from "@workspace/api-client-react";
import { formatCount, formatDuration, formatShare } from "../lib/site-metrics";

type TileProps = {
  label: string;
  value: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  /** Destaque do "agora": pulsa para dizer que o número está vivo. */
  live?: boolean;
};

function Tile({ label, value, hint, icon: Icon, live }: TileProps) {
  return (
    <Card className="border-border/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        <div
          className={`rounded-lg p-1.5 ${live ? "bg-emerald-500/15 text-emerald-500" : "bg-primary/10 text-primary"}`}
        >
          <Icon className={`h-4 w-4 ${live ? "animate-pulse" : ""}`} />
        </div>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

type SiteKpisProps = {
  today: SiteMetricsTotalsDto;
  period: SiteMetricsTotalsDto;
  periodLabel: string;
  activeVisitors: number;
  /** Totais vindos da soma das linhas diárias — visitantes e sessões não são distintos. */
  periodIsSummed: boolean;
};

/**
 * A primeira dobra: "tem alguém agora?", "como foi hoje?" e "como foi o
 * período?". Visitantes e IPs distintos aparecem lado a lado de propósito:
 * o dono pediu IPs, e a diferença entre os dois é a régua de quanto o IP
 * engana (celular no 4G troca de IP; uma família inteira sai com um).
 */
export function SiteKpis({ today, period, periodLabel, activeVisitors, periodIsSummed }: SiteKpisProps) {
  const somado = periodIsSummed ? " (soma dos dias)" : "";

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        label="No site agora"
        value={formatCount(activeVisitors)}
        hint="visitantes com atividade nos últimos 30 min"
        icon={Radio}
        live={activeVisitors > 0}
      />
      <Tile
        label="Hoje"
        value={formatCount(today.visitors)}
        hint={`${formatCount(today.sessions)} visitas · ${formatCount(today.pageViews)} páginas · ${formatCount(today.distinctIps)} IPs`}
        icon={Users}
      />
      <Tile
        label={`Visitantes · ${periodLabel}`}
        value={formatCount(period.visitors)}
        hint={`${formatCount(period.sessions)} visitas · ${formatCount(period.distinctIps)} IPs distintos${somado}`}
        icon={Globe}
      />
      <Tile
        label="Tempo por visita"
        value={formatDuration(period.medianSessionMs)}
        hint="mediana do tempo com a página visível"
        icon={Clock}
      />
      <Tile
        label="Páginas vistas"
        value={formatCount(period.pageViews)}
        hint={`${formatCount(period.productViews)} produtos abertos · ${formatCount(period.searches)} buscas`}
        icon={Eye}
      />
      <Tile
        label="Reservas pelo WhatsApp"
        value={formatCount(period.reserveClicks)}
        hint={`${formatShare(period.sessionsWithReserve, period.sessions)} das visitas chegaram ao botão`}
        icon={MessageCircle}
      />
      <Tile
        label="Contato"
        value={formatCount(period.contactClicks)}
        hint="cliques nos WhatsApps de contato"
        icon={MessageCircle}
      />
      <Tile
        label="Celular"
        value={formatShare(period.mobileSessions, period.sessions)}
        hint={`${formatCount(period.mobileSessions)} no celular · ${formatCount(period.desktopSessions)} no computador · ${formatCount(period.tabletSessions)} em tablet`}
        icon={Users}
      />
    </div>
  );
}
