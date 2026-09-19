import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@workspace/ui";
import { PROMOTION_TYPE_LABEL } from "@workspace/api-client-react";
import { Search } from "lucide-react";
import { TODOS_OS_TIPOS } from "../hooks/usePromotions";
import type { PromotionTypeCode } from "../types";

interface PromotionsFiltersProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  typeFilter: PromotionTypeCode | null;
  onTypeFilterChange: (value: PromotionTypeCode | null) => void;
  onlyActive: boolean;
  onOnlyActiveChange: (value: boolean) => void;
  tipos: readonly PromotionTypeCode[];
}

/**
 * Filtros da listagem.
 *
 * "Só ativas" filtra o INDICADOR, não a vigência: a promoção encerrada continua
 * aparecendo, e é assim que ela é encontrada para ser repetida — que é a pergunta
 * que o dono faz depois do sábado.
 */
export function PromotionsFilters({
  searchInput,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  onlyActive,
  onOnlyActiveChange,
  tipos,
}: PromotionsFiltersProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchInput}
          placeholder="Buscar pelo produto"
          className="pl-9"
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="w-full sm:w-52">
        <Select
          value={typeFilter == null ? TODOS_OS_TIPOS : String(typeFilter)}
          onValueChange={(valor) =>
            onTypeFilterChange(valor === TODOS_OS_TIPOS ? null : (Number(valor) as PromotionTypeCode))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS_OS_TIPOS}>Todos os tipos</SelectItem>
            {tipos.map((tipo) => (
              <SelectItem key={tipo} value={String(tipo)}>
                {PROMOTION_TYPE_LABEL[tipo]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Label className="flex items-center gap-2 text-sm">
        <Switch checked={onlyActive} onCheckedChange={onOnlyActiveChange} />
        Só ativas
      </Label>
    </div>
  );
}
