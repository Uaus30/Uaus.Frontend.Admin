import { Card, cn } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { RevenueFactorDto } from "@workspace/api-client-react";
import { BiCardHelp, BiCardHelpExample } from "@/components/bi-card-help";
import { BI_TONE_FILL, BI_TONE_TEXT } from "@/lib/bi-tone";
import { formatSignedPercent } from "@/features/dashboard/utils";
import { formatInteger, formatPercent } from "@/features/supplier-performance/lib/format";
import { deltaTone, FACTOR_KIND, FACTOR_LABELS, FACTOR_MEANING } from "../lib/comparison";

type RevenueBridgeProps = {
  bridge: RevenueFactorDto[];
  total: number;
};

/**
 * Bloco 1 — a ponte: a diferença repartida entre os quatro fatores que
 * multiplicam o faturamento.
 *
 * <b>O valor cru de cada fator fica ao lado da barra</b> (13,56 → 12,77 cupons
 * por dia), e não só o valor em reais. A repartição é a média de todas as ordens
 * possíveis de substituição — exata, mas impossível de refazer na calculadora.
 * Os dois números crus são o que permite conferir o FATO por trás da barra, que
 * é o que decide o que fazer.
 */
export function RevenueBridge({ bridge, total }: RevenueBridgeProps) {
  // A parcela "sem item" só existe quando há defeito de dado. Mostrá-la zerada em
  // todo período normal seria uma quinta barra que nunca diz nada.
  const barras = bridge.filter(
    (fator) =>
      fator.factor !== "Unattributed" ||
      fator.amount !== 0 ||
      fator.previousValue !== 0 ||
      fator.currentValue !== 0,
  );

  // Piso em um centavo, e não em R$ 1: com dois períodos quase idênticos, um
  // piso de R$ 1 fazia a maior barra ocupar 40% da linha e a escala relativa
  // perdia o sentido justamente onde ela é a única leitura possível.
  const maior = Math.max(...barras.map((fator) => Math.abs(fator.amount)), 0.01);

  // A identidade muda quando a parcela sem item entra em cena, e o subtítulo
  // precisa mudar junto: um cartão que desenha cinco barras sob a fórmula de
  // quatro fatores se contradiz na própria moldura.
  const temParcelaSemItem = barras.some((fator) => fator.factor === "Unattributed");

  // A soma sai das barras EXIBIDAS, e não do total recebido por prop. Imprimir o
  // total seria uma linha matematicamente incapaz de discordar das barras — e a
  // conferência que ela promete, teatro: um centavo de regressão no servidor
  // ficaria escondido justamente por quem deveria denunciá-lo.
  const soma = barras.reduce((acumulado, fator) => acumulado + fator.amount, 0);
  const confere = Math.abs(soma - total) < 0.005;

  return (
    <Card className="border-border/60 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-1">
          <h2 className="text-[15px] font-semibold">De onde veio a diferença</h2>
          <BridgeHelp temParcelaSemItem={temParcelaSemItem} />
        </div>
        <p className="text-[11.5px] text-muted-foreground">
          faturamento = dias abertos × cupons por dia × peças por cupom × valor por peça
          {temParcelaSemItem && " + venda sem item"}
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-3.5">
        {barras.map((fator) => {
          const tone = deltaTone(fator.amount);
          const largura = (Math.abs(fator.amount) / maior) * 100;

          return (
            <div key={fator.factor} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[13px] font-medium">{FACTOR_LABELS[fator.factor]}</span>
                  <span className="text-[11.5px] text-muted-foreground">
                    {formatFactor(fator.factor, fator.previousValue)} →{" "}
                    {formatFactor(fator.factor, fator.currentValue)}
                    {/* A ausência vem do servidor: sair de zero não tem percentual.
                        Testar `previousValue !== 0` aqui repetiria a regra e as duas
                        cópias divergiriam na primeira mudança. */}
                    {fator.changePercentage != null && <> ({formatSignedPercent(fator.changePercentage)})</>}
                  </span>
                </div>
                <span className={cn("text-[13px] font-semibold tabular-nums", BI_TONE_TEXT[tone])}>
                  {fator.amount > 0 ? "+" : ""}
                  {formatCurrency(fator.amount)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/60">
                  <div
                    className={cn("h-full rounded-full", BI_TONE_FILL[tone])}
                    style={{ width: `${largura}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                  {formatPercent(fator.shareOfMovement, 0)}
                </span>
              </div>

              <p className="text-[11.5px] text-muted-foreground">{FACTOR_MEANING[fator.factor]}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-1 border-t border-dashed border-border pt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] text-muted-foreground">
            {barras.length === 1 ? "Soma da causa" : `Soma das ${barras.length} causas`}
          </span>
          <span className={cn("text-[13px] font-semibold tabular-nums", BI_TONE_TEXT[deltaTone(soma)])}>
            {soma > 0 ? "+" : ""}
            {formatCurrency(soma)}
          </span>
        </div>

        {/* Só aparece quando a soma NÃO fecha — e aí a tela denuncia em vez de
            esconder. Com o total impresso no lugar da soma, esta linha seria
            matematicamente incapaz de discordar das barras de cima. */}
        {!confere && (
          <div className="flex items-baseline justify-between text-[11.5px] text-destructive">
            <span>Diferença do período (não bate com as barras)</span>
            <span className="tabular-nums">{formatCurrency(total)}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

/** O manual deste cartão. */
function BridgeHelp({ temParcelaSemItem }: { temParcelaSemItem: boolean }) {
  return (
    <BiCardHelp titulo="De onde veio a diferença">
      <p>
        Estes quatro números, multiplicados, <strong className="text-foreground/85">são</strong> o faturamento
        — não é um modelo, é uma identidade: cada divisor é o de cima do fator anterior. Se o faturamento
        mudou, pelo menos um deles mudou.
      </p>

      <BiCardHelpExample>
        <p>
          <strong className="text-foreground/85">26 dias</strong> abertos ×{" "}
          <strong className="text-foreground/85">12,8 cupons</strong> por dia ×{" "}
          <strong className="text-foreground/85">3,7 peças</strong> por cupom ×{" "}
          <strong className="text-foreground/85">R$ 5,99</strong> por peça ={" "}
          <strong className="text-foreground/85">R$ 7.421</strong> no mês
        </p>
      </BiCardHelpExample>

      <p>
        A barra em reais é <em>quanto daquela diferença aquele fator responde</em>. Ela sai de uma média de
        todas as ordens possíveis de troca entre os quatro, o que a torna exata mas impossível de refazer na
        calculadora — por isso{" "}
        <strong className="text-foreground/85">o valor cru de cada fator fica ao lado</strong> (26 → 20 dias).
        É esse número que se confere.
      </p>

      <p>
        <strong className="text-foreground/85">Dias abertos</strong> é o dia em que a loja vendeu alguma
        coisa; não existe registro de expediente no sistema.
      </p>

      {temParcelaSemItem && (
        <p>
          <strong className="text-foreground/85">Venda sem item</strong> é faturamento cobrado sem nenhum
          produto por trás — <strong className="text-foreground/85">defeito de dado</strong>, não venda de
          verdade. São sete cupons do Mais PDV, entre março e junho de 2026, em que o sistema antigo cobrou
          mais que a soma dos próprios itens (quatro deles não tinham item nenhum). Aparece aqui porque o
          faturamento do topo é o mesmo do painel e inclui esse dinheiro: escondê-lo faria as outras barras
          não somarem a diferença. Nenhuma venda do PDV novo tem esse problema.
        </p>
      )}

      <p>
        A <strong className="text-foreground/85">soma das causas</strong>, no rodapé, é a soma das barras
        desenhadas. Se ela discordar da diferença do topo, o cartão avisa em vermelho.
      </p>
    </BiCardHelp>
  );
}

/** Dias e cupons são contagem; o valor da peça é dinheiro. */
function formatFactor(factor: RevenueFactorDto["factor"], value: number): string {
  switch (FACTOR_KIND[factor]) {
    case "moeda":
      return formatCurrency(value);
    case "decimal":
      return value.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    default:
      return formatInteger(value);
  }
}
