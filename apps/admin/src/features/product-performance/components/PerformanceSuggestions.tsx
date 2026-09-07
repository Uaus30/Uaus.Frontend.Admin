import { Card, cn } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { ProductActionCode, ProductSuggestionDto } from "@workspace/api-client-react";
import { plural } from "@/features/supplier-performance/lib/format";
import { BI_TONE_PILL } from "@/lib/bi-tone";
import { ACTION_INFO } from "../lib/performance";

type PerformanceSuggestionsProps = {
  suggestions: ProductSuggestionDto[];
  selected: ProductActionCode | null;
  onSelect: (action: ProductActionCode) => void;
};

/** O que o valor de cada card está medindo — a frase muda porque a conta muda. */
const ROTULO_DO_VALOR: Record<ProductActionCode, string> = {
  RaisePrice: "de lucro deixado na mesa no período",
  Restock: "de faturamento que depende deles",
  Replicate: "de lucro que eles já produziram",
  Burn: "de custo parado na prateleira",
  None: "",
};

/**
 * As quatro decisões, com o tamanho de cada uma em reais.
 *
 * O valor é o que ordena a atenção. "23 produtos para subir o preço" e "223 para
 * queimar" não se comparam — R$ 330 e R$ 12.732 se comparam, e é essa comparação
 * que decide o que fazer na segunda-feira.
 *
 * Cada card mede uma coisa DIFERENTE, de propósito: subir preço vale o lucro que
 * ficou na mesa, queimar vale o custo parado, repor vale o faturamento que
 * depende do produto. Forçar as quatro na mesma métrica só faria três delas
 * mentirem.
 *
 * Os números vêm da loja inteira, não dos cem primeiros de cada tabela: clicar
 * no card recorta as listas, mas a contagem continua sendo a da loja — por isso
 * a tabela pode mostrar menos linhas do que o card anuncia.
 */
export function PerformanceSuggestions({ suggestions, selected, onSelect }: PerformanceSuggestionsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {suggestions.map((sugestao) => {
        const info = ACTION_INFO[sugestao.action];
        const ativo = selected === sugestao.action;
        const clicavel = sugestao.products > 0;

        return (
          <Card
            key={sugestao.action}
            role={clicavel ? "button" : undefined}
            tabIndex={clicavel ? 0 : undefined}
            aria-pressed={clicavel ? ativo : undefined}
            onClick={() => clicavel && onSelect(sugestao.action)}
            onKeyDown={(event) => {
              if (clicavel && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                onSelect(sugestao.action);
              }
            }}
            className={cn(
              "flex flex-col gap-2 border-border/60 p-4 transition-colors",
              clicavel && "cursor-pointer hover:border-primary/50",
              ativo && "border-primary ring-1 ring-primary",
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn("rounded-lg border p-1.5", BI_TONE_PILL[info.tom])}>
                <info.icone className="h-4 w-4" />
              </span>
              <p className="text-[12.5px] font-semibold">{info.rotulo}</p>
              <span className="ml-auto text-[11px] text-muted-foreground">
                {plural(sugestao.products, "produto", "produtos")}
              </span>
            </div>

            <p className="text-[22px] font-semibold leading-none tracking-tight">
              {formatCurrency(sugestao.amount)}
            </p>
            <p className="text-[11px] text-muted-foreground">{ROTULO_DO_VALOR[sugestao.action]}</p>

            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
              {sugestao.products === 0 ? "Nenhum produto pede esta decisão agora." : info.explicacao}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
