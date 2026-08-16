import { Search } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Skeleton,
  cn,
} from "@workspace/ui";
import { formatShortDate } from "@workspace/core";
import type { CampaignDto } from "@workspace/api-client-react";

type CampaignReportComparisonPickerProps = {
  campaigns: CampaignDto[];
  isLoading: boolean;
  selectedIds: number[];
  onToggle: (id: number) => void;
  onClear: () => void;
  maxCampaigns: number;
  searchInput: string;
  onSearchChange: (value: string) => void;
};

/** Período da campanha em uma linha. Fim ausente = em aberto. */
function describePeriod(campaign: CampaignDto): string {
  const inicio = formatShortDate(campaign.startsAt);
  return campaign.endsAt == null ? `desde ${inicio}` : `${inicio} até ${formatShortDate(campaign.endsAt)}`;
}

/**
 * CampaignReportComparisonPicker
 *
 * Escolha das campanhas do comparativo.
 *
 * A seleção NÃO é limpa pela busca: filtrar a lista para achar a próxima
 * campanha não pode desmarcar as que já entraram, senão o gráfico muda sozinho
 * enquanto o usuário digita. A consequência é que uma campanha marcada pode
 * ficar fora da lista visível — por isso o contador mostra o total escolhido, e
 * o gráfico e a tabela abaixo exibem o nome de cada uma.
 *
 * O teto vem do servidor, que responde 400 acima dele. Barrar o clique com aviso
 * é melhor do que transformar a escolha seguinte em erro de API.
 */
export function CampaignReportComparisonPicker({
  campaigns,
  isLoading,
  selectedIds,
  onToggle,
  onClear,
  maxCampaigns,
  searchInput,
  onSearchChange,
}: CampaignReportComparisonPickerProps) {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold">Campanhas comparadas</CardTitle>
            <CardDescription>
              {selectedIds.length} de {maxCampaigns} selecionada(s). Cada linha é medida na janela dela, com o
              próprio denominador.
            </CardDescription>
          </div>

          {selectedIds.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onClear}>
              Limpar seleção
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar campanha pelo nome..."
            className="pl-9"
            aria-label="Buscar campanha"
          />
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma campanha encontrada com esse nome.
          </p>
        ) : (
          <ul className="flex max-h-[320px] flex-col gap-1 overflow-y-auto pr-1">
            {campaigns.map((campaign) => {
              const marcada = selectedIds.includes(campaign.id);
              const bloqueada = !marcada && selectedIds.length >= maxCampaigns;

              return (
                <li key={campaign.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors hover:bg-muted/40",
                      marcada && "border-primary/40 bg-primary/5",
                      // O item além do teto continua visível e legível: escondê-lo
                      // faria a lista mudar de tamanho a cada clique.
                      bloqueada && "opacity-60",
                    )}
                  >
                    <Checkbox
                      checked={marcada}
                      onCheckedChange={() => onToggle(campaign.id)}
                      aria-label={`Comparar ${campaign.name}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground">{describePeriod(campaign)}</p>
                    </div>
                    {!campaign.isActive && (
                      <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Inativa
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
