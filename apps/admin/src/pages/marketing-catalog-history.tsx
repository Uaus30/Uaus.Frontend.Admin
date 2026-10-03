import { Button, Card, Spinner } from "@workspace/ui";
import { AlertCircle, History, RefreshCw } from "lucide-react";
import { CatalogHistoryList } from "@/features/marketing-catalog/components/CatalogHistoryList";
import { useCatalogHistory } from "@/features/marketing-catalog/hooks/useCatalogHistory";

/** Histórico do catálogo de divulgação (rota `/marketing/catalogo/historico`). */
export default function MarketingCatalogHistoryPage() {
  const tela = useCatalogHistory();
  const history = tela.history;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
              Histórico do catálogo
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            As peças que saíram do sistema — compartilhadas ou baixadas — e quanto os produtos de cada uma
            venderam antes e depois.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => void tela.refetch()}
          disabled={tela.isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${tela.isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {history && (
        <Card className="space-y-1.5 border-border/60 p-4 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground/85">Como ler.</strong> “Depois” são as unidades vendidas dos
            produtos da peça desde que ela saiu, por até {history.measureDays} dias. “Antes” é o{" "}
            <strong className="text-foreground/85">mesmo trecho da semana anterior</strong> — os mesmos dias
            da semana, para o sábado não ser comparado com a segunda.
          </p>
          <p>
            É uma pista, não uma prova: a conta não separa o efeito da divulgação do dia de pagamento, do
            tempo ou de uma reposição.
          </p>
          <p>
            Quem saiu numa peça descansa por {history.cooldownDays} dias: o sorteio só volta a escolher o
            produto quando faltar outro do mesmo tipo. Peça gerada e não compartilhada não conta.
          </p>
        </Card>
      )}

      {tela.isError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            {tela.error?.message ??
              "Não foi possível carregar o histórico. Verifique a conexão com o servidor e tente novamente."}
          </span>
        </div>
      )}

      {tela.isLoading && (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      )}

      {history && history.pieces.length === 0 && (
        <Card className="border-border/60 p-10 text-center text-sm text-muted-foreground">
          Nenhuma peça saiu ainda. Ela entra aqui quando é compartilhada ou baixada na tela do Catálogo.
        </Card>
      )}

      {history && history.pieces.length > 0 && (
        <CatalogHistoryList pieces={history.pieces} measureDays={history.measureDays} />
      )}
    </div>
  );
}
