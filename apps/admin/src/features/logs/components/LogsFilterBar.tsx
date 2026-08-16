import { Button } from "@workspace/ui";
import { DateRangePicker, type DateRange } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Label } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Loader2, Search } from "lucide-react";
import type { LogTypeOption } from "../types";

/**
 * Propriedades do componente LogsFilterBar.
 */
interface LogsFilterBarProps {
  /** Valor temporário da busca textual. */
  draftSearch: string;
  /** Callback ao digitar no input de busca. */
  onSearchChange: (value: string) => void;
  /** Tipo temporário selecionado. */
  draftType: string;
  /** Callback ao selecionar o tipo de log. */
  onTypeChange: (value: string) => void;
  /** Lista de opções válidas do enum de tipos. */
  selectableLogTypeOptions: LogTypeOption[];
  /** Período temporário de datas. */
  draftDateRange: DateRange | undefined;
  /** Callback ao selecionar um período de datas. */
  onDateRangeChange: (range: DateRange | undefined) => void;
  /** Callback executado ao clicar em buscar. */
  onSearch: () => void;
  /** Callback para pressionamento de tecla no input de busca. */
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Indica se os logs estão sendo carregados. */
  isLoading: boolean;
}

/**
 * Componente contendo a barra de filtros (busca text, enums e range de datas) para a tela de logs.
 */
export function LogsFilterBar({
  draftSearch,
  onSearchChange,
  draftType,
  onTypeChange,
  selectableLogTypeOptions,
  draftDateRange,
  onDateRangeChange,
  onSearch,
  onKeyDown,
  isLoading,
}: LogsFilterBarProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap gap-3 items-end">
        {/* Busca */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Busca
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="log-search"
              placeholder="Código, origem ou mensagem..."
              className="pl-9 bg-background border-input"
              value={draftSearch}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={onKeyDown}
            />
          </div>
        </div>

        {/* Tipo */}
        <div className="flex flex-col gap-1.5 w-44">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tipo
          </Label>
          <Select value={draftType} onValueChange={onTypeChange}>
            <SelectTrigger id="log-type" className="bg-background border-input w-full">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {selectableLogTypeOptions.map((option) => (
                <SelectItem key={option.id} value={option.value}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Período */}
        <div className="flex flex-col gap-1.5 w-64">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Período
          </Label>
          <DateRangePicker value={draftDateRange} onChange={onDateRangeChange} />
        </div>

        {/* Botão Buscar */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-transparent select-none">
            &nbsp;
          </span>
          <Button id="log-search-btn" onClick={onSearch} disabled={isLoading} className="gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar
          </Button>
        </div>
      </div>
    </div>
  );
}
