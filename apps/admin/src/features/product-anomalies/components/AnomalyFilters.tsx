import { RefreshCw, Search } from "lucide-react";
import { Button, Card, Input, cn } from "@workspace/ui";
import type { ProductAnomalyTypeName } from "@workspace/api-client-react";
import { BI_TONE_PILL } from "@/lib/bi-tone";
import { ANOMALY_ORDER, anomalyMeta } from "../lib/anomalies";

type AnomalyFiltersProps = {
  counts: Map<ProductAnomalyTypeName, number>;
  /** Cadastros na lista inteira, para a pastilha "Todas". */
  total: number;
  type: ProductAnomalyTypeName | null;
  onToggleType: (value: ProductAnomalyTypeName) => void;
  onClearType: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  isFetching: boolean;
  onRefresh: () => void;
};

/**
 * Pastilhas por tipo (com a contagem de cadastros), busca e o botão de
 * recarregar.
 *
 * Só aparece pastilha de tipo que tem ocorrência: pastilha de zero é convite a
 * clicar para ver lista vazia. A exceção é a pastilha ATIVA: corrigido o último
 * cadastro do tipo e recarregada a lista, ela continua na tela (com zero) para o
 * filtro poder ser desligado — sumir com ela deixaria a lista vazia sem nenhuma
 * pastilha acesa que explicasse por quê. A ordem é a da prioridade — o que perde
 * dinheiro primeiro.
 */
export function AnomalyFilters({
  counts,
  total,
  type,
  onToggleType,
  onClearType,
  search,
  onSearchChange,
  isFetching,
  onRefresh,
}: AnomalyFiltersProps) {
  const tipos = ANOMALY_ORDER.filter((valor) => (counts.get(valor) ?? 0) > 0 || valor === type);

  return (
    <Card className="flex flex-col gap-3 border-border/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(evento) => onSearchChange(evento.target.value)}
            placeholder="Buscar produto, categoria ou código"
            aria-label="Buscar produto, categoria ou código"
            className="h-10 pl-8 text-[13px]"
          />
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          aria-label="Recarregar as anomalias"
          title="Recarregar as anomalias"
          className="ml-auto h-10 w-10 bg-background"
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </Button>
      </div>

      {tipos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={onClearType}
            aria-pressed={type === null}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
              type === null
                ? "border-foreground/30 bg-foreground/10 text-foreground"
                : BI_TONE_PILL.neutro + " hover:bg-muted/60",
            )}
          >
            Todas
            <span className="text-muted-foreground">{total}</span>
          </button>

          {tipos.map((valor) => {
            const meta = anomalyMeta(valor);
            const Icon = meta.icon;
            const ativo = type === valor;

            return (
              <button
                key={valor}
                type="button"
                onClick={() => onToggleType(valor)}
                aria-pressed={ativo}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                  ativo ? "border-foreground/30 bg-foreground/10 text-foreground" : BI_TONE_PILL[meta.tone],
                )}
              >
                <Icon className="h-3 w-3" />
                {meta.label}
                <span className="opacity-70">{counts.get(valor) ?? 0}</span>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
