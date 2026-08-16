import { Eye, Loader2, PackageMinus, RotateCcw } from "lucide-react";
import {
  enumCode,
  STOCK_WRITE_OFF_REASON,
  STOCK_WRITE_OFF_REASON_LABEL,
  STOCK_WRITE_OFF_STATUS,
  type StockWriteOffDto,
  type UiPagedResult,
  type UserListDto,
} from "@workspace/api-client-react";
import { Badge } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { Label } from "@workspace/ui";
import { formatDateInput, parseDateInput } from "@workspace/ui";
import { DateRangePicker, type DateRange } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { formatCurrency, formatDate, formatQuantity } from "@workspace/core";
import {
  ALL_FILTER_VALUE,
  STOCK_WRITE_OFF_REASON_FILTER_OPTIONS,
  STOCK_WRITE_OFF_STATUS_LABEL,
  STOCK_WRITE_OFF_STATUS_OPTIONS,
} from "@/features/stock-write-offs/domain";
import { isReversibleWriteOff } from "../hooks/useStockWriteOffs";
import type { StockWriteOffFilterState } from "../types";

type StockWriteOffsTableProps = {
  writeOffs: StockWriteOffDto[];
  writeOffsPage?: UiPagedResult<StockWriteOffDto>;
  isLoading: boolean;
  filters: StockWriteOffFilterState;
  onFilterChange: <K extends keyof StockWriteOffFilterState>(
    key: K,
    value: StockWriteOffFilterState[K],
  ) => void;
  onPeriodChange: (startDate: string, endDate: string) => void;
  onClearFilters: () => void;
  /** Operadores disponíveis no filtro "quem registrou". */
  users: UserListDto[];
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  onViewDetails: (id: number) => void;
  onReverse: (writeOff: StockWriteOffDto) => void;
};

/** Rótulo dos campos de filtro — mesmo padrão da barra de filtros das vendas. */
const FILTER_LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

/**
 * StockWriteOffsTable
 *
 * Listagem das baixas com a barra de filtros e a paginação. Baixa estornada
 * aparece esmaecida e com os números riscados: o registro continua no
 * histórico, mas não conta mais como saída de mercadoria.
 */
export function StockWriteOffsTable({
  writeOffs,
  writeOffsPage,
  isLoading,
  filters,
  onFilterChange,
  onPeriodChange,
  onClearFilters,
  users,
  page,
  setPage,
  onViewDetails,
  onReverse,
}: StockWriteOffsTableProps) {
  // Os filtros trafegam as datas como string (yyyy-MM-dd) até a API; o
  // calendário trabalha com Date. A conversão fica na borda, fora do hook.
  const dateRange: DateRange = {
    from: parseDateInput(filters.startDate),
    to: parseDateInput(filters.endDate),
  };

  const totalPages = writeOffsPage?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex w-64 flex-col gap-1.5">
            <Label className={FILTER_LABEL_CLASS}>Período</Label>
            <DateRangePicker
              value={dateRange}
              onChange={(range) => onPeriodChange(formatDateInput(range.from), formatDateInput(range.to))}
            />
          </div>

          <div className="flex w-[180px] flex-col gap-1.5">
            <Label className={FILTER_LABEL_CLASS}>Motivo</Label>
            <Select value={filters.reason} onValueChange={(value) => onFilterChange("reason", value)}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Motivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>Todos os motivos</SelectItem>
                {STOCK_WRITE_OFF_REASON_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex w-[170px] flex-col gap-1.5">
            <Label className={FILTER_LABEL_CLASS}>Situação</Label>
            <Select value={filters.status} onValueChange={(value) => onFilterChange("status", value)}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>Todas as situações</SelectItem>
                {STOCK_WRITE_OFF_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex w-[200px] flex-col gap-1.5">
            <Label className={FILTER_LABEL_CLASS}>Quem registrou</Label>
            <Select value={filters.userId} onValueChange={(value) => onFilterChange("userId", value)}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Quem registrou" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>Todos os usuários</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={String(user.id)}>
                    {`${user.firstName} ${user.lastName}`.trim() || user.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="ghost" size="sm" onClick={onClearFilters} className="mb-0.5">
            Limpar filtros
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg shadow-black/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-6 py-4">Data/Hora</th>
                <th className="px-6 py-4">Motivo</th>
                <th className="px-6 py-4 text-right">Qtd. total</th>
                <th className="px-6 py-4 text-right">Custo total</th>
                <th className="px-6 py-4">Registrada por</th>
                <th className="px-6 py-4">Situação</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </td>
                </tr>
              ) : writeOffs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <PackageMinus className="mx-auto mb-3 h-10 w-10 opacity-20" />
                    Nenhuma baixa encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                writeOffs.map((writeOff) => {
                  const reversed = !isReversibleWriteOff(writeOff);
                  const statusCode = enumCode(writeOff.status, STOCK_WRITE_OFF_STATUS);
                  const reasonCode = enumCode(writeOff.reason, STOCK_WRITE_OFF_REASON);

                  return (
                    <tr
                      key={writeOff.id}
                      className={`border-b border-border/50 transition-colors hover:bg-muted/20 ${
                        reversed ? "opacity-60" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-6 py-4">{formatDate(writeOff.occurredAt)}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="border-border/50 font-normal">
                          {STOCK_WRITE_OFF_REASON_LABEL[reasonCode] ?? "Não informado"}
                        </Badge>
                      </td>
                      <td className={`px-6 py-4 text-right ${reversed ? "line-through" : ""}`}>
                        {formatQuantity(writeOff.totalQuantity)}
                      </td>
                      <td
                        className={`px-6 py-4 text-right font-medium ${
                          reversed ? "line-through" : "text-destructive"
                        }`}
                      >
                        {formatCurrency(writeOff.totalCost)}
                      </td>
                      <td className="px-6 py-4">{writeOff.userName || "Não informado"}</td>
                      <td className="px-6 py-4">
                        <Badge variant={reversed ? "destructive" : "secondary"} className="font-normal">
                          {STOCK_WRITE_OFF_STATUS_LABEL[statusCode] ?? "Não informada"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-primary hover-elevate"
                            onClick={() => onViewDetails(writeOff.id)}
                            title="Ver detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {/* Estorno só existe para baixa efetivada: o que já
                              voltou ao estoque não tem o que desfazer. */}
                          {!reversed && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover-elevate"
                              onClick={() => onReverse(writeOff)}
                              title="Estornar baixa"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border/50 p-4 text-sm text-muted-foreground">
          <span>
            Mostrando página {writeOffsPage?.page ?? page} de {totalPages || 1}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
