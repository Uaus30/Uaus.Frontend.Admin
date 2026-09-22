import { Card, cn } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { ProfitLeadersReportDto } from "@workspace/api-client-react";
import { BiCardHelp, BiCardHelpExample } from "@/components/bi-card-help";
import { BI_TONE_PILL } from "@/lib/bi-tone";
import { formatInteger } from "@/features/supplier-performance/lib/format";
import { ATTENTION_ICON, describePeriod } from "../lib/profit-leaders";

/**
 * A manchete: quantos produtos fazem metade do lucro.
 *
 * <b>É o número, e não o pódio, que responde a pergunta da tela.</b> Em 90 dias
 * de produção o pódio inteiro carrega 9,6% do lucro — dar a manchete a ele seria
 * usar metade do espaço para falar de um décimo do dinheiro. A concentração é
 * que muda a conversa: metade do lucro sai de um nono do que vendeu.
 */
export function ProfitHeadline({ report }: { report: ProfitLeadersReportDto }) {
  const { summary } = report;
  const temDinheiroParado = summary.decliningLeaders > 0 && summary.decliningStockCost > 0;

  return (
    <Card className="border-border/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Quem faz metade do lucro
            </p>
            <BiCardHelp titulo="Quem faz metade do lucro">
              <p>
                A tela ordena os produtos do maior lucro para o menor e vai somando. Entram no ranking os que,
                juntos, chegam a <strong className="text-foreground/85">50% do lucro do período</strong>.
              </p>
              <p>
                O último entra inteiro, por isso a soma costuma passar um pouco de 50%: ninguém compra 40% de
                um item.
              </p>
              <BiCardHelpExample>
                {formatInteger(summary.leaderCount)} de {formatInteger(summary.productsWithProfit)} produtos
                que venderam fizeram {summary.leaderShare.toFixed(1).replace(".", ",")}% do lucro — são{" "}
                {summary.leaderShareOfProducts.toFixed(1).replace(".", ",")}% do que saiu da prateleira.
              </BiCardHelpExample>
              <p>
                <strong className="text-foreground/85">Lucro, não faturamento.</strong> É o que sobrou depois
                do custo do que foi vendido, e não tem relação com o preço do produto: um item barato que
                vende muito pode estar à frente de um caro que vende pouco.
              </p>
              <p>
                Produto com prejuízo no período fica de fora do ranking — ele não compõe lucro nenhum —, mas
                continua descontado do total.
              </p>
            </BiCardHelp>
          </div>

          <div className="mt-1 flex flex-wrap items-baseline gap-2.5">
            <span className="text-[34px] font-semibold leading-none">
              {formatInteger(summary.leaderCount)}
            </span>
            <span className="text-[15px] text-muted-foreground">
              de {formatInteger(summary.productsWithProfit)} produtos que venderam
            </span>
          </div>

          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-foreground/80">
            Juntos eles fazem{" "}
            <strong className="font-semibold">{formatCurrency(summary.leaderProfit)}</strong> —{" "}
            {summary.leaderShare.toFixed(1).replace(".", ",")}% do lucro do período, saindo de{" "}
            {summary.leaderShareOfProducts.toFixed(1).replace(".", ",")}% do que a loja vendeu.
          </p>

          {temDinheiroParado && (
            <p
              className={cn(
                "mt-3 inline-flex max-w-xl items-start gap-2 rounded-lg border px-3 py-2 text-[12.5px] leading-relaxed",
                BI_TONE_PILL.atencao,
              )}
            >
              <ATTENTION_ICON className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong className="font-semibold">
                  {formatInteger(summary.decliningLeaders)}{" "}
                  {summary.decliningLeaders === 1 ? "campeão perdeu" : "campeões perderam"} ritmo
                </strong>{" "}
                com {formatInteger(summary.decliningStockUnits)} peças em casa —{" "}
                {formatCurrency(summary.decliningStockCost)} de custo parado atrás de produtos que já provaram
                que vendem.
              </span>
            </p>
          )}
        </div>

        <div className="grid shrink-0 gap-y-2 text-right">
          <Numero titulo="Lucro do período" valor={formatCurrency(summary.profit)}>
            {formatCurrency(summary.revenue)} de faturamento ·{" "}
            {summary.marginPercentage.toFixed(1).replace(".", ",")}% de margem
          </Numero>
          <Numero titulo="Lucro por peça (mediana)" valor={formatCurrency(summary.medianProfitPerUnit)}>
            a régua do corte — metade dos campeões lucra mais que isso em cada peça
          </Numero>
          <Numero titulo="Período medido" valor={describePeriod(report.startDate, report.endDate)}>
            {formatInteger(report.periodDays)} dias
          </Numero>
        </div>
      </div>
    </Card>
  );
}

function Numero({ titulo, valor, children }: { titulo: string; valor: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</p>
      <p className="mt-0.5 text-lg font-semibold leading-none">{valor}</p>
      <p className="mt-1 max-w-[17rem] text-[11.5px] leading-snug text-muted-foreground">{children}</p>
    </div>
  );
}
