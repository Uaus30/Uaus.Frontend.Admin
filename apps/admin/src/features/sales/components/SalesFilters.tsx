import React from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import {
  Button,
  DateRangePicker,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
  type DateRange,
} from "@workspace/ui";

/** Rótulo dos campos de filtro — mesmo padrão da barra de filtros dos logs. */
const FILTER_LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

type Option = { id: number | string; name: string };

type SalesFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  paymentMethodFilter: string;
  onPaymentMethodChange: (value: string) => void;
  paymentStatusFilter: string;
  onPaymentStatusChange: (value: string) => void;
  paymentMethods: Option[];
  paymentStatuses: Option[];
};

/**
 * A barra de filtros da tela de Vendas.
 *
 * **No celular (abaixo de `sm`) período, forma e situação ficam atrás do botão
 * "Filtros (n)"** (06/10/2026): empilhados em larguras diferentes, os quatro
 * campos ocupavam ~300px antes da primeira venda. A busca continua sempre à
 * mão. Do `sm` para cima o embrulho é `sm:contents` e a linha é a de antes.
 */
export function SalesFilters({
  search,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  paymentMethodFilter,
  onPaymentMethodChange,
  paymentStatusFilter,
  onPaymentStatusChange,
  paymentMethods,
  paymentStatuses,
}: SalesFiltersProps) {
  const [open, setOpen] = React.useState(false);
  const activeCount =
    Number(Boolean(dateRange.from || dateRange.to)) +
    Number(paymentMethodFilter !== "all") +
    Number(paymentStatusFilter !== "all");

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:min-w-[260px] sm:flex-1">
          <Label className={FILTER_LABEL_CLASS}>Busca</Label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, produto ou observação..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="h-10 bg-background pl-9 sm:h-9"
              />
            </div>
            <Button
              type="button"
              variant={activeCount > 0 ? "secondary" : "outline"}
              className="h-10 shrink-0 gap-1.5 px-3 sm:hidden"
              aria-expanded={open}
              aria-controls="sales-filter-fields"
              onClick={() => setOpen((current) => !current)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
            </Button>
          </div>
        </div>

        <div
          id="sales-filter-fields"
          className={cn("w-full flex-col gap-3 sm:contents", open ? "flex" : "hidden")}
        >
          <div className="flex w-full flex-col gap-1.5 sm:w-64">
            <Label className={FILTER_LABEL_CLASS}>Período</Label>
            <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
          </div>

          <div className="flex w-full flex-col gap-1.5 sm:w-[190px]">
            <Label className={FILTER_LABEL_CLASS}>Forma de Pagamento</Label>
            <Select value={paymentMethodFilter} onValueChange={onPaymentMethodChange}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Forma de Pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Formas Pagto</SelectItem>
                {paymentMethods.map((pm) => (
                  <SelectItem key={pm.id} value={String(pm.id)}>
                    {pm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex w-full flex-col gap-1.5 sm:w-[160px]">
            <Label className={FILTER_LABEL_CLASS}>Status Pagamento</Label>
            <Select value={paymentStatusFilter} onValueChange={onPaymentStatusChange}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Status Pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                {paymentStatuses.map((ps) => (
                  <SelectItem key={ps.id} value={String(ps.id)}>
                    {ps.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
