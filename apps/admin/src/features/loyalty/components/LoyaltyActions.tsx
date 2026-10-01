import { ChevronRight, Loader2 } from "lucide-react";
import type {
  LoyaltyActionCountsDto,
  LoyaltyActionList,
  LoyaltyActionRowDto,
} from "@workspace/api-client-react";
import {
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from "@workspace/ui";
import { formatPhone, formatShortDate } from "@workspace/core";
import { LOYALTY_ACTIONS } from "../lib/loyalty-actions";

type LoyaltyActionsProps = {
  counts?: LoyaltyActionCountsDto;
  isLoading: boolean;
  onOpen: (list: LoyaltyActionList) => void;
};

/**
 * O "Para agir" (entrega 5): retrato de hoje, e cada número abre a lista dos
 * clientes que ele conta, para o balcão lembrar quando o cliente aparecer. Sem
 * botão de WhatsApp: a loja não fala com o cliente direto por lá.
 */
export function LoyaltyActions({ counts, isLoading, onOpen }: LoyaltyActionsProps) {
  return (
    <Card className="border-border/60 p-5 shadow-lg shadow-black/10">
      <h3 className="text-base font-semibold text-foreground">Para agir</h3>
      <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
        Retrato de hoje; cada linha abre a lista com os clientes
      </p>
      {isLoading || !counts ? (
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

type LoyaltyActionDialogProps = {
  list: LoyaltyActionList | null;
  rows?: LoyaltyActionRowDto[];
  isLoading: boolean;
  onClose: () => void;
};

/** A lista de clientes de um número do "Para agir": nome, telefone, carimbos e a data que importa. */
export function LoyaltyActionDialog({ list, rows, isLoading, onClose }: LoyaltyActionDialogProps) {
  const action = LOYALTY_ACTIONS.find((item) => item.list === list);
  const showStamps = rows?.some((row) => row.stampsRequired != null) ?? false;
  const showPrize = rows?.some((row) => row.prize) ?? false;

  return (
    <Dialog open={list !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-border/50 bg-card sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{action?.label}</DialogTitle>
          <DialogDescription>{rows ? `${rows.length} cliente(s)` : "Carregando..."}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        ) : rows && rows.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-2 text-left font-medium">Cliente</th>
                <th className="py-2 text-left font-medium">Telefone</th>
                {showStamps && <th className="py-2 text-right font-medium">Carimbos</th>}
                {showPrize && <th className="py-2 text-right font-medium">Prêmio</th>}
                <th className="py-2 text-right font-medium">{action?.dateLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.customerId}-${row.date ?? ""}`} className="border-t border-border/50">
                  <td className="py-2">{row.name}</td>
                  <td className="py-2 font-mono text-xs">{row.phone ? formatPhone(row.phone) : "—"}</td>
                  {showStamps && (
                    <td className="py-2 text-right tabular-nums">
                      {row.stampsRequired != null ? `${row.stamps} de ${row.stampsRequired}` : "—"}
                    </td>
                  )}
                  {showPrize && <td className="py-2 text-right">{row.prize ?? "—"}</td>}
                  <td className="py-2 text-right tabular-nums">
                    {row.date
                      ? list === "birthdays"
                        ? formatShortDate(row.date).slice(0, 5)
                        : formatShortDate(row.date)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">Ninguém nesta lista hoje.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
