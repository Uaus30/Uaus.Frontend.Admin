import { Flame, Gauge, ListOrdered, Sparkles } from "lucide-react";
import { cn } from "@workspace/ui";
import type { ProductPerformanceParametersDto } from "@workspace/api-client-react";
import { formatCurrency } from "@workspace/core";
import { BiHelpDialog, BiHelpTerm } from "@/components/bi-help-dialog";
import { formatInteger, formatPercent } from "@/features/supplier-performance/lib/format";
import { BI_TONE_PILL } from "@/lib/bi-tone";
import { ACTION_INFO, CLASS_INFO } from "../lib/performance";

type PerformanceHelpProps = {
  parameters: ProductPerformanceParametersDto;
  size: number;
};

/**
 * O manual da tela de desempenho de produtos.
 *
 * Ele repete os números que a tela usou de verdade — a margem da loja, o giro da
 * loja, os cortes de nota — em vez de citar constantes escritas à mão. Um manual
 * que diz "o alvo é 25%" enquanto a tela mediu 23,17% ensina errado, e é assim
 * que a explicação envelhece sem ninguém perceber.
 */
export function PerformanceHelp({ parameters, size }: PerformanceHelpProps) {
  const faixas = (["Standout", "Steady", "Weak", "Stalled", "New"] as const).map((chave) => ({
    chave,
    info: CLASS_INFO[chave],
  }));

  const acoes = (["RaisePrice", "Restock", "Replicate", "Burn"] as const).map((chave) => ({
    chave,
    info: ACTION_INFO[chave],
  }));

  return (
    <BiHelpDialog
      screen="Desempenho de Produtos — como ler"
      summary="A curva ABC diz quanto cada produto pesa. Esta tela responde a pergunta seguinte: em quais produtos mexer, e no quê."
      sections={[
        {
          title: "O universo é maior que o da curva ABC",
          icon: ListOrdered,
          body: (
            <div className="flex flex-col gap-2">
              <p>
                Entram os produtos vendáveis que <strong className="text-foreground/85">venderam</strong> no
                período <strong className="text-foreground/85">ou</strong> que têm saldo em casa. Quem não
                vendeu e não ocupa prateleira fica de fora — não há decisão pendente sobre ele.
              </p>
              <p>
                É essa diferença que faz existir uma lista dos piores: na curva ABC, quem não vendeu nada
                simplesmente não aparece, porque não há o que acumular. E é justamente o produto que não
                vendeu e está na prateleira que custa dinheiro todo mês.
              </p>
              <p>
                Produto que entrou há menos de {parameters.newProductDays} dias e nunca vendeu fica fora dos
                dois rankings: ele não teve chance, e condená-lo mandaria queimar o estoque que acabou de
                chegar.
              </p>
            </div>
          ),
        },
        {
          title: "A nota, de 0 a 100",
          icon: Gauge,
          body: (
            <div className="flex flex-col gap-2">
              <p>
                Média ponderada de seis medidas. Cinco delas comparam o produto com a{" "}
                <strong className="text-foreground/85">própria loja no período</strong>, e não com um alvo
                inventado — é o que faz a nota separar os produtos entre si em vez de decidir, por fora, que a
                loja inteira vai bem ou vai mal.
              </p>
              <p>
                <strong className="text-foreground/85">É a nota que ordena as duas tabelas</strong>: os piores
                sobem da menor para a maior, os melhores descem da maior para a menor. Por isso ela precisa
                desempatar — as duas últimas medidas existem para isso.
              </p>
              <ul className="flex flex-col gap-1.5">
                <li>
                  <BiHelpTerm term={`Giro (${peso(parameters.turnoverWeight)})`}>
                    quanto do que existia do produto saiu no período. A loja escoou{" "}
                    {formatPercent(parameters.storeSellThrough)} — quem escoa isso tira nota 100.
                  </BiHelpTerm>
                </li>
                <li>
                  <BiHelpTerm term={`Margem (${peso(parameters.marginWeight)})`}>
                    quanto da margem média da loja ({formatPercent(parameters.storeMargin)}) o produto
                    alcança.
                  </BiHelpTerm>
                </li>
                <li>
                  <BiHelpTerm term={`Resultado (${peso(parameters.resultWeight)})`}>
                    o lucro do produto contra o lucro médio por produto que vendeu. É o que impede a nota de
                    virar concurso de percentual: duas unidades com 90% de margem são R$ 6.
                  </BiHelpTerm>
                </li>
                <li>
                  <BiHelpTerm term={`Constância (${peso(parameters.consistencyWeight)})`}>
                    em quantas semanas do período o produto vendeu. Vender em 60% das semanas vale nota cheia
                    — é o que diz se dá para repor por média.
                  </BiHelpTerm>
                </li>
                <li>
                  <BiHelpTerm term={`Capital preso (${peso(parameters.capitalWeight)})`}>
                    quanto POUCO dinheiro o produto segura na prateleira. Quem está na média da loja (
                    {formatCurrency(parameters.averageStockCost)} por produto com saldo) tira 50; o dobro da
                    média tira 33, a metade tira 67. Nunca chega a zero nem a 100 — é o que impede o topo e o
                    fundo da lista de empatarem.
                  </BiHelpTerm>
                </li>
                <li>
                  <BiHelpTerm term={`Liquidez (${peso(parameters.liquidityWeight)})`}>
                    em quanto tempo o saldo sai. Quem dura o que a loja dura (
                    {formatInteger(Math.round(parameters.storeCoverageDays))} dias) tira 50. Quem não vendeu
                    no período não tem ritmo para projetar, e aí conta há quanto tempo está parado — com teto
                    na metade, para nenhum parado passar à frente de quem vendeu.
                  </BiHelpTerm>
                </li>
              </ul>
              <p>
                Quem não vendeu nada no período zera as quatro primeiras — elas medem venda, e não houve. O
                que o posiciona são as duas últimas, e é por isso que os produtos parados deixaram de empatar
                todos na mesma nota.
              </p>
            </div>
          ),
        },
        {
          title: "As cinco situações",
          icon: Sparkles,
          body: (
            <ul className="flex flex-col gap-1.5">
              {faixas.map(({ chave, info }) => (
                <li key={chave} className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-0.5 inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10.5px] font-semibold",
                      BI_TONE_PILL[info.tom],
                    )}
                  >
                    <info.icone className="h-3 w-3" />
                    {info.rotulo}
                  </span>
                  <span>{info.explicacao}</span>
                </li>
              ))}
            </ul>
          ),
        },
        {
          title: "As quatro decisões",
          icon: Flame,
          body: (
            <div className="flex flex-col gap-2">
              <p>
                Cada produto recebe <strong className="text-foreground/85">uma só</strong> ação. Quando mais
                de uma caberia, vale esta ordem: queimar vem primeiro (é o único caso com dinheiro parado
                agora), e subir o preço vem antes de repor — um produto que vai faltar e vende com margem
                apertada precisa do preço corrigido <em>antes</em> da próxima compra.
              </p>
              <ul className="flex flex-col gap-1.5">
                {acoes.map(({ chave, info }) => (
                  <li key={chave} className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-0.5 inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10.5px] font-semibold",
                        BI_TONE_PILL[info.tom],
                      )}
                    >
                      <info.icone className="h-3 w-3" />
                      {info.rotulo}
                    </span>
                    <span>{info.explicacao}</span>
                  </li>
                ))}
              </ul>
              <p>
                Clicar num dos quatro cards recorta as duas tabelas para aquela decisão. A contagem do card é
                da loja inteira, e as tabelas mostram os {size} primeiros de cada lado — por isso a tabela
                pode trazer menos linhas do que o card anuncia.
              </p>
            </div>
          ),
        },
        {
          title: "A ordem das tabelas, e como trocá-la",
          icon: Flame,
          body: (
            <div className="flex flex-col gap-2">
              <p>
                As duas listas descem pela <strong className="text-foreground/85">nota</strong>: os piores da
                menor para a maior, os melhores ao contrário. A posição na coluna{" "}
                <strong className="text-foreground/85">#</strong> é sempre a da nota — ela não muda quando
                você ordena por outra coluna, e é isso que permite ver que o produto que mais ocupa prateleira
                é o 47º pior, e não o primeiro.
              </p>
              <p>
                <strong className="text-foreground/85">Clique no nome de uma coluna para reordenar</strong> —
                produto, nota, em risco, vendidos, faturamento, margem, estoque e dura respondem ao clique;
                clicar de novo inverte o sentido. A reordenação é sobre as {size} linhas que já estão na tela,
                e não um novo pedido ao servidor: trocar o conjunto embaixo de quem está lendo responderia
                outra pergunta.
              </p>
              <p>
                <strong className="text-foreground/85">Capital em risco</strong> é o custo do que está na
                prateleira ponderado pela parte de VENDA da nota, mais o prejuízo já realizado. Dos R$ 400
                parados num produto que vende como nota 10, R$ 360 estão em risco; num nota 90, R$ 40. O peso
                é só a parte de venda porque o capital preso já entra na nota cheia — usá-la aqui contaria o
                mesmo dinheiro duas vezes.
              </p>
              <p>
                Produto <strong className="text-foreground/85">Destaque</strong> nunca entra na lista dos
                piores, por mais estoque que tenha. O dinheiro dele continua contado no capital em risco
                total, no cartão do topo.
              </p>
            </div>
          ),
        },
        {
          title: "Glossário das colunas",
          body: (
            <div className="flex flex-col gap-1.5">
              <BiHelpTerm term="Giro">
                quanto do que existia (vendido + saldo) saiu no período. Vendeu tudo o que tinha: 100%.
              </BiHelpTerm>
              <BiHelpTerm term="Dura">
                por quanto tempo o saldo aguenta no ritmo do período. Até {parameters.shortCoverageDays} dias
                é risco de faltar; a partir de um ano é estoque demais.
              </BiHelpTerm>
              <BiHelpTerm term="Margem">
                lucro sobre o faturamento do que foi vendido. Quem não vendeu no período não tem essa margem,
                e a coluna mostra a <strong className="text-foreground/85">de entrada</strong> — preço de hoje
                contra o custo da última entrada de estoque —, marcada com a palavra "entrada" embaixo. É ela
                que diz quanto espaço existe para descontar num produto parado. Verde a partir de{" "}
                {formatPercent(parameters.healthyMarginThreshold, 0)}, vermelho abaixo de{" "}
                {formatPercent(parameters.lowMarginThreshold, 0)} — a mesma faixa da entrada de estoque.
              </BiHelpTerm>
              <BiHelpTerm term="Em risco">
                o capital em risco da linha. Só aparece na tabela dos piores, que é a única em que a pergunta
                "quanto dinheiro está preso aqui" faz sentido.
              </BiHelpTerm>
            </div>
          ),
        },
      ]}
    />
  );
}

/** Peso em percentual inteiro: `0.3` vira "30%". */
function peso(fracao: number): string {
  return `${Math.round(fracao * 100)}%`;
}
