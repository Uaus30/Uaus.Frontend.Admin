import { TrendingUp } from "lucide-react";
import { formatCurrency } from "@workspace/core";
import { LEGACY_CLOSING_NOTE, isLegacyClosing, newFieldText } from "../closing-statement";
import { StatementRow, StatementSection } from "./StatementRow";
import type { ClosingNumbers, FinancialReportWriteOffByReasonDto } from "../types";

interface ClosingResultBlockProps {
  closing: ClosingNumbers;
  /** As baixas por motivo — só a prévia traz. */
  writeOffsByReason?: FinancialReportWriteOffByReasonDto[];
}

/**
 * ClosingResultBlock
 *
 * O resultado do mês — o lucro, que é rateado (seção 3.1 do plano):
 *
 * ```
 *   Vendas brutas − descontos = vendas líquidas
 * − custo das vendas = lucro bruto
 * − baixas a custo + sobras − custos fixos − custos variáveis = lucro líquido
 * ```
 *
 * Promoção e cupom aparecem como PARCELAS dos descontos, recuadas: a promoção
 * já está dentro do desconto no item, e o cupom, dentro do desconto na venda.
 * Somá-las de novo inflaria o desconto.
 *
 * A baixa não é venda: não entra no faturamento nem no caixa, só aqui, pelo
 * custo FIFO congelado no lançamento — é o produto que saiu sem virar dinheiro.
 * Nos fechamentos da conta antiga ela era informativa, e a linha diz isso.
 */
export function ClosingResultBlock({ closing, writeOffsByReason }: ClosingResultBlockProps) {
  const legacy = isLegacyClosing(closing);
  const money = formatCurrency;

  return (
    <StatementSection
      icon={TrendingUp}
      title="Resultado do mês"
      note={legacy ? LEGACY_CLOSING_NOTE : undefined}
    >
      <StatementRow label="Vendas brutas" value={newFieldText(legacy, closing.grossSales)} />
      {legacy ? (
        <StatementRow sign="−" label="Descontos (só o da venda)" value={money(closing.discounts)} />
      ) : (
        <>
          <StatementRow sign="−" label="Descontos concedidos" value={money(closing.discountsTotal)} />
          <StatementRow
            indent
            label={`no item (promoção ${money(closing.promotionDiscountsTotal)})`}
            value={money(closing.itemDiscountsTotal)}
          />
          <StatementRow
            indent
            label={`na venda (cupom ${money(closing.couponDiscountsTotal)})`}
            value={money(closing.discounts)}
          />
        </>
      )}
      <StatementRow
        sign="="
        emphasis
        label="Vendas líquidas"
        value={money(closing.revenue)}
        hint={`${closing.salesCount.toLocaleString("pt-BR")} venda(s)`}
      />
      <StatementRow sign="−" label="Custo das vendas" value={money(closing.cogsCost)} />
      <StatementRow sign="=" emphasis label="Lucro bruto" value={money(closing.grossProfit)} />
      <StatementRow
        sign={legacy ? undefined : "−"}
        label="Baixas a custo"
        value={money(closing.writeOffLossesTotal)}
        hint={legacy ? "Informativo: na conta antiga, fora do lucro" : "Perda, doação, consumo e inventário"}
      />
      {(writeOffsByReason ?? []).map((reason) => (
        <StatementRow
          key={String(reason.reason)}
          indent
          label={reason.reasonName}
          value={money(reason.totalCost)}
        />
      ))}
      <StatementRow
        sign={legacy ? undefined : "+"}
        label="Sobras de estoque"
        value={newFieldText(legacy, closing.stockSurplusTotal)}
        hint={legacy ? undefined : "Entradas de ajuste manual"}
      />
      <StatementRow sign="−" label="Custos fixos" value={money(closing.fixedCostsTotal)} />
      <StatementRow sign="−" label="Custos variáveis" value={money(closing.variableCostsTotal)} />
      <StatementRow
        sign="="
        emphasis
        label="Lucro líquido"
        value={money(closing.netProfit)}
        tone={closing.netProfit < 0 ? "negative" : "positive"}
        hint="É ele que se divide entre os sócios"
      />
    </StatementSection>
  );
}
