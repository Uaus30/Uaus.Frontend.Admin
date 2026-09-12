import { CalendarClock, CheckCircle2, CircleDashed, Flag } from "lucide-react";
import { Button, Card, CardContent } from "@workspace/ui";
import { formatDate } from "@workspace/core";
import type { InventoryCountDto } from "@workspace/api-client-react";

type InventoryCountProgressProps = {
  count: InventoryCountDto;
  onFinish: () => void;
  isFinishing: boolean;
};

/**
 * O cabeçalho da conferência aberta: quanto já foi feito e a saída de emergência.
 *
 * O número que importa é o de PENDENTES, em âmbar — é a fila de trabalho, e é
 * ele que chega a zero. O conferido fica em verde ao lado, como o que já foi
 * ganho. Cor com ícone e rótulo, nunca sozinha
 * (`Uaus.Docs/dominio/convencoes-de-interface.md`).
 *
 * "Encerrar" existe porque a conferência aberta bloqueia a próxima: sem saída,
 * um punhado de itens que ninguém quer conferir prenderia o recurso para
 * sempre. Normalmente ela se encerra sozinha, ao conferir o último item.
 */
export function InventoryCountProgress({ count, onFinish, isFinishing }: InventoryCountProgressProps) {
  const percentual = count.totalItems > 0 ? Math.round((count.reviewedItems / count.totalItems) * 100) : 0;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                <CircleDashed className="h-3.5 w-3.5 text-amber-500" />A conferir
              </p>
              <p className="font-display text-3xl font-bold text-amber-500">{count.pendingItems}</p>
            </div>

            <div>
              <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Conferidos
              </p>
              <p className="font-display text-3xl font-bold text-emerald-500">
                {count.reviewedItems}
                <span className="ml-1 text-base font-medium text-muted-foreground">
                  de {count.totalItems}
                </span>
              </p>
            </div>

            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              Iniciada em {formatDate(count.startedAt)}
              {count.userName ? ` por ${count.userName}` : ""}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={onFinish}
            disabled={isFinishing}
            className="hover-elevate gap-2 self-start lg:self-center"
          >
            <Flag className="h-4 w-4" /> Encerrar conferência
          </Button>
        </div>

        <div className="space-y-1">
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={percentual}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso da conferência"
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
              style={{ width: `${percentual}%` }}
            />
          </div>
          <p className="text-2xs font-semibold text-muted-foreground">{percentual}% conferido</p>
        </div>
      </CardContent>
    </Card>
  );
}
