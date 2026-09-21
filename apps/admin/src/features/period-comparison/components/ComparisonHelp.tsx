import { CalendarOff, GitCompare, Scale } from "lucide-react";
import { formatCurrency } from "@workspace/core";
import type { PeriodComparisonReportDto } from "@workspace/api-client-react";
import { BiHelpDialog } from "@/components/bi-help-dialog";

type ComparisonHelpProps = {
  report: PeriodComparisonReportDto;
};

/**
 * O manual da TELA — não dos cartões.
 *
 * Cada cartão tem o próprio "?" (`BiCardHelp`), e é lá que mora a explicação do
 * número: a dúvida acontece olhando o cartão, e obrigar a abrir um manual longo
 * e caçar a seção certa é o caminho mais curto para ninguém ler nenhum dos dois.
 *
 * Aqui fica só o que é da tela inteira e não cabe em cartão nenhum: a que
 * pergunta ela responde, por que as outras telas de BI não respondem, e **o que
 * ela não sabe**. Repetir aqui o conteúdo dos cartões criaria duas versões da
 * mesma explicação — e a segunda envelhece sem ninguém perceber.
 */
export function ComparisonHelp({ report }: ComparisonHelpProps) {
  const delta = report.current.revenue - report.previous.revenue;

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
              <p className="text-muted-foreground">
                <strong className="text-foreground/85">Cada cartão tem o próprio "?"</strong> ao lado do
                título, com a explicação daquele número e um exemplo. É lá que estão as contas.
              </p>
            </div>
          ),
        },
        {
          title: "Os três cortes respondem perguntas diferentes",
          icon: Scale,
          body: (
            <div className="flex flex-col gap-2">
              <p>
                A <strong className="text-foreground/85">mesma</strong> diferença aparece repartida três vezes
                na tela, e cada repartição leva a uma ação diferente:
              </p>
              <p>
                <strong className="text-foreground/85">De onde veio a diferença</strong> — entre os fatores
                que multiplicam o faturamento. Responde "foi movimento, cesta ou valor?".
              </p>
              <p>
                <strong className="text-foreground/85">Mix ou preço</strong> — por que o valor da peça mudou.
                Responde "compro diferente ou precifico diferente?".
              </p>
              <p>
                <strong className="text-foreground/85">Quem mudou</strong> — entre as linhas da dimensão.
                Responde "em qual categoria, produto ou fornecedor isso aconteceu?".
              </p>
              <p className="text-muted-foreground">
                Elas não somam entre si — são três leituras do mesmo dinheiro, não três parcelas dele.
              </p>
            </div>
          ),
        },
        {
          title: "O que esta tela NÃO sabe",
          icon: CalendarOff,
          body: (
            <div className="flex flex-col gap-2">
              <p>
                A primeira venda no sistema é de <strong className="text-foreground/85">05/03/2026</strong>.
                Ainda não existe o mesmo período do ano anterior para comparar.
              </p>
              <p>
                Consequência prática:{" "}
                <strong className="text-foreground/85">
                  uma queda sazonal aparece aqui igual a uma queda estrutural
                </strong>
                . Vender menos casaco em setembro e perder cliente de vez produzem o mesmo desenho na tela —
                só o seu calendário separa as duas.
              </p>
              <p className="text-muted-foreground">
                Compra também ainda não é série: as entradas de 31/08/2026 são a reimportação do catálogo, não
                compra. Comparar investimento em estoque mês a mês só passa a fazer sentido a partir de
                setembro de 2026.
              </p>
            </div>
          ),
        },
      ]}
    />
  );
}
