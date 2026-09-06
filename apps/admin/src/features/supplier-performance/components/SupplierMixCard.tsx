import { Card } from "@workspace/ui";
import type { SupplierDetailDto } from "@workspace/api-client-react";
import { formatInteger, plural } from "../lib/format";

type SupplierMixCardProps = {
  detail: SupplierDetailDto;
};

/**
 * Como o mix do fornecedor se distribui, e quanto dele carrega o faturamento.
 *
 * Os dois últimos grupos ficam fora do julgamento da nota e aparecem em cinza de
 * propósito: produto novo ainda não teve chance de vender, e produto sem estoque
 * não tinha como vender. Contá-los contra o fornecedor seria cobrar um resultado
 * que a loja não deu a ele a oportunidade de entregar.
 */
export function SupplierMixCard({ detail }: SupplierMixCardProps) {
  const { summary } = detail;

  const grupos: Array<{ rotulo: string; valor: number; cor: string; julgado: boolean }> = [
    { rotulo: "Produtos bons", valor: summary.goodProducts, cor: "text-emerald-400", julgado: true },
    {
      rotulo: "Vendem com margem baixa",
      valor: summary.lowMarginProducts,
      cor: "text-amber-400",
      julgado: true,
    },
    { rotulo: "Parados com estoque", valor: summary.stalledProducts, cor: "text-orange-400", julgado: true },
    {
      rotulo: "Novos (ainda sem julgamento)",
      valor: summary.newProducts,
      cor: "text-muted-foreground",
      julgado: false,
    },
    {
      rotulo: "Sem estoque e sem venda",
      valor: summary.inactiveProducts,
      cor: "text-muted-foreground",
      julgado: false,
    },
  ];

  return (
    <Card className="border-border/60 p-5">
      <h2 className="text-[14.5px] font-semibold">Composição do mix</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatInteger(summary.totalProducts)} produtos comprados deste fornecedor
      </p>

      <dl className="mt-3 flex flex-col gap-2 text-[12.5px]">
        {grupos.map((grupo) => (
          <div key={grupo.rotulo} className="flex items-baseline justify-between gap-3">
            <dt className={grupo.julgado ? "text-foreground/70" : "text-muted-foreground"}>{grupo.rotulo}</dt>
            <dd className={`font-semibold ${grupo.cor}`}>{formatInteger(grupo.valor)}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 border-t border-border/50 pt-3 text-xs leading-relaxed text-muted-foreground">
        {detail.productsForEightyPercent > 0 ? (
          <>
            <strong className="text-foreground/80">
              {plural(detail.productsForEightyPercent, "produto faz", "produtos fazem")}
            </strong>{" "}
            80% do faturamento deste fornecedor, de {formatInteger(summary.distinctProducts)} que venderam no
            período.
          </>
        ) : (
          "Sem faturamento no período."
        )}
      </p>
    </Card>
  );
}
