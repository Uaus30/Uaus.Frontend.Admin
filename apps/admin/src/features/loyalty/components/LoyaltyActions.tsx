import { ChevronRight } from "lucide-react";
import type { LoyaltyActionCountsDto, LoyaltyActionList } from "@workspace/api-client-react";
import { Card, Skeleton } from "@workspace/ui";
import { LOYALTY_ACTIONS } from "../lib/loyalty-actions";
import { LoadError } from "./LoadError";

type LoyaltyActionsProps = {
  counts?: LoyaltyActionCountsDto;
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onOpen: (list: LoyaltyActionList) => void;
};

/**
 * O "Para agir" (entrega 5): retrato de hoje, e cada número abre a lista dos
 * clientes que ele conta, para o balcão lembrar quando o cliente aparecer. Sem
 * botão de WhatsApp: a loja não fala com o cliente direto por lá.
 */
export function LoyaltyActions({ counts, isLoading, isError, onRetry, onOpen }: LoyaltyActionsProps) {
  return (
    <Card className="border-border/60 p-5 shadow-lg shadow-black/10">
      <h3 className="text-base font-semibold text-foreground">Para agir</h3>
      <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
        Retrato de hoje; cada linha abre a lista com os clientes
      </p>
      {isError && onRetry && !counts ? (
        <LoadError onRetry={onRetry} />
      ) : isLoading || !counts ? (
        <Skeleton className="h-56 rounded-lg" />
      ) : (
        <ul className="grid grid-cols-1 gap-x-8 divide-border/50 md:grid-cols-2 [&>li]:border-b [&>li]:border-border/50">
          {LOYALTY_ACTIONS.map(({ list, label, icon: Icon, count }) => (
            <li key={list}>
              <button
                type="button"
                onClick={() => onOpen(list)}
                className="flex w-full cursor-pointer items-center gap-3 py-2.5 text-left text-sm transition-colors hover:text-primary"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">{label}</span>
                <span className="font-semibold tabular-nums">{count(counts)}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
