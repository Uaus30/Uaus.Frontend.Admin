import { Card, cn } from "@workspace/ui";
import type { AbcClass, AbcMatrixCellDto } from "@workspace/api-client-react";
import { formatInteger, formatPercent } from "@/features/supplier-performance/lib/format";
import { matrixCellMeaning } from "../lib/abc";

type AbcMatrixProps = {
  cells: AbcMatrixCellDto[];
  /** Célula em foco, para a tabela e a matriz concordarem sobre o recorte. */
  selected: { receita: AbcClass; lucro: AbcClass } | null;
  onSelect: (receita: AbcClass, lucro: AbcClass) => void;
};

const CLASSES: AbcClass[] = ["A", "B", "C"];

/**
 * A matriz bicritério: classe por faturamento × classe por lucro.
 *
 * É o que a curva sozinha não responde. Ordenada por faturamento, a lista exibe
 * como campeão o item que vende muito e lucra pouco — e ele fica lá, ocupando
 * prateleira, porque o número que o classificou nunca olhou para a margem.
 *
 * A cor codifica UMA coisa: a participação da célula no faturamento. É escala de
 * magnitude, então é uma matiz só, mais escura onde há mais — e não nove cores
 * diferentes, que gastariam o canal de identidade para dizer de novo o que a
 * posição na grade já diz.
 */
export function AbcMatrix({ cells, selected, onSelect }: AbcMatrixProps) {
  const maior = Math.max(...cells.map((x) => x.revenueShare), 1);

  return (
    <Card className="flex flex-col gap-4 border-border/60 p-5">
      <div>
        <h2 className="text-[14.5px] font-semibold">Faturamento × lucro</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          A mesma lista, classificada duas vezes. Fora da diagonal, as duas leituras discordam.
        </p>
      </div>

      <div className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] gap-1.5">
        <div />
        {CLASSES.map((classe) => (
          <div key={classe} className="pb-1 text-center text-[11px] font-semibold text-muted-foreground">
            Lucro {classe}
          </div>
        ))}

        {CLASSES.map((porReceita) => (
          <div key={porReceita} className="contents">
            <div className="flex items-center pr-2 text-[11px] font-semibold text-muted-foreground">
              Fat. {porReceita}
            </div>

            {CLASSES.map((porLucro) => {
              const celula = cells.find((x) => x.revenueClass === porReceita && x.profitClass === porLucro);
              const produtos = celula?.products ?? 0;
              const share = celula?.revenueShare ?? 0;
              const ativa = selected?.receita === porReceita && selected?.lucro === porLucro;
              const leitura = matrixCellMeaning(porReceita, porLucro);
              const naDiagonal = porReceita === porLucro;

              return (
                <button
                  key={`${porReceita}-${porLucro}`}
                  type="button"
                  disabled={produtos === 0}
                  onClick={() => onSelect(porReceita, porLucro)}
                  title={`${leitura} · ${formatPercent(share)} do faturamento`}
                  className={cn(
                    "flex min-h-[74px] flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2 transition-colors",
                    produtos === 0
                      ? "cursor-default border-border/40 text-muted-foreground/50"
                      : "border-border/50 hover:border-primary/60",
                    ativa && "border-primary ring-1 ring-primary",
                  )}
                  style={{
                    // A opacidade sai da participação: é a mesma matiz da marca,
                    // mais presente onde há mais faturamento.
                    backgroundColor:
                      produtos === 0 ? undefined : `hsl(25 92% 48% / ${0.06 + (share / maior) * 0.34})`,
                  }}
                >
                  <span className="text-[19px] font-semibold leading-none">{formatInteger(produtos)}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {produtos === 1 ? "produto" : "produtos"}
                  </span>
                  <span className="text-[10.5px] font-medium text-foreground/70">{formatPercent(share)}</span>
                  {!naDiagonal && produtos > 0 && (
                    <span
                      className={cn(
                        "mt-0.5 text-[9.5px] font-semibold uppercase tracking-wide",
                        porReceita < porLucro ? "text-orange-300" : "text-emerald-300",
                      )}
                    >
                      {porReceita < porLucro ? "fatura > lucra" : "lucra > fatura"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <p className="border-t border-border/50 pt-3 text-xs leading-relaxed text-muted-foreground">
        Acima da diagonal estão os produtos que{" "}
        <strong className="text-orange-300">faturam mais do que lucram</strong> — ocupam prateleira sem pagar
        por ela. Abaixo, os que <strong className="text-emerald-300">lucram mais do que aparecem</strong>.
        Clique numa célula para filtrar a lista.
      </p>
    </Card>
  );
}
