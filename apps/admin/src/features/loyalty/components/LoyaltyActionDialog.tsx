import { Loader2 } from "lucide-react";
import type {
  LoyaltyActionList,
  LoyaltyActionRowDto,
  LoyaltyRewardStatusFilter,
} from "@workspace/api-client-react";
import {
  ChoiceChips,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui";
import { formatPhone, formatShortDate } from "@workspace/core";
import {
  LOYALTY_ACTIONS,
  REWARD_STATUS_FILTERS,
  isRewardList,
  rewardSituation,
} from "../lib/loyalty-actions";
import { LoadError } from "./LoadError";

type LoyaltyActionDialogProps = {
  list: LoyaltyActionList | null;
  rows?: LoyaltyActionRowDto[];
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** O filtro da lista de prêmios esperando troca; as outras listas não têm. */
  rewardStatus: LoyaltyRewardStatusFilter;
  onRewardStatusChange: (status: LoyaltyRewardStatusFilter) => void;
  onClose: () => void;
};

const date = (value?: string | null) => (value ? formatShortDate(value) : "—");

/**
 * A lista de clientes de um número do "Para agir". Nas de prêmio, uma linha por
 * prêmio, o liberado mais recente primeiro, com a data de vencimento; a de
 * prêmios esperando troca filtra pela situação (pedido do dono, 01/10/2026).
 */
export function LoyaltyActionDialog({
  list,
  rows,
  isLoading,
  isError,
  onRetry,
  rewardStatus,
  onRewardStatusChange,
  onClose,
}: LoyaltyActionDialogProps) {
  const action = LOYALTY_ACTIONS.find((item) => item.list === list);
  const rewards = isRewardList(list);
  const showStamps = !rewards && (rows?.some((row) => row.stampsRequired != null) ?? false);

  return (
    <Dialog open={list !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-border/50 bg-card sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{action?.label}</DialogTitle>
          <DialogDescription>
            {isError && !rows
              ? "A lista não carregou."
              : isLoading || !rows
                ? "Carregando..."
                : `${rows.length} ${rewards ? "prêmio(s)" : "cliente(s)"}`}
          </DialogDescription>
        </DialogHeader>

        {list === "rewards-waiting" && (
          <ChoiceChips
            label="Situação do prêmio"
            options={REWARD_STATUS_FILTERS}
            value={rewardStatus}
            onChange={(value) => value && onRewardStatusChange(value)}
            allowDeselect={false}
          />
        )}

        {isError && onRetry && !rows ? (
          <LoadError onRetry={onRetry} />
        ) : isLoading ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        ) : rows && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 text-left font-medium">Cliente</th>
                  <th className="py-2 text-left font-medium">Telefone</th>
                  {showStamps && <th className="py-2 text-right font-medium">Carimbos</th>}
                  {rewards && <th className="py-2 text-right font-medium">Prêmio</th>}
                  {rewards && <th className="py-2 text-right font-medium">Liberado em</th>}
                  <th className="py-2 text-right font-medium">{action?.dateLabel}</th>
                  {rewards && <th className="py-2 text-right font-medium">Situação</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index} className="border-t border-border/50">
                    <td className="py-2">{row.name}</td>
                    <td className="py-2 font-mono text-xs">{row.phone ? formatPhone(row.phone) : "—"}</td>
                    {showStamps && (
                      <td className="py-2 text-right tabular-nums">
                        {row.stampsRequired != null ? `${row.stamps} de ${row.stampsRequired}` : "—"}
                      </td>
                    )}
                    {rewards && <td className="py-2 text-right">{row.prize ?? "—"}</td>}
                    {rewards && <td className="py-2 text-right tabular-nums">{date(row.unlockedAt)}</td>}
                    <td className="py-2 text-right tabular-nums">
                      {row.date
                        ? list === "birthdays"
                          ? formatShortDate(row.date).slice(0, 5)
                          : formatShortDate(row.date)
                        : "—"}
                    </td>
                    {rewards && <td className="py-2 text-right">{rewardSituation(row)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {rewards && rewardStatus !== "available"
              ? "Nenhum prêmio nesta situação."
              : "Ninguém nesta lista hoje."}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
