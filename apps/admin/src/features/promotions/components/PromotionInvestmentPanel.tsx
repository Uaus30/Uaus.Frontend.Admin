import { formatCurrency, formatQuantity } from "@workspace/core";
import type { PromotionInvestmentDto } from "@workspace/api-client-react";
import { Sparkles } from "lucide-react";

/**
 * A escada de reais: o que a promoção custou, o que rendeu e o que sobrou.
 *
 * ## A armadilha que este painel existe para impedir
 *
 * **O investimento NÃO se subtrai do lucro.** O lucro do item já está líquido do
 * desconto — `profit` é subtotal menos custo, e o subtotal já saiu com o preço
 * promocional. Fazer "retorno − investimento" conta o mesmo dinheiro duas vezes,
 * exatamente como somar o cupom ao desconto faria. O investimento é a
 * **explicação do buraco**, não uma segunda subtração.
 *
 * ## Exato e estimado, separados na tela
 *
 * As quatro primeiras linhas saem de dado gravado; as duas últimas comparam com
 * um período equivalente e são estimativa. Misturá-las daria ao saldo a mesma
 * autoridade do investimento, e ele não tem — nenhuma promoção foi medida neste
 * sistema ainda, e a régua de "retorno por real investido" nasce das próprias
 * promoções, não de um número inventado aqui.
 *
 * A leitura que decide é a de duas linhas: "o copo sozinho custou R$ 37 de
 * lucro; as cestas que ele puxou renderam R$ 160". Se o arraste não cobre o
 * item, a isca não iscou — e isso é visível sem nenhuma estimativa.
 */

function Linha({
  rotulo,
  valor,
  descricao,
  destaque,
  estimativa,
}: {
  rotulo: string;
  valor: string;
  descricao: string;
  destaque?: boolean;
  estimativa?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2 last:border-b-0">
      <div className="min-w-0">
        <p className={`text-sm ${destaque ? "font-semibold" : ""}`}>
          {rotulo}
          {estimativa && (
            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
              estimativa
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">{descricao}</p>
      </div>
      <span className={`shrink-0 font-mono ${destaque ? "text-lg font-bold" : "text-sm"}`}>{valor}</span>
    </div>
  );
}

export function PromotionInvestmentPanel({
  investment,
  showPerDay,
}: {
  investment: PromotionInvestmentDto;
  /** Mostra o investimento por dia — "R$ 900 em 90 dias" é ilegível, "R$ 10 por dia" é decisão. */
  showPerDay: boolean;
}) {
  if (investment.isShowcaseOnly) {
    return (
      <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-4">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
        <div className="space-y-1 text-sm">
          <p className="font-semibold">Sem investimento — o efeito é de destaque.</p>
          <p className="text-muted-foreground">
            Esta promoção não corta preço: ela existe para o produto aparecer. Quem responde se funcionou é o
            impulso, não o retorno por real investido.
          </p>
        </div>
      </div>
    );
  }

  const soma = investment.itemProfit + investment.dragProfit;

  return (
    <div className="rounded-lg border p-4">
      <Linha
        rotulo="Investimento"
        valor={formatCurrency(investment.amount)}
        descricao="O que a loja deixou de faturar por decisão própria, somando o desconto de cada unidade."
        destaque
      />

      {showPerDay && (
        <Linha
          rotulo="Por dia"
          valor={formatCurrency(investment.perDay)}
          descricao="O mesmo investimento dividido pelos dias de vigência."
        />
      )}

      <Linha
        rotulo="Lucro do item"
        valor={formatCurrency(investment.itemProfit)}
        descricao="O que as unidades promocionais renderam. Negativo quando o preço ficou abaixo do custo."
      />

      <Linha
        rotulo="Arraste"
        valor={formatCurrency(investment.dragProfit)}
        descricao="O lucro de tudo o mais que saiu nas mesmas vendas — é o que a isca existe para produzir."
      />

      {investment.returnPerInvestedReal != null && (
        <Linha
          rotulo="Retorno por real investido"
          valor={`${formatQuantity(investment.returnPerInvestedReal)}×`}
          descricao="Arraste dividido pelo investimento. Ainda não existe régua para ele: a primeira temporada de promoções é que vai dizer o que é bom."
        />
      )}

      <Linha
        rotulo="Num período equivalente"
        valor={formatCurrency(investment.baselineProfit)}
        descricao="O que o produto rendia sem promoção, no mesmo dia da semana (relâmpago) ou nos 30 dias anteriores (dia a dia)."
        estimativa
      />

      <Linha
        rotulo="Saldo"
        valor={formatCurrency(investment.balance)}
        descricao={`Lucro do item mais arraste (${formatCurrency(soma)}), menos o período equivalente.`}
        destaque
        estimativa
      />
    </div>
  );
}
