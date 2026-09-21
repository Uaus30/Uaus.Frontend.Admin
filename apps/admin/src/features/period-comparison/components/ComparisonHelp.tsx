import { Calculator, GitCompare, PackageX, Scale, Split } from "lucide-react";
import { formatCurrency } from "@workspace/core";
import type { PeriodComparisonReportDto } from "@workspace/api-client-react";
import { BiHelpDialog } from "@/components/bi-help-dialog";
import { formatInteger } from "@/features/supplier-performance/lib/format";
import { DIMENSION_WORDS, FACTOR_LABELS } from "../lib/comparison";
import { COMPARISON_DIMENSION } from "@workspace/api-client-react";

type ComparisonHelpProps = {
  report: PeriodComparisonReportDto;
};

/**
 * O manual da tela.
 *
 * Fala com os números que a tela mediu — os dois faturamentos, o fator que
 * liderou, o valor da peça —, e não com o exemplo genérico. Manual que ensina um
 * caso inventado envelhece sem ninguém perceber.
 */
export function ComparisonHelp({ report }: ComparisonHelpProps) {
  const delta = report.current.revenue - report.previous.revenue;

  // Duas defesas contra resposta que a API ainda não manda, mas mandaria no dia
  // em que ganhasse uma dimensão nova ou uma ponte vazia: sem elas o manual
  // estoura em `undefined.toLowerCase()`. O `ErrorBoundary` de `App.tsx` pega e
  // mostra a tela de recuperação — não é tela branca —, mas trocar a tela inteira
  // por um campo a mais no contrato é caro demais para o preço de um `??`.
  const lider = [...report.bridge].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0];
  const palavras =
    DIMENSION_WORDS[COMPARISON_DIMENSION[report.mixPrice.measuredBy]] ??
    DIMENSION_WORDS[COMPARISON_DIMENSION.Category];

  return (
    <BiHelpDialog
      screen="O que mudou — como ler"
      summary="Por que este período fechou diferente do anterior, com a diferença repartida entre as causas que a produziram."
      sections={[
        {
          title: "A tela é uma subtração, não um retrato",
          icon: GitCompare,
          body: (
            <div className="flex flex-col gap-2">
              <p>
                As outras telas de BI descrevem <em>um</em> período. Esta subtrai um do outro: no recorte em
                vigor, {formatCurrency(report.previous.revenue)} viraram{" "}
                {formatCurrency(report.current.revenue)}, uma diferença de{" "}
                <strong className="text-foreground/85">{formatCurrency(delta)}</strong>.
              </p>
              <p>
                Abrir a Curva ABC de dois períodos lado a lado <em>não</em> responde isso: as réguas daquelas
                telas são medidas contra a própria loja no período, então trocar o período reclassifica todo
                mundo. Aqui a régua é o período de referência, e tudo sai em reais.
              </p>
            </div>
          ),
        },
        {
          title: "Os quatro fatores multiplicam o faturamento",
          icon: Calculator,
          body: (
            <div className="flex flex-col gap-2">
              <p>
                <strong className="text-foreground/85">
                  dias abertos × cupons por dia × peças por cupom × valor por peça
                </strong>{" "}
                é o faturamento — por construção, já que cada denominador é o numerador do fator anterior. Se
                o resultado mudou, pelo menos um deles mudou.
              </p>
              {lider && (
                <p>
                  No recorte em vigor quem mais pesou foi{" "}
                  <strong className="text-foreground/85">
                    {(FACTOR_LABELS[lider.factor] ?? "").toLowerCase()}
                  </strong>
                  , com {formatCurrency(lider.amount)}.
                </p>
              )}
              <p className="text-muted-foreground">
                Faturamento cobrado <strong className="text-foreground/85">sem item</strong> no sistema não
                tem peça, então não tem fator: ele entra como parcela somada, com barra própria. Normalmente
                vale zero — quando não vale, é defeito de dado, e o lugar dele é visível.
              </p>
              <p>
                A repartição é a <strong className="text-foreground/85">média de todas as ordens</strong>{" "}
                possíveis de substituição. Trocar um fator por vez numa ordem fixa é mais fácil de conferir na
                mão, mas entrega ao último fator trocado todo o efeito combinado — e a mesma realidade mudaria
                de causa conforme a ordem escolhida. Por isso os valores crus aparecem ao lado da barra: eles
                é que se conferem.
              </p>
              <p className="text-muted-foreground">
                "Dias abertos" é o dia em que a loja vendeu alguma coisa. Não há registro de expediente no
                sistema; um dia aberto sem nenhuma venda conta como fechado.
              </p>
            </div>
          ),
        },
        {
          title: "Mix e preço pedem ações opostas",
          icon: Split,
          body: (
            <div className="flex flex-col gap-2">
              <p>
                O valor por peça saiu de {formatCurrency(report.mixPrice.previousRevenuePerUnit)} para{" "}
                {formatCurrency(report.mixPrice.currentRevenuePerUnit)}. Isso acontece por dois motivos
                diferentes:
              </p>
              <p>
                <strong className="text-foreground/85">Mix</strong> — a loja passou a vender{" "}
                {palavras.artigoOutras} {palavras.plural}, e as novas custam outro preço. Corrige-se comprando
                diferente.
              </p>
              <p>
                <strong className="text-foreground/85">Preço</strong> — {palavras.artigoMesma}{" "}
                {palavras.singular} saiu por outro valor. Corrige-se precificando diferente, ou olhando
                desconto e promoção.
              </p>
              <p className="text-muted-foreground">
                A régua é <strong className="text-foreground/85">sempre {palavras.singular}</strong>, mesmo
                quando a tabela está quebrada por outra dimensão. A fronteira entre mix e preço É a
                granularidade: numa régua fina quase tudo vira mix, porque o preço de um produto quase não
                varia. Se a régua acompanhasse o seletor, a recomendação se inverteria quando você trocasse o
                seletor para olhar a tabela.
              </p>
              <p className="text-muted-foreground">
                Linha que não existia no período de referência entra inteira no mix: ela não encareceu nem
                barateou, a loja é que passou a vendê-la.
              </p>
            </div>
          ),
        },
        {
          title: "Quem mudou soma a diferença inteira",
          icon: Scale,
          body: (
            <div className="flex flex-col gap-2">
              <p>
                A coluna Δ da tabela soma exatamente a diferença do período. É isso que separa esta tabela de
                um ranking: um ranking mostra os maiores, esta mostra <em>todos os reais</em>, inclusive os
                que não couberam nas primeiras linhas (juntados em "outras N linhas").
              </p>
              <p className="text-muted-foreground">
                A linha <strong className="text-foreground/85">"Sem item identificado"</strong>, quando
                aparece, é faturamento cobrado sem item correspondente no banco — sete vendas migradas do
                sistema anterior, entre março e junho de 2026, têm essa diferença. Ela fica visível em vez de
                sumir dentro de outra linha.
              </p>
            </div>
          ),
        },
        {
          title: "Item-evento é o que não se repete",
          icon: PackageX,
          body: (
            <div className="flex flex-col gap-2">
              <p>
                Um produto que passou de <strong className="text-foreground/85">5%</strong> do faturamento de
                um período e ficou <strong className="text-foreground/85">abaixo de 2%</strong> no outro entra
                aqui com nome próprio. O que só acelerou ou só desacelerou não entra — esse já aparece na
                tabela como qualquer linha que mudou.
              </p>
              <p>
                O <strong className="text-foreground/85">estoque que sobrou</strong> vem junto porque é a
                única parte do evento sobre a qual ainda dá para agir. Hoje a comparação mostra{" "}
                {formatInteger(report.eventItems.length)}{" "}
                {report.eventItems.length === 1 ? "item assim" : "itens assim"}.
              </p>
            </div>
          ),
        },
      ]}
    />
  );
}
