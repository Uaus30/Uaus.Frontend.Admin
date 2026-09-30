import type { LowStockScope } from "@workspace/api-client-react";

type LowStockScopeTabsProps = {
  scope: LowStockScope;
  onChange: (scope: LowStockScope) => void;
};

const ABAS: Array<{ value: LowStockScope; label: string; title: string }> = [
  {
    value: "Restock",
    label: "Para repor",
    title: "Produtos controlados que esgotaram, acabam em menos de 30 dias ou chegaram ao estoque mínimo",
  },
  {
    value: "OutOfControl",
    label: "Fora do controle",
    title: "Produtos com o controle desligado ou que vendem menos de 1 por mês — daqui se religa",
  },
];

/**
 * As duas listas do relatório (29/09/2026).
 *
 * "Fora do controle" existe para o que sai da lista não sumir sem ninguém ver:
 * o produto desligado à mão e o que a rotina diária tirou por giro baixo ficam
 * aqui, e é daqui que se religa.
 */
export function LowStockScopeTabs({ scope, onChange }: LowStockScopeTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Lista do relatório"
      className="inline-flex rounded-lg border border-border/50 p-1"
    >
      {ABAS.map((aba) => {
        const ativa = aba.value === scope;
        return (
          <button
            key={aba.value}
            type="button"
            role="tab"
            aria-selected={ativa}
            title={aba.title}
            onClick={() => onChange(aba.value)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              ativa ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {aba.label}
          </button>
        );
      })}
    </div>
  );
}
