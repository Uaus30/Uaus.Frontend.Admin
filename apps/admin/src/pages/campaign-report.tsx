import { AlertTriangle, ArrowLeft, BarChart3, Megaphone, RefreshCw } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { AppLayout } from "@/components/layout";
import { Button, cn } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { useCampaignReport } from "@/features/campaigns/hooks/useCampaignReport";
import { CampaignReportCards } from "@/features/campaigns/components/campaign-report-cards";
import { CampaignReportDailyChart } from "@/features/campaigns/components/campaign-report-daily-chart";
import { CampaignReportQuestionsChart } from "@/features/campaigns/components/campaign-report-questions-chart";
import { CampaignReportAnswersTable } from "@/features/campaigns/components/campaign-report-answers-table";
import { CampaignReportCouponsTable } from "@/features/campaigns/components/campaign-report-coupons-table";

/**
 * Página de Relatório de uma Campanha.
 *
 * Página fina: todo o estado vive em `useCampaignReport`; aqui ficam o layout, a
 * leitura do id da rota e os estados de carregamento e erro.
 *
 * Não há filtro de período de propósito — o recorte é sempre o intervalo da
 * campanha. Deixar o usuário recortar produziria faturamento de campanha sem
 * denominador correspondente (o cupom continua valendo depois que a campanha
 * fecha, §5.5 do contrato) e a participação passaria de 100% da loja sem
 * explicação. Recorte por período é assunto do comparativo.
 */
export default function CampaignReportPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  // Id inválido na URL não vira consulta: `useGetCampaignReport` fica desligado
  // com `undefined`, e a tela mostra o aviso em vez de pedir `/campaigns/NaN/report`.
  const parsedId = Number(id);
  const campaignId = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : undefined;

  const {
    report,
    cards,
    daily,
    hasDailyMovement,
    windowLabel,
    questions,
    coupons,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useCampaignReport(campaignId);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="hover-elevate border border-border bg-card"
              onClick={() => setLocation("/marketing/campanhas")}
              aria-label="Voltar para as campanhas"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Megaphone className="h-6 w-6 text-primary" />
                <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
                  {report?.campaignName ?? "Relatório da campanha"}
                </h1>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {windowLabel ||
                  "O que a campanha moveu, contra o que a loja fez no mesmo intervalo."}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 hover-elevate"
              onClick={() => setLocation("/marketing/campanhas/comparativo")}
            >
              <BarChart3 className="h-4 w-4" /> Comparar campanhas
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              title="Atualizar dados"
              className="hover-elevate"
              disabled={!campaignId}
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
          </div>
        </div>

        {!campaignId ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-foreground">Campanha não informada.</p>
            <p className="text-sm text-muted-foreground">
              Abra o relatório pela lista de campanhas.
            </p>
          </div>
        ) : isError ? (
          /*
            Falha na consulta substitui o conteúdo: sem este estado, os skeletons
            dos indicadores ficariam girando para sempre (o relatório nunca chega).
          */
          <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-foreground">
              Não foi possível carregar o relatório da campanha.
            </p>
            <p className="text-sm text-muted-foreground">
              {describeApiError(error, "Campanha não encontrada.")}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            <CampaignReportCards cards={cards} isLoading={isLoading} />

            <CampaignReportDailyChart
              daily={daily}
              hasMovement={hasDailyMovement}
              windowLabel={windowLabel}
              isLoading={isLoading}
            />

            <CampaignReportQuestionsChart questions={questions} isLoading={isLoading} />

            {/* As tabelas só aparecem com o dado em mãos: um esqueleto de tabela
                vazia sugere colunas que talvez nem existam neste relatório. */}
            {!isLoading && (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <CampaignReportAnswersTable questions={questions} />
                <CampaignReportCouponsTable coupons={coupons} />
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
