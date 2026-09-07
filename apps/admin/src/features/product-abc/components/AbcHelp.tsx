import { Gem, Grid3x3, LineChart, ListOrdered, TriangleAlert } from "lucide-react";
import { cn } from "@workspace/ui";
import type { ProductAbcSummaryDto } from "@workspace/api-client-react";
import { BiHelpDialog, BiHelpTerm } from "@/components/bi-help-dialog";
import { BI_TONE_PILL } from "@/lib/bi-tone";
import { formatPercent } from "@/features/supplier-performance/lib/format";
import { CLASS_ACTION, CLASS_COLORS, CLASS_MEANING, readConcentrationIndex } from "../lib/abc";

type AbcHelpProps = {
  summary: ProductAbcSummaryDto;
  /** Nome do critério em vigor, para o manual falar do que a tela está mostrando. */
  criterionLabel: string;
};

/**
 * O manual da curva ABC.
 *
 * Ele fala com os números que a tela mediu — a concentração da loja, o índice,
 * a divisão entre as classes — e não com o exemplo genérico do "80/20". Um
 * manual que ensina a regra presumida enquanto a tela mostra o número medido faz
 * exatamente o estrago que a tela existe para evitar.
 */
export function AbcHelp({ summary, criterionLabel }: AbcHelpProps) {
  const medido = Math.round(summary.shareOfProductsForEightyPercent);

  return (
    <BiHelpDialog
      screen="Curva ABC de Produtos — como ler"
      summary="Quanto do resultado vem de quantos produtos — medido nesta loja, e não presumido pela regra de Pareto."
      sections={[
        {
          title: "A manchete não é '80/20'",
          icon: LineChart,
          body: (
            <div className="flex flex-col gap-2">
              <p>
                A regra de Pareto <em>prevê</em> que 20% dos produtos façam 80% do resultado. O número desta
                loja no período é <strong className="text-foreground/85">{medido}%</strong> — e é a distância
                entre o previsto e o medido que é a informação, não um erro de medição.
              </p>
              <p>
                Acima de 25%, a cauda é mais longa que a prevista: o resultado vem de muitos itens pequenos, e
                cortar a cauda tira mais do que parece. Abaixo de 15%, a loja depende de poucos campeões, e a
                falta de um deles se sente no caixa.
              </p>
              <p>
                O <strong className="text-foreground/85">índice de concentração</strong> ({" "}
                {summary.concentrationIndex.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}, hoje{" "}
                {readConcentrationIndex(summary.concentrationIndex)}) resume a curva inteira num número. Ele
                existe porque "80/20" é a leitura de UM ponto: duas lojas podem cruzar os 80% no mesmo lugar
                com caudas completamente diferentes.
              </p>
            </div>
          ),
        },
        {
          title: "As três classes",
          icon: ListOrdered,
          body: (
            <div className="flex flex-col gap-2">
              <p>
                Os produtos são ordenados por{" "}
                <strong className="text-foreground/85">{criterionLabel.toLowerCase()}</strong> — o critério do
                filtro — e o acumulado é somado linha a linha.
              </p>
              <ul className="flex flex-col gap-1.5">
                {(["A", "B", "C"] as const).map((classe) => (
                  <li key={classe} className="flex items-start gap-2">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold text-background"
                      style={{ backgroundColor: CLASS_COLORS[classe] }}
                    >
                      {classe}
                    </span>
                    <span>
                      {CLASS_MEANING[classe]} —{" "}
                      <strong className="text-foreground/85">{CLASS_ACTION[classe]}</strong>
                    </span>
                  </li>
                ))}
              </ul>
              <p>
                As três cores são <strong className="text-foreground/85">a mesma matiz em três passos</strong>
                , de propósito: A, B e C têm ORDEM, dizem "mais" e "menos". Elas não dizem "melhor" e "pior" —
                e é por isso que a coluna <em>Leitura</em> existe.
              </p>
            </div>
          ),
        },
        {
          title: "Onde se lê se o produto é bom ou ruim",
          icon: Grid3x3,
          body: (
            <div className="flex flex-col gap-2">
              <p>
                Cada produto é classificado <strong className="text-foreground/85">duas vezes</strong>: por
                faturamento e por lucro. O cruzamento das duas é a matriz — e é a coluna <em>Leitura</em>, na
                tabela, para não ser preciso ir e voltar.
              </p>
              <ul className="flex flex-col gap-1.5">
                <li className="flex items-start gap-2">
                  <Pilula tom="bom" texto="Motor da loja" />
                  <span>classe A nas duas leituras. É o que não pode faltar.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Pilula tom="atencao" texto="Fatura mais do que lucra" />
                  <span>
                    vende bem e devolve pouco. Ocupa prateleira sem pagar por ela — é preço ou custo a rever.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Pilula tom="bom" texto="Lucra mais do que aparece" />
                  <span>
                    não está entre os campeões de venda, mas entrega margem. Vale mais espaço e mais estoque.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Pilula tom="neutro" texto="Coerente" />
                  <span>as duas leituras concordam: o produto pesa o mesmo nas duas.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Pilula tom="mudo" texto="Cauda" />
                  <span>
                    classe C nas duas. <strong className="text-foreground/85">Não é vermelho</strong>: antes
                    de cortar, veja a coluna cesta.
                  </span>
                </li>
              </ul>
            </div>
          ),
        },
        {
          title: "Os quatro achados, e o que fazer com cada um",
          icon: Gem,
          body: (
            <div className="flex flex-col gap-1.5">
              <BiHelpTerm term="Armadilhas de faturamento">
                classe A em venda e fora do A de lucro. Reveja preço e custo antes de comprar mais.
              </BiHelpTerm>
              <BiHelpTerm term="Joias escondidas">
                fora do A de venda e classe A de lucro. Dê espaço melhor na loja e teste mais estoque.
              </BiHelpTerm>
              <BiHelpTerm term="Cauda que puxa cesta">
                itens de classe C que só aparecem em compras acima do ticket médio. Cortá-los{" "}
                <strong className="text-foreground/85">não economiza o que eles custam</strong> — a cesta
                inteira vem junto.
              </BiHelpTerm>
              <BiHelpTerm term="Capital na cauda">
                quanto do estoque está imobilizado em produtos classe C. É a conta de quanto dinheiro a cauda
                está segurando.
              </BiHelpTerm>
              <p className="mt-1">
                Clicar num card recorta a tabela para aqueles produtos. Clicar de novo desfaz — vale também
                para as células da matriz e para os cards A/B/C.
              </p>
            </div>
          ),
        },
        {
          title: "O gráfico não é o Pareto de barras",
          icon: LineChart,
          body: (
            <div className="flex flex-col gap-2">
              <p>
                Os dois eixos são percentuais acumulados: o X é a fatia do catálogo, o Y é a fatia do
                resultado. A <strong className="text-foreground/85">diagonal</strong> é a referência — sobre
                ela, todo produto venderia igual. Quanto mais a curva se afasta dela, mais concentrada é a
                loja.
              </p>
              <p>
                Onde a linha do <strong className="text-foreground/85">lucro corre abaixo</strong> da do
                faturamento, os produtos que mais vendem não são os que mais lucram — é a mesma denúncia da
                coluna Leitura, vista de longe.
              </p>
            </div>
          ),
        },
        {
          title: "Glossário das colunas",
          icon: TriangleAlert,
          body: (
            <div className="flex flex-col gap-1.5">
              <BiHelpTerm term="Acumulado">
                quanto do total do critério já foi somado até aquela linha, descendo do maior para o menor. A
                barra é a própria curva vista de dentro da tabela.
              </BiHelpTerm>
              <BiHelpTerm term="Frequência">
                em quantas semanas do período o produto vendeu. Constante é 60% das semanas ou mais; raro é
                menos de 20%. É o que separa o campeão que vende toda semana do sazonal que fez tudo em quinze
                dias.
              </BiHelpTerm>
              <BiHelpTerm term="Cesta">
                ticket médio das vendas com o produto dividido pelo ticket médio da loja (
                {formatPercent(summary.margin)} de margem, ticket de{" "}
                {summary.averageTicket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}).
                Acima de 1,20× o item aparece em compras claramente maiores que a média.
              </BiHelpTerm>
              <BiHelpTerm term="Prejuízo na curva de lucro">
                entra como zero. Um valor negativo faria o acumulado andar para trás, e um item pior que o
                anterior poderia sair com classe melhor.
              </BiHelpTerm>
            </div>
          ),
        },
      ]}
    />
  );
}

function Pilula({ tom, texto }: { tom: "bom" | "atencao" | "neutro" | "mudo"; texto: string }) {
  return (
    <span
      className={cn(
        "mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[10.5px] font-semibold",
        BI_TONE_PILL[tom],
      )}
    >
      {texto}
    </span>
  );
}
