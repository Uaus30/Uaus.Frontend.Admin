import { CalendarOff, Coins, Trophy } from "lucide-react";
import type { ProfitLeadersReportDto } from "@workspace/api-client-react";
import { BiHelpDialog } from "@/components/bi-help-dialog";
import { formatInteger } from "@/features/supplier-performance/lib/format";

/**
 * O manual da TELA — não dos cartões.
 *
 * Cada cartão tem o próprio "?" (`BiCardHelp`), e é lá que mora a explicação do
 * número. Aqui fica só o que é da tela inteira: a que pergunta ela responde, por
 * que a curva ABC não responde, e <b>o que ela não sabe</b>. Repetir aqui o
 * conteúdo dos cartões criaria duas versões da mesma explicação — e a segunda
 * envelhece sem ninguém perceber.
 */
export function ProfitLeadersHelp({ report }: { report: ProfitLeadersReportDto }) {
  const { summary } = report;

  return (
    <BiHelpDialog
      screen="O que trouxe lucro — como ler"
      summary="Quais produtos, sozinhos, fazem metade do lucro do período — e o que fazer com cada um deles."
      sections={[
        {
          title: "Por que não é a curva ABC",
          icon: Trophy,
          body: (
            <div className="flex flex-col gap-2">
              <p>
                A curva ABC corta em <strong className="text-foreground/85">80%</strong> e descreve a{" "}
                <em>forma</em> da distribuição: quantos por cento do catálogo a loja precisou. É uma resposta
                de diagnóstico.
              </p>
              <p>
                Esta corta em <strong className="text-foreground/85">50%</strong> e descreve{" "}
                <em>o que fazer</em> com quem está dentro. No recorte em vigor são{" "}
                {formatInteger(summary.leaderCount)} produtos — uma lista que cabe numa reunião. O corte de
                80% devolveria umas três vezes isso, e uma lista desse tamanho não decide nada.
              </p>
              <p className="text-muted-foreground">
                As duas medem o mesmo lucro, e há teste travando os totais. Se elas divergirem, é defeito —
                não diferença de método.
              </p>
            </div>
          ),
        },
        {
          title: "O que conta como lucro aqui",
          icon: Coins,
          body: (
            <div className="flex flex-col gap-2">
              <p>
                O que sobrou de cada item depois do custo do que saiu da prateleira. Venda cancelada fica de
                fora, como no painel e nas outras telas de BI.
              </p>
              <p>
                <strong className="text-foreground/85">Não tem relação com o preço do produto.</strong> Um
                item de R$ 5 que vende 300 unidades pode estar à frente de um de R$ 60 que vende 10 — e a
                conta de cada linha mostra exatamente isso.
              </p>
              <p className="text-muted-foreground">
                Diferença conhecida: o desconto que o operador dá no cupom inteiro (e não no item) é rateado
                pelo <em>painel</em> e não pelas telas de produto. Em 90 dias isso foi R$ 61,45 — 0,26% do
                faturamento. É por isso que o lucro daqui pode ficar alguns reais acima do lucro do painel no
                mesmo período.
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
                  a tela não distingue queda sazonal de queda estrutural
                </strong>
                . A camiseta da Copa depois da Copa e um produto que perdeu a graça desenham exatamente o
                mesmo gráfico. A tela mostra o fato; quem separa os dois é o seu calendário.
              </p>
              <p className="text-muted-foreground">
                Ela também não sabe por que um produto parou de vender — se saiu de moda, se o concorrente
                baixou o preço, se ficou escondido na loja. O selo aponta onde olhar; a resposta está fora do
                sistema.
              </p>
            </div>
          ),
        },
      ]}
    />
  );
}
