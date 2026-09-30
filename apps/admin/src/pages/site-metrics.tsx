import { AlertCircle, RefreshCw } from "lucide-react";
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@workspace/ui";
import { useSiteMetrics } from "@/features/site-metrics/hooks/useSiteMetrics";
import { SiteKpis } from "@/features/site-metrics/components/SiteKpis";
import { SiteDailyChart } from "@/features/site-metrics/components/SiteDailyChart";
import {
  SiteFunnel,
  SiteIps,
  SitePages,
  SiteProducts,
  SiteSources,
} from "@/features/site-metrics/components/SiteLists";
import { formatFullDate, SITE_PERIODS, type SitePeriodDays } from "@/features/site-metrics/lib/site-metrics";

/**
 * BI › Site.
 *
 * Responde, nesta ordem, as perguntas do dono: tem alguém no site agora? Como
 * foi hoje? Quantos vieram no período, de quantos IPs, por quanto tempo, o que
 * viram e quantos chegaram ao botão de reservar? A tela se atualiza sozinha a
 * cada minuto. A regra de negócio está no README da feature.
 */
export default function SiteMetricsPage() {
  const tela = useSiteMetrics();
  const overview = tela.overview;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[27px] font-semibold tracking-tight">Site</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {tela.periodLabel}
            </span>
            {overview && (
              <span className="text-[13px] text-muted-foreground">
                {formatFullDate(overview.startDate)} a {formatFullDate(overview.endDate)} · atualiza a cada
                minuto
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex w-44 flex-col gap-1.5">
            <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Período
            </Label>
            <Select
              value={String(tela.days)}
              onValueChange={(v) => tela.setDays(Number(v) as SitePeriodDays)}
            >
              <SelectTrigger className="h-10 w-full bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SITE_PERIODS.map((p) => (
                  <SelectItem key={p.days} value={String(p.days)}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={() => void tela.refetch()}
            title="Atualizar agora"
          >
            <RefreshCw className={`h-4 w-4 ${tela.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {tela.isError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{tela.error?.message ?? "Não foi possível carregar as métricas do site."}</span>
        </div>
      )}

      {tela.isLoading && (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      )}

      {overview && (
        <>
          <SiteKpis
            today={overview.today}
            period={overview.period}
            periodLabel={tela.periodLabel}
            activeVisitors={overview.activeVisitors}
            periodIsSummed={overview.periodFromDailyRows}
          />

          <SiteDailyChart series={tela.series} periodLabel={tela.periodLabel} />

          {overview.periodFromDailyRows && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Acima de 30 dias os totais são a soma dos dias (um visitante que voltou em dois dias conta duas
              vezes), e IPs e buscas não são listados. Páginas, produtos e origens vêm da consolidação diária.
            </p>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            <SiteFunnel period={overview.period} />
            <SiteSources sources={overview.sources} searches={overview.topSearches} />
            <SitePages pages={overview.topPages} />
            <SiteProducts products={overview.topProducts} />
            {!overview.periodFromDailyRows && (
              <div className="lg:col-span-2">
                <SiteIps ips={overview.topIps} />
              </div>
            )}
          </div>

          <p className="mt-2 border-t border-dashed border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground/80">Visitante</strong> é o navegador (um id anônimo guardado
            nele); <strong className="text-foreground/80">visita</strong> é uma sessão, que termina depois de
            30 minutos com o site fechado ou em segundo plano. O tempo conta só enquanto a página está visível
            e a pessoa interage — a aba esquecida no celular não entra. Quem visita com{" "}
            <code>?semmetricas</code> na URL desliga a contagem no próprio navegador; use isso para não contar
            a equipe.
          </p>
        </>
      )}
    </div>
  );
}
