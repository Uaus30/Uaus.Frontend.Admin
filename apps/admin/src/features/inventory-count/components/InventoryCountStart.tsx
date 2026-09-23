import { ClipboardCheck, Camera, Layers, PackageSearch, Play, RotateCcw, Snowflake } from "lucide-react";
import { Button, Card, CardContent, Spinner } from "@workspace/ui";
import { formatDate } from "@workspace/core";
import type { InventoryCountDto, InventoryCountStartMode } from "@workspace/api-client-react";

type InventoryCountStartProps = {
  /** Ainda perguntando ao servidor se existe conferência aberta. */
  isLoading: boolean;
  /** A última rodada encerrada; `null` quando nunca houve conferência. */
  lastCount: InventoryCountDto | null;
  onStart: (mode: InventoryCountStartMode) => void;
  /** A rodada sendo aberta; `null` fora da abertura. */
  startingMode: InventoryCountStartMode | null;
};

/**
 * O convite a começar — o que a aba mostra enquanto NÃO há conferência aberta.
 *
 * Explica antes de oferecer o botão, e o mais importante vem em destaque:
 * **com a conferência aberta, o estoque fica congelado** (decisão do dono,
 * 23/09/2026) — o PDV não vende, e entradas, baixas e cancelamentos ficam
 * pausados até o encerramento. Quem clica precisa saber disso antes de parar
 * o balcão, não depois.
 *
 * Por isso a conferência é feita em RODADAS curtas. Quando a última rodada
 * deixou pendentes, a tela oferece continuar de onde ela parou — só os que
 * faltam — ou recomeçar com o catálogo inteiro.
 */
export function InventoryCountStart({
  isLoading,
  lastCount,
  onStart,
  startingMode,
}: InventoryCountStartProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const pendentes = lastCount?.pendingItems ?? 0;
  const podeContinuar = lastCount !== null && pendentes > 0;
  // Os dois travam, mas só o clicado mostra o andamento.
  const isStarting = startingMode !== null;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="flex flex-col items-center gap-6 px-6 py-12 text-center">
        <span className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
          <ClipboardCheck className="h-10 w-10 text-primary" />
        </span>

        <div className="max-w-2xl space-y-2">
          <h2 className="font-display text-2xl font-bold text-foreground">
            Nenhuma conferência em andamento
          </h2>
          <p className="text-sm text-muted-foreground">
            A conferência monta a lista do que precisa ser revisado — um item por cadastro. Cada produto sai
            da lista quando é marcado como conferido.
          </p>
        </div>

        {/* Âmbar: não é erro, é "atenção antes de clicar" — parar o balcão é consequência real. */}
        <div className="flex max-w-2xl items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-800 dark:text-amber-200">
          <Snowflake className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>O estoque fica congelado enquanto a conferência estiver aberta:</strong> o PDV não vende,
            e entradas, baixas e cancelamentos de venda ficam pausados até você encerrar. Faça em rodadas
            curtas — o que faltar continua na próxima.
          </p>
        </div>

        <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-3">
          <Objetivo
            icon={<Camera className="h-4 w-4" />}
            title="Foto certa"
            description="Produto sem imagem não aparece direito no site nem no PDV."
          />
          <Objetivo
            icon={<Layers className="h-4 w-4" />}
            title="Variações certas"
            description="Grade, cor e tamanho conferidos no cadastro do produto."
          />
          <Objetivo
            icon={<PackageSearch className="h-4 w-4" />}
            title="Estoque real"
            description="A contagem física lança sozinha a entrada ou a baixa da diferença."
          />
        </div>

        {podeContinuar && lastCount && (
          <p className="text-sm text-muted-foreground">
            A última rodada, encerrada em {formatDate(lastCount.finishedAt ?? lastCount.startedAt)}, conferiu{" "}
            <strong className="text-foreground">{lastCount.reviewedItems}</strong> de {lastCount.totalItems}{" "}
            cadastros e deixou <strong className="text-amber-600 dark:text-amber-400">{pendentes}</strong>{" "}
            pendentes.
          </p>
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {podeContinuar && (
              <Button
                onClick={() => onStart("Continue")}
                disabled={isStarting}
                className="hover-elevate gap-2"
                size="lg"
              >
                {startingMode === "Continue" ? <Spinner className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                Continuar de onde parou ({pendentes})
              </Button>
            )}
            <Button
              onClick={() => onStart("Restart")}
              disabled={isStarting}
              variant={podeContinuar ? "outline" : "default"}
              className="hover-elevate gap-2"
              size="lg"
            >
              {startingMode === "Restart" ? (
                <Spinner className="h-4 w-4" />
              ) : podeContinuar ? (
                <RotateCcw className="h-4 w-4" />
              ) : (
                <ClipboardCheck className="h-4 w-4" />
              )}
              {startingMode === "Restart"
                ? "Montando a lista..."
                : podeContinuar
                  ? "Recomeçar do zero"
                  : "Nova conferência"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Só pode haver uma conferência por vez. Produtos cadastrados depois do início não entram nesta.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Objetivo({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/40 p-4 text-left">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-primary">{icon}</span>
        {title}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
