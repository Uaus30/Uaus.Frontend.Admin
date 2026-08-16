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
import type { CampaignDto } from "@workspace/api-client-react";
import { Search } from "lucide-react";
import { TODAS_CAMPANHAS } from "../hooks/useCoupons";

interface CouponsFiltersProps {
  /** Texto cru da busca — o debounce e o recuo de página vivem no hook. */
  searchInput: string;
  onSearchChange: (value: string) => void;
  onlyActive: boolean;
  onOnlyActiveChange: (value: boolean) => void;
  /** Id da campanha como string, ou {@link TODAS_CAMPANHAS}. */
  campaignFilter: string;
  onCampaignFilterChange: (value: string) => void;
  campaigns: CampaignDto[];
}

/**
 * Barra de filtros da listagem de cupons.
 *
 * "Somente ativos" filtra o INDICADOR de ativo, não a vigência: cupom vencido
 * continua aparecendo, e é exatamente assim que o administrador o encontra para
 * desativar. Fossem a mesma coisa, o cupom vencido sumiria da tela no dia
 * seguinte e ninguém conseguiria encerrá-lo.
 */
export function CouponsFilters({
  searchInput,
  onSearchChange,
  onlyActive,
  onOnlyActiveChange,
  campaignFilter,
  onCampaignFilterChange,
  campaigns,
}: CouponsFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-card p-4 rounded-xl border shadow-sm">
      <div className="relative flex-1 w-full">
        <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
        <Input
          placeholder="Buscar por código ou descrição do cupom..."
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="w-full sm:w-64">
        <Select value={campaignFilter} onValueChange={onCampaignFilterChange}>
          <SelectTrigger>
            <SelectValue placeholder="Campanha" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS_CAMPANHAS}>Todas as campanhas</SelectItem>
            {campaigns.map((campaign) => (
              <SelectItem key={campaign.id} value={String(campaign.id)}>
                {campaign.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Switch id="cp-only-active" checked={onlyActive} onCheckedChange={onOnlyActiveChange} />
        <Label htmlFor="cp-only-active" className="cursor-pointer whitespace-nowrap">
          Somente ativos
        </Label>
      </div>
    </div>
  );
}
