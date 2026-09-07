import { Flame, Gauge, ListOrdered, Sparkles } from "lucide-react";
import { cn } from "@workspace/ui";
import type { ProductPerformanceParametersDto } from "@workspace/api-client-react";
import { BiHelpDialog, BiHelpTerm } from "@/components/bi-help-dialog";
import { formatPercent } from "@/features/supplier-performance/lib/format";
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
                Média ponderada de quatro medidas. Três delas comparam o produto com a{" "}
                <strong className="text-foreground/85">própria loja no período</strong>, e não com um alvo
                inventado — é o que faz a nota separar os produtos entre si em vez de decidir, por fora, que a
                loja inteira vai bem ou vai mal.
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
              </ul>
              <p>Quem não vendeu nada no período fica com zero, e as quatro parciais zeram junto.</p>
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
          title: "Por que os piores saem por dinheiro, e não por nota",
          icon: Flame,
          body: (
            <div className="flex flex-col gap-2">
              <p>
                <strong className="text-foreground/85">Capital em risco</strong> é o custo do que está na
                prateleira ponderado pela nota, mais o prejuízo já realizado. Dos R$ 400 parados num produto
                nota 10, R$ 360 estão em risco; num nota 90, R$ 40.
              </p>
              <p>
                Ordenar os piores pela nota empilharia no topo centenas de itens de cinco reais que não
                venderam — todos com zero — e empurraria para a quarta página os oitocentos reais parados num
                produto só. A pergunta desta lista é onde está o dinheiro, e ela se responde em reais.
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
                lucro sobre o faturamento do que foi vendido. Verde a partir de{" "}
                {formatPercent(parameters.healthyMarginThreshold, 0)}, vermelho abaixo de{" "}
                {formatPercent(parameters.lowMarginThreshold, 0)} — a mesma faixa da entrada de estoque.
              </BiHelpTerm>
              <BiHelpTerm term="Em risco">
                o capital em risco da linha. Só aparece na tabela dos piores, que é a única em que ele decide
                a ordem.
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
