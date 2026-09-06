import { AlertCircle } from "lucide-react";
import { Card, Spinner, cn } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { AppLayout } from "@/components/layout";
import { useProductAbc, ABC_CRITERION_LABELS } from "@/features/product-abc/hooks/useProductAbc";
import { AbcFilters } from "@/features/product-abc/components/AbcFilters";
import { AbcHeadline } from "@/features/product-abc/components/AbcHeadline";
import { AbcConcentrationChart } from "@/features/product-abc/components/AbcConcentrationChart";
import { AbcMatrix } from "@/features/product-abc/components/AbcMatrix";
import { AbcFindings } from "@/features/product-abc/components/AbcFindings";
import { AbcTable } from "@/features/product-abc/components/AbcTable";
import { CLASS_COLORS, CLASS_MEANING, matrixCellMeaning } from "@/features/product-abc/lib/abc";
import { formatInteger, formatPercent } from "@/features/supplier-performance/lib/format";

/**
 * BI › Curva ABC de Produtos.
 *
 * A tela responde uma pergunta que a regra de Pareto costuma responder de
 * cabeça: quantos produtos esta loja precisou para fazer 80% do resultado. O
 * número medido quase nunca é 20 — e é a distância até a regra que diz se o
 * resultado vem de poucos campeões ou de muitos itens pequenos.
 */
export default function ProductAbcPage() {
  const tela = useProductAbc();
  const relatorio = tela.report;
  const criterio = ABC_CRITERION_LABELS[tela.criterion];

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-[27px] font-semibold tracking-tight">Curva ABC de Produtos</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {tela.period.label}
            </span>
            {relatorio && (
              <span className="text-[13px] text-muted-foreground">
                {formatInteger(relatorio.summary.products)} produtos venderam ·{" "}
                {formatCurrency(relatorio.summary.revenue)} em {formatInteger(relatorio.summary.sales)} vendas
              </span>
            )}
          </div>
        </div>

        <AbcFilters
          periodMode={tela.periodMode}
          preset={tela.preset}
          customStart={tela.customStart}
          setCustomStart={tela.setCustomStart}
          customEnd={tela.customEnd}
          setCustomEnd={tela.setCustomEnd}
          onSelectPreset={tela.handleSelectPreset}
          onApplyCustom={tela.handleApplyCustom}
          onClearCustom={tela.handleClearCustom}
          criterion={tela.criterion}
          onCriterionChange={tela.setCriterion}
          isFetching={tela.isFetching}
          onRefresh={() => void tela.refetch()}
        />

        {tela.isError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              Não foi possível carregar a curva ABC. Verifique a conexão com o servidor e tente novamente.
            </span>
          </div>
        )}

        {tela.isLoading && (
          <div className="flex items-center justify-center py-20">
            <Spinner />
          </div>
        )}

        {relatorio && relatorio.summary.products === 0 && !tela.isLoading && (
          <Card className="border-border/60 p-10 text-center text-sm text-muted-foreground">
            Nenhuma venda no período escolhido — sem vendas não há curva a montar.
          </Card>
        )}

        {relatorio && relatorio.summary.products > 0 && (
          <>
            <AbcHeadline summary={relatorio.summary} criterionLabel={criterio} />

            <div className="grid items-start gap-3 xl:grid-cols-[1.15fr_1fr]">
              <AbcConcentrationChart
                curve={relatorio.curve}
                classAEndsAt={relatorio.summary.shareOfProductsForEightyPercent}
                tailStartsAt={tela.tailStartsAt}
              />
              <AbcMatrix
                cells={relatorio.matrix}
                selected={
                  tela.focus.tipo === "celula"
                    ? { receita: tela.focus.receita, lucro: tela.focus.lucro }
                    : null
                }
                onSelect={(receita, lucro) => tela.toggleFocus({ tipo: "celula", receita, lucro })}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {(["A", "B", "C"] as const).map((classe) => {
                const produtos =
                  classe === "A"
                    ? relatorio.summary.classAProducts
                    : classe === "B"
                      ? relatorio.summary.classBProducts
                      : relatorio.summary.classCProducts;
                const ativa = tela.focus.tipo === "classe" && tela.focus.classe === classe;

                return (
                  <Card
                    key={classe}
                    role="button"
                    tabIndex={0}
                    onClick={() => tela.toggleFocus({ tipo: "classe", classe })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        tela.toggleFocus({ tipo: "classe", classe });
                      }
                    }}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 border-border/60 p-4 transition-colors hover:border-primary/50",
                      ativa && "border-primary ring-1 ring-primary",
                    )}
                  >
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-base font-bold text-background"
                      style={{ backgroundColor: CLASS_COLORS[classe] }}
                    >
                      {classe}
                    </span>
                    <div>
                      <p className="text-lg font-semibold leading-none">
                        {formatInteger(produtos)}{" "}
                        <span className="text-[13px] font-normal text-muted-foreground">
                          {produtos === 1 ? "produto" : "produtos"}
                        </span>
                      </p>
                      <p className="mt-1 text-[11.5px] text-muted-foreground">
                        {formatPercent((produtos / relatorio.summary.products) * 100, 0)} do catálogo ·{" "}
                        {CLASS_MEANING[classe]}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>

            <AbcFindings
              findings={relatorio.findings}
              summary={relatorio.summary}
              selected={tela.focus.tipo === "achado" ? tela.focus.chave : null}
              onSelect={(chave, ids) => tela.toggleFocus({ tipo: "achado", chave, ids })}
            />

            <AbcTable
              products={tela.products}
              totalProducts={relatorio.summary.products}
              search={tela.search}
              onSearchChange={tela.setSearch}
              focusLabel={rotuloDoFoco(tela.focus)}
              onClearFocus={tela.clearFocus}
            />

            <p className="mt-2 border-t border-dashed border-border pt-4 text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground/80">Como a curva é montada</strong> — os produtos são
              ordenados por {criterio.toLowerCase()} e o acumulado é somado linha a linha:{" "}
              <strong className="text-foreground/80">A</strong> vai até 80%,{" "}
              <strong className="text-foreground/80">B</strong> até 95% e{" "}
              <strong className="text-foreground/80">C</strong> é o resto. Cada produto recebe também a classe
              pela OUTRA medida — é o cruzamento da matriz. Prejuízo entra como zero na curva de lucro, senão
              o acumulado andaria para trás e a classe deixaria de acompanhar a ordem. A coluna{" "}
              <strong className="text-foreground/80">cesta</strong> é o ticket médio das vendas que contêm o
              produto dividido pelo ticket médio da loja.
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
}

/** O recorte em vigor, em palavras, para a etiqueta acima da tabela. */
function rotuloDoFoco(foco: ReturnType<typeof useProductAbc>["focus"]): string | null {
  switch (foco.tipo) {
    case "classe":
      return `Classe ${foco.classe}`;
    case "celula":
      return `Faturamento ${foco.receita} × lucro ${foco.lucro} — ${matrixCellMeaning(foco.receita, foco.lucro)}`;
    case "achado":
      return {
        revenueTraps: "Armadilhas de faturamento",
        hiddenGems: "Joias escondidas",
        tailThatPullsBasket: "Cauda que puxa cesta",
        misplacedStock: "Capital na cauda",
      }[foco.chave];
    default:
      return null;
  }
}
