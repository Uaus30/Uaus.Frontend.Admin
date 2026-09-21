import { Card, cn } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { COMPARISON_DIMENSION, type MixPriceSplitDto } from "@workspace/api-client-react";
import { BiCardHelp, BiCardHelpExample } from "@/components/bi-card-help";
import { BI_TONE_FILL, BI_TONE_TEXT } from "@/lib/bi-tone";
import { formatPercent } from "@/features/supplier-performance/lib/format";
import { DIMENSION_WORDS, deltaTone } from "../lib/comparison";

type MixPricePanelProps = {
  mixPrice: MixPriceSplitDto;
};

/**
 * Bloco 3 — por que o valor da peça mudou.
 *
 * <b>Os dois efeitos pedem ações opostas</b>, e é só por isso que vale separá-los:
 * mix se corrige comprando diferente (a loja passou a vender outras linhas),
 * preço se corrige precificando diferente (a mesma linha saiu mais barata).
 * Juntos num número só, a leitura vira "as coisas estão mais baratas" — que não
 * é uma decisão.
 */
export function MixPricePanel({ mixPrice }: MixPricePanelProps) {
  // A régua vem do servidor e é FIXA — não acompanha o seletor da tabela de
  // baixo. Se acompanhasse, a recomendação se inverteria quando o usuário
  // trocasse de dimensão para olhar outro bloco.
  // O `??` não é decoração: uma dimensão que o front ainda não conhece — um
  // valor novo no enum do backend — chega aqui como `undefined` e estoura na
  // linha de baixo. O `ErrorBoundary` da rota (`App.tsx`) pega e mostra a tela de
  // recuperação, mas perder a tela inteira por um campo a mais no contrato é caro
  // demais para o preço de um `??`.
  const palavras =
    DIMENSION_WORDS[COMPARISON_DIMENSION[mixPrice.measuredBy]] ??
    DIMENSION_WORDS[COMPARISON_DIMENSION.Category];

  // O servidor manda até 20 linhas mais um balde; a tela cabe em 8. O restante
  // sai da SUBTRAÇÃO contra o total do cabeçalho, e não da soma do que veio:
  // assim ele cobre de uma vez as linhas que o servidor agrupou e as que a tela
  // cortou, e a coluna fecha com o número de cima. Truncar em silêncio escondia
  // de 25% a 33% do efeito sem nada dizendo que faltava.
  const maiores = mixPrice.contributions.filter((x) => x.id != null).slice(0, 8);

  const mixRestante = arredondar(mixPrice.mixEffect - somar(maiores, "mixEffect"));
  const precoRestante = arredondar(mixPrice.priceEffect - somar(maiores, "priceEffect"));
  const temRestante = mixRestante !== 0 || precoRestante !== 0;
  const maior = Math.max(...maiores.map((x) => Math.abs(x.totalEffect)), 0.01);

  return (
    <Card className="border-border/60 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-1">
          <h2 className="text-[15px] font-semibold">Mix ou preço</h2>
          <MixPriceHelp palavras={palavras} />
        </div>
        <p className="text-[11.5px] text-muted-foreground">
          valor por peça: {formatCurrency(mixPrice.previousRevenuePerUnit)} →{" "}
          {formatCurrency(mixPrice.currentRevenuePerUnit)}
        </p>
      </div>

      {/* A frase que diz o que FAZER, montada com os números medidos. Sem ela o
          cartão entrega dois valores e deixa a tradução por conta de quem lê — e
          a tradução errada ("o preço médio caiu R$ 0,65") é a mais natural. */}
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-foreground/80">
        {lerVeredito(mixPrice, palavras)}
      </p>

      <p className="mt-1 text-[11.5px] text-muted-foreground">
        medido por {palavras.singular} — a régua é fixa, para a resposta não mudar quando você troca a
        dimensão da tabela
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Efeito
          titulo="Mix"
          explicacao={`a loja passou a vender ${palavras.artigoOutras} ${palavras.plural}`}
          porPeca={mixPrice.mixEffect}
          emReais={mixPrice.mixAmount}
        />
        <Efeito
          titulo="Preço"
          explicacao={`${palavras.artigoMesma} ${palavras.singular} saiu por outro preço`}
          porPeca={mixPrice.priceEffect}
          emReais={mixPrice.priceAmount}
        />
      </div>

      {maiores.length > 0 && (
        <div className="mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Quem mais mexeu no valor da peça
          </p>

          <div className="mt-2.5 flex flex-col gap-2">
            {maiores.map((linha) => {
              const tone = deltaTone(linha.totalEffect);

              return (
                <div key={`${linha.id ?? "residual"}-${linha.name}`} className="flex flex-col gap-0.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[12.5px]">{linha.name}</span>
                    <span
                      className={cn("shrink-0 text-[12.5px] font-medium tabular-nums", BI_TONE_TEXT[tone])}
                    >
                      {linha.totalEffect > 0 ? "+" : ""}
                      {formatCurrency(linha.totalEffect)}
                      <span className="ml-1 text-[11px] font-normal text-muted-foreground">por peça</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60">
                      <div
                        className={cn("h-full rounded-full", BI_TONE_FILL[tone])}
                        style={{ width: `${(Math.abs(linha.totalEffect) / maior) * 100}%` }}
                      />
                    </div>
                    <span className="w-40 shrink-0 text-right text-[10.5px] text-muted-foreground">
                      {formatPercent(linha.previousUnitShare, 0)} → {formatPercent(linha.currentUnitShare, 0)}{" "}
                      das peças · {formatCurrency(linha.previousAveragePrice)} →{" "}
                      {formatCurrency(linha.currentAveragePrice)}
                    </span>
                  </div>
                </div>
              );
            })}

            {temRestante && (
              <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-border pt-2 text-muted-foreground">
                <span className="text-[12.5px]">Todo o restante</span>
                <span className="shrink-0 text-[12.5px] tabular-nums">
                  mix {mixRestante > 0 ? "+" : ""}
                  {formatCurrency(mixRestante)} · preço {precoRestante > 0 ? "+" : ""}
                  {formatCurrency(precoRestante)}
                  <span className="ml-1 text-[11px]">por peça</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

type Palavras = (typeof DIMENSION_WORDS)[keyof typeof DIMENSION_WORDS];

/**
 * O cartão em uma frase: qual dos dois efeitos domina e o que fazer com isso.
 *
 * Os dois números sozinhos não dizem o que fazer — e a leitura mais natural
 * deles está errada. "Mix de −R$ 0,65" soa como "o preço médio caiu R$ 0,65",
 * que é a definição do OUTRO efeito.
 */
function lerVeredito(mixPrice: MixPriceSplitDto, palavras: Palavras): string {
  const mix = mixPrice.mixEffect;
  const preco = mixPrice.priceEffect;
  const total = Math.abs(mix) + Math.abs(preco);

  if (total < 0.005) {
    return `O valor da peça praticamente não mudou entre os dois períodos.`;
  }

  const sentido = mixPrice.change < 0 ? "queda" : "alta";
  const fatia = Math.round((Math.max(Math.abs(mix), Math.abs(preco)) / total) * 100);

  return Math.abs(preco) >= Math.abs(mix)
    ? `${fatia}% da ${sentido} veio de PREÇO: ${palavras.artigoMesma} ${palavras.singular} está saindo por outro valor. Olhe precificação, desconto e promoção.`
    : `${fatia}% da ${sentido} veio de MIX: a loja está vendendo ${palavras.artigoOutras} ${palavras.plural}, não as mesmas mais baratas. Olhe o que está comprando e expondo.`;
}

/** O manual deste cartão, com o exemplo que separa os dois efeitos. */
function MixPriceHelp({ palavras }: { palavras: Palavras }) {
  return (
    <BiCardHelp titulo="Mix ou preço">
      <p>
        O <strong className="text-foreground/85">valor por peça</strong> é o faturamento dividido pelas peças
        vendidas. Quando ele cai, há duas causas possíveis — e elas pedem ações opostas.
      </p>

      <BiCardHelpExample>
        <p className="font-medium">Imagine que a loja venda só camiseta de R$ 20 e pote de R$ 4.</p>
        <table className="mt-2 w-full text-[11.5px]">
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-1 pr-2">50 camisetas + 50 potes</td>
              <td className="py-1 text-right tabular-nums">R$ 12,00 por peça</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-1 pr-2">
                <strong className="text-foreground/85">25</strong> camisetas +{" "}
                <strong className="text-foreground/85">75</strong> potes
              </td>
              <td className="py-1 text-right tabular-nums">R$ 8,00 por peça</td>
            </tr>
            <tr>
              <td className="py-1 pr-2">
                50 camisetas a <strong className="text-foreground/85">R$ 16</strong> + 50 potes
              </td>
              <td className="py-1 text-right tabular-nums">R$ 10,00 por peça</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2">
          Na linha do meio <strong className="text-foreground/85">nenhum preço mudou</strong> — a camiseta
          continua R$ 20. A média caiu porque a loja vendeu mais pote. Isso é{" "}
          <strong className="text-foreground/85">mix</strong>. Na última, vendeu as mesmas coisas mais barato:
          isso é <strong className="text-foreground/85">preço</strong>.
        </p>
      </BiCardHelpExample>

      <p>
        <strong className="text-foreground/85">Mix</strong> — mudou o QUE a loja vende. Corrige-se comprando e
        expondo diferente.
        <br />
        <strong className="text-foreground/85">Preço</strong> — mudou POR QUANTO a mesma {palavras.singular}{" "}
        sai. Corrige-se precificando diferente, ou olhando desconto e promoção.
      </p>

      <p>
        Somados, os dois reproduzem exatamente a variação do valor por peça. A lista de baixo mostra quem mais
        mexeu, com a fatia de peças e o preço médio de cada um — dá para ver os dois efeitos na mesma linha.
      </p>

      <p>
        A medição é sempre por <strong className="text-foreground/85">categoria</strong>, mesmo com a tabela
        quebrada por outra dimensão: a fronteira entre mix e preço É a granularidade, e numa régua fina quase
        tudo viraria mix — o preço de um produto quase não varia.
      </p>
    </BiCardHelp>
  );
}

/** Soma um dos efeitos das linhas já exibidas. */
function somar(linhas: MixPriceSplitDto["contributions"], campo: "mixEffect" | "priceEffect"): number {
  return linhas.reduce((total, linha) => total + linha[campo], 0);
}

/** Centavos, para a subtração do restante não carregar lixo de ponto flutuante. */
function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Um dos dois efeitos, com a leitura por peça e a tradução em reais do período. */
function Efeito({
  titulo,
  explicacao,
  porPeca,
  emReais,
}: {
  titulo: string;
  explicacao: string;
  porPeca: number;
  emReais: number;
}) {
  const tone = deltaTone(porPeca);

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</p>
      <p className={cn("mt-1 text-[22px] font-semibold leading-none tabular-nums", BI_TONE_TEXT[tone])}>
        {porPeca > 0 ? "+" : ""}
        {formatCurrency(porPeca)}
        <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">por peça</span>
      </p>
      <p className="mt-1.5 text-[11.5px] text-muted-foreground">{explicacao}</p>
      {/* "se o resto tivesse ficado igual" não é floreio: este número NÃO soma
          com a barra da ponte, que reparte também o efeito cruzado com os outros
          três fatores. Sem a ressalva, somá-los conta o mesmo dinheiro duas vezes. */}
      <p className="mt-1 text-[11.5px]">
        <span className="text-muted-foreground">nas peças do período, se o resto tivesse ficado igual: </span>
        <span className={cn("font-medium tabular-nums", BI_TONE_TEXT[tone])}>
          {emReais > 0 ? "+" : ""}
          {formatCurrency(emReais)}
        </span>
      </p>
    </div>
  );
}
