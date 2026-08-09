import { Wallet } from "lucide-react";
import { CASH_REGISTER_SESSION_OPEN } from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { formatDateInput, parseDateInput } from "@/components/ui/date-field";
import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { CashRegisterSessionDto, CashRegisterSessionStatusFilter } from "../types";

interface CashRegisterSessionsTableProps {
  /** True enquanto a listagem carrega. */
  isLoading: boolean;
  /** Sessões da página atual. */
  sessions: CashRegisterSessionDto[];
  /** Filtro de status aplicado. */
  statusFilter: CashRegisterSessionStatusFilter;
  /** Troca o filtro de status (o hook volta para a primeira página). */
  onStatusFilterChange: (value: CashRegisterSessionStatusFilter) => void;
  /** Início do período no formato `yyyy-MM-dd`. */
  startDate: string;
  /** Fim do período no formato `yyyy-MM-dd`. */
  endDate: string;
  /** Aplica o período escolhido no calendário (strings `yyyy-MM-dd`). */
  onPeriodChange: (startDate: string, endDate: string) => void;
  /** Abre o detalhe da sessão clicada. */
  onRowClick: (id: number) => void;
}

/** Rótulo dos campos de filtro — mesmo padrão da barra de filtros de vendas. */
const FILTER_LABEL_CLASS =
  "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

/** Badge da coluna Diferença: verde quando a gaveta bateu, destructive quando não. */
function DifferenceBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;

  if (value === 0) {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
        {formatCurrency(0)}
      </Badge>
    );
  }

  return <Badge variant="destructive" className="font-medium">{formatCurrency(value)}</Badge>;
}

/**
 * CashRegisterSessionsTable
 *
 * Barra de filtros (status + período) e tabela das sessões de caixa.
 * Clicar numa linha abre o Dialog de detalhe do turno.
 */
export function CashRegisterSessionsTable({
  isLoading,
  sessions,
  statusFilter,
  onStatusFilterChange,
  startDate,
  endDate,
  onPeriodChange,
  onRowClick,
}: CashRegisterSessionsTableProps) {
  // O filtro trafega as datas como string (yyyy-MM-dd) até a API; o calendário
  // trabalha com Date. A conversão fica na borda, sem mexer no hook.
  const dateRange: DateRange = {
    from: parseDateInput(startDate),
    to: parseDateInput(endDate),
  };

  /** Aplica o período escolhido no calendário. */
  function handleDateRangeChange(range: DateRange) {
    onPeriodChange(formatDateInput(range.from), formatDateInput(range.to));
  }

  return (
    <div className="space-y-4">
      {/* Barra de filtros */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex flex-col gap-1.5 w-full sm:w-48">
          <Label className={FILTER_LABEL_CLASS}>Status</Label>
          <Select
            value={statusFilter}
            onValueChange={(value) => onStatusFilterChange(value as CashRegisterSessionStatusFilter)}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Abertos</SelectItem>
              <SelectItem value="closed">Fechados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 w-full sm:w-64">
          <Label className={FILTER_LABEL_CLASS}>Período</Label>
          <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
        </div>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">
          Carregando sessões de caixa...
        </div>
      ) : sessions.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground border rounded-lg bg-card">
          <Wallet className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="font-medium text-base">Nenhuma sessão de caixa encontrada</p>
          <p className="text-sm">Os turnos abertos no PDV aparecem aqui automaticamente.</p>
        </div>
      ) : (
        <div className="rounded-md border bg-card overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Abertura</TableHead>
                <TableHead>Fechamento</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead className="text-right">Fundo de troco</TableHead>
                <TableHead className="text-right">Esperado</TableHead>
                <TableHead className="text-right">Contado</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow
                  key={session.id}
                  onClick={() => onRowClick(session.id)}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  title="Ver detalhes do turno"
                >
                  <TableCell className="font-medium text-foreground">
                    {formatDate(session.openedAt)}
                  </TableCell>

                  <TableCell>
                    {session.closedAt ? (
                      formatDate(session.closedAt)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell>
                    {session.userName || <span className="text-muted-foreground">—</span>}
                  </TableCell>

                  <TableCell className="text-right">
                    {formatCurrency(session.openingBalance)}
                  </TableCell>

                  <TableCell className="text-right">
                    {session.expectedAmount != null ? (
                      formatCurrency(session.expectedAmount)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    {session.countedAmount != null ? (
                      formatCurrency(session.countedAmount)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <DifferenceBadge value={session.difference} />
                  </TableCell>

                  <TableCell>
                    {session.status === CASH_REGISTER_SESSION_OPEN ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                        Aberto
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="font-medium">
                        Fechado
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
