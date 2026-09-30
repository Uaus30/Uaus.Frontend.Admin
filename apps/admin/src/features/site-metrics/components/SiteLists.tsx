import type { ReactNode } from "react";
import { Link } from "wouter";
import { Card } from "@workspace/ui";
import type {
  SiteMetricsIpDto,
  SiteMetricsPageDto,
  SiteMetricsProductDto,
  SiteMetricsSourceDto,
  SiteMetricsTotalsDto,
} from "@workspace/api-client-react";
import { describePath, formatCount, formatDuration, formatShare } from "../lib/site-metrics";

function ListCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="border-border/60 p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mb-3 text-xs text-muted-foreground">{description}</p>
      {children}
    </Card>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-xs text-muted-foreground">{children}</p>;
}

/** Linha "rótulo … número", com uma barra proporcional ao maior da lista. */
function Row({ label, value, max, extra }: { label: ReactNode; value: number; max: number; extra?: string }) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <li className="relative overflow-hidden rounded-md px-2 py-1.5 text-sm">
      <span className="absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${width}%` }} aria-hidden />
      <span className="relative flex items-center justify-between gap-3">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 tabular-nums">
          {formatCount(value)}
          {extra && <span className="ml-2 text-xs text-muted-foreground">{extra}</span>}
        </span>
      </span>
    </li>
  );
}

/**
 * O funil da visita: entrou → abriu um produto → clicou em reservar. É a
 * pergunta de conversão do site, e a razão de o botão de reserva ser contado.
 */
export function SiteFunnel({ period }: { period: SiteMetricsTotalsDto }) {
  const steps = [
    { label: "Visitas", value: period.sessions },
    { label: "Abriram um produto", value: period.sessionsWithProduct },
    { label: "Clicaram em reservar", value: period.sessionsWithReserve },
  ];
  return (
    <ListCard title="Funil" description="Das visitas do período, quantas chegaram a cada passo">
      <ul className="space-y-1">
        {steps.map((s) => (
          <Row
            key={s.label}
            label={s.label}
            value={s.value}
            max={period.sessions}
            extra={formatShare(s.value, period.sessions)}
          />
        ))}
      </ul>
    </ListCard>
  );
}

export function SitePages({ pages }: { pages: SiteMetricsPageDto[] }) {
  const max = Math.max(0, ...pages.map((p) => p.views));
  return (
    <ListCard
      title="Páginas mais vistas"
      description="Aberturas no período e tempo típico com a página visível"
    >
      {pages.length === 0 ? (
        <Empty>Sem páginas no período.</Empty>
      ) : (
        <ul className="space-y-1">
          {pages.map((p) => (
            <Row
              key={p.path}
              label={describePath(p.path)}
              value={p.views}
              max={max}
              extra={formatDuration(p.medianVisibleMs)}
            />
          ))}
        </ul>
      )}
    </ListCard>
  );
}

export function SiteProducts({ products }: { products: SiteMetricsProductDto[] }) {
  const max = Math.max(0, ...products.map((p) => p.views));
  return (
    <ListCard title="Produtos mais vistos" description="Aberturas do detalhe e cliques em reservar">
      {products.length === 0 ? (
        <Empty>Nenhum produto aberto no período.</Empty>
      ) : (
        <ul className="space-y-1">
          {products.map((p) => (
            <Row
              key={p.productGroupId}
              label={
                <Link href={`/produtos/${p.productGroupId}/detalhes`} className="hover:underline">
                  {p.name}
                </Link>
              }
              value={p.views}
              max={max}
              extra={p.reserveClicks > 0 ? `${formatCount(p.reserveClicks)} reserva(s)` : undefined}
            />
          ))}
        </ul>
      )}
    </ListCard>
  );
}

export function SiteSources({
  sources,
  searches,
}: {
  sources: SiteMetricsSourceDto[];
  searches: SiteMetricsSourceDto[];
}) {
  const maxSources = Math.max(0, ...sources.map((s) => s.sessions));
  const maxSearches = Math.max(0, ...searches.map((s) => s.sessions));
  return (
    <ListCard
      title="De onde vieram"
      description="UTM da divulgação quando há; senão o site de origem; 'direto' é link digitado, favorito ou WhatsApp sem UTM"
    >
      {sources.length === 0 ? (
        <Empty>Sem visitas no período.</Empty>
      ) : (
        <ul className="space-y-1">
          {sources.map((s) => (
            <Row key={s.source} label={s.source} value={s.sessions} max={maxSources} />
          ))}
        </ul>
      )}
      {searches.length > 0 && (
        <>
          <h4 className="mt-4 mb-1 text-xs font-semibold text-muted-foreground uppercase">O que buscaram</h4>
          <ul className="space-y-1">
            {searches.map((s) => (
              <Row key={s.source} label={`“${s.source}”`} value={s.sessions} max={maxSearches} />
            ))}
          </ul>
        </>
      )}
    </ListCard>
  );
}

/**
 * Os IPs que mais apareceram. É a lista para achar abuso: um IP com centenas
 * de eventos e uma sessão só não é gente. O IP fica 90 dias nos eventos; em
 * período mais antigo a lista vem vazia.
 */
export function SiteIps({ ips }: { ips: SiteMetricsIpDto[] }) {
  return (
    <ListCard
      title="IPs que mais apareceram"
      description="Eventos e visitas por IP no período; o IP é guardado por 90 dias"
    >
      {ips.length === 0 ? (
        <Empty>Sem IPs no período.</Empty>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-1 font-medium">IP</th>
              <th className="pb-1 text-right font-medium">Eventos</th>
              <th className="pb-1 text-right font-medium">Visitas</th>
            </tr>
          </thead>
          <tbody>
            {ips.map((ip) => (
              <tr key={ip.ip} className="border-t border-border/40" title={ip.lastUserAgent ?? undefined}>
                <td className="py-1 font-mono text-xs">{ip.ip}</td>
                <td className="py-1 text-right tabular-nums">{formatCount(ip.events)}</td>
                <td className="py-1 text-right tabular-nums">{formatCount(ip.sessions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ListCard>
  );
}
