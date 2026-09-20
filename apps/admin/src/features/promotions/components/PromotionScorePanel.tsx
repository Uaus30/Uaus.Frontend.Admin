import { ScoreGauge } from "@workspace/ui";
import { formatCurrency, formatQuantity } from "@workspace/core";
import {
  PROMOTION_PERFORMANCE_CLASS,
  PROMOTION_PERFORMANCE_CLASS_LABEL,
  enumCode,
  type PromotionScoreComponentDto,
  type PromotionScoreDto,
} from "@workspace/api-client-react";
import { AlertTriangle, Info } from "lucide-react";

/**
 * A nota da relâmpago, com os quatro componentes abertos.
 *
 * ## Por que a nota vem sempre acompanhada da conta
 *
 * Sem os componentes abertos não há como recalibrar peso nenhum depois, e a nota
 * vira um número que se aceita ou se ignora — o oposto do que ela existe para
 * fazer. Os pesos vão mudar depois da primeira temporada de promoções, e a tela
 * precisa mostrar **o que** mudar. É o mesmo princípio do `BiHelpDialog`: o
 * manual fala com os números que a tela mediu, não com o exemplo genérico.
 *
 * ## A nota não julga o passado
 *
 * O dono estava na loja no sábado e viu o movimento. A nota existe para a
 * PRÓXIMA escolha — e é por isso que o painel termina nos fatos que mudam a
 * leitura dela: o esgotamento e as vendas acima do limite. Uma promoção que
 * esgotou às 15h20 não tirou nota baixa por falta de apelo, tirou por falta de
 * mercadoria, e a lição é estoque maior, não trocar o produto.
 */

/** Como cada componente apresenta o que mediu. */
const FORMATO: Record<string, { rotulo: string; formatar: (valor: number) => string }> = {
  volume: { rotulo: "Volume", formatar: (v) => `${formatQuantity(v)} un` },
  dayShare: { rotulo: "Peso no dia", formatar: (v) => `${formatQuantity(v)}%` },
  ticket: { rotulo: "Ticket médio", formatar: (v) => formatCurrency(v) },
  basket: { rotulo: "Arraste", formatar: (v) => `${formatQuantity(v)} outras un` },
};

function ComponenteDaNota({
  componente,
  pesoEfetivo,
  motivoDaExclusao,
}: {
  componente: PromotionScoreComponentDto;
  /** A frase que explica por que ticket e arraste saíram — vem do servidor. */
  motivoDaExclusao?: string | null;
  /**
   * O peso que de fato produziu a nota.
   *
   * Não é sempre o `weight` que a API manda: quando ticket e arraste saem da
   * conta, os dois que sobram são renormalizados (58,3% e 41,7%).
   * Imprimir os pesos nominais ali fazia a conta aberta ao lado do velocímetro
   * **não fechar** com o número dentro dele — 85,71 × 35% + 25 × 25% dá 36, e o
   * ponteiro marcava 60. Era o oposto do motivo de o painel existir.
   */
  pesoEfetivo: number;
}) {
  const formato = FORMATO[componente.key] ?? {
    rotulo: componente.key,
    formatar: (v: number) => formatQuantity(v),
  };

  return (
    <div className={`space-y-1 rounded-lg border p-3 ${componente.excluded ? "opacity-60" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{formato.rotulo}</span>
        <span className="text-xs text-muted-foreground">
          {componente.excluded ? "fora da conta" : `peso ${Math.round(pesoEfetivo * 100)}%`}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-mono text-lg font-bold">{formato.formatar(componente.measured)}</span>
        {/* Alvo só quando ele EXISTE. Produto que nunca saiu naquele dia da semana
            tem régua zerada, e "de R$ 0,00" ao lado de "fora da conta" é ruído
            que o leitor tenta interpretar. */}
        {componente.target > 0 && (
          <span className="text-xs text-muted-foreground">de {formato.formatar(componente.target)}</span>
        )}
      </div>

      {/* A barra é a mesma leitura do número ao lado, para quem bate o olho. Nunca
          sozinha: o valor em pontos vai escrito à direita. */}
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.min(100, Math.max(0, componente.score))}%` }}
          />
        </div>
        <span className="w-16 text-right font-mono text-xs">
          {componente.excluded ? "—" : `${formatQuantity(componente.score)} pts`}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        {componente.excluded
          ? `Fora da conta: ${motivoDaExclusao ?? "não há população comparável"}.`
          : componente.targetSource}
      </p>
    </div>
  );
}

export function PromotionScorePanel({ score }: { score: PromotionScoreDto }) {
  // A API serializa enum pelo NOME: `class` chega como "Standout", não como 1.
  // Comparar direto com o código deixava o velocímetro sem a palavra da faixa e
  // fazia a promoção SEM VENDA mostrar "poucas vendas para medir" em vez de
  // "Sem venda", que é a guarda que este `enumCode` restaura.
  const faixa = enumCode(score.class, PROMOTION_PERFORMANCE_CLASS);
  const semVenda = faixa === PROMOTION_PERFORMANCE_CLASS.NoSales;
  const rotulo = PROMOTION_PERFORMANCE_CLASS_LABEL[faixa ?? 0] ?? "";

  // Só os componentes que entraram na conta dividem os 100%.
  const somaAtiva = score.components
    .filter((componente) => !componente.excluded)
    .reduce((total, componente) => total + componente.weight, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[auto_1fr] lg:items-center">
        <div className="flex justify-center">
          {/* Sem venda NÃO desenha o velocímetro.
              O degradê dele é contínuo e começa em vermelho, então "Sem venda"
              saía como um zero grande e VERMELHO — que lê como fracasso. É
              ausência de medida, e a cor dela é cinza: a promoção pode ter
              começado há dez minutos. A aba gêmea do produto já resolvia assim,
              e o próprio backend escreve "cinza, não vermelho" ao lado da faixa.

              Zero casa decimal no velocímetro: a decimal do produto existe para
              desempatar dois rankings de 888 itens, e algumas dezenas de
              promoções por ano não são ordenadas por nota. */}
          {semVenda ? (
            <div className="flex w-[230px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center">
              <span className="text-2xl font-bold text-muted-foreground">Sem venda</span>
              <span className="text-xs text-muted-foreground">
                Nenhuma unidade saiu com esta promoção — não há nota, e sim ausência de medida.
              </span>
            </div>
          ) : (
            <ScoreGauge score={score.score} rotulo={rotulo} casasDecimais={0} tamanho={230} />
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {score.components.map((componente) => (
            <ComponenteDaNota
              key={componente.key}
              componente={componente}
              pesoEfetivo={somaAtiva <= 0 ? 0 : componente.weight / somaAtiva}
              motivoDaExclusao={score.ticketAndBasketExclusionReason}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-sm">
        <p className="flex items-start gap-2 text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {/* Zero ocorrências não é "régua fraca", é régua NENHUMA: dizer "medido
                contra 0 dias anteriores" e, na frase seguinte, "a régua usou todos
                os dias" é a tela afirmando duas coisas que não aconteceram. */}
            {score.rulerOccurrences === 0 ? (
              <>
                <strong>Sem histórico anterior</strong> para comparar: a loja não tinha venda antes deste dia,
                e volume e peso no dia são o que dá para medir.
              </>
            ) : (
              <>
                Medido contra{" "}
                <strong>
                  {score.rulerOccurrences}{" "}
                  {score.rulerFellBackToAllDays
                    ? score.rulerOccurrences === 1
                      ? "dia"
                      : "dias"
                    : `${score.weekdayName.toLowerCase()}${score.rulerOccurrences === 1 ? "" : "s"}`}
                </strong>{" "}
                {score.rulerOccurrences === 1 ? "anterior" : "anteriores"}.{" "}
                {score.rulerFellBackToAllDays && (
                  <>
                    Como não há {score.weekdayName.toLowerCase()}s suficientes no histórico, a régua usou{" "}
                    <strong>todos os dias</strong> — e por isso ela é mais fraca.
                  </>
                )}
              </>
            )}
          </span>
        </p>

        {/* O MOTIVO vem do servidor, e não é um só: além de "poucas vendas no dia",
            existe "o produto saiu em poucas vendas da régua" — que é o caso
            NORMAL (na dev, 203 dos 241 grupos que venderam nos 12 sábados). Com
            a frase fixa, a tela escrevia "com menos de três vendas" ao lado de
            "Vendas: 30". */}
        {score.renormalizedWithoutTicketAndBasket && !semVenda && (
          <p className="flex items-start gap-2 text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span>
              Ticket e arraste saíram da conta porque{" "}
              {score.ticketAndBasketExclusionReason ?? "não há população comparável"}. A nota saiu só de
              volume e peso no dia.
            </span>
          </p>
        )}

        {/* "Um dia comum" seria mentira quando a régua é de sábados: sábado fatura
            1,75× o dia médio, e a frase genérica subestimaria o múltiplo.

            Sem venda a frase sai de cena inteira: `ImpulseMultiplier(0, x)` é 0, e
            "Vendeu 0× o que o produto sai num sábado normal" é a mesma afirmação de
            fracasso que o velocímetro logo acima se recusa a fazer. */}
        {score.impulseMultiplier != null && !semVenda && (
          <p className="text-muted-foreground">
            Vendeu <strong>{formatQuantity(score.impulseMultiplier)}×</strong> o que o produto sai num{" "}
            {score.rulerFellBackToAllDays ? "dia comum" : score.weekdayName.toLowerCase()} normal.
          </p>
        )}

        {score.salesOverLimit > 0 && (
          <p className="text-muted-foreground">
            <strong>{score.salesOverLimit}</strong>{" "}
            {score.salesOverLimit === 1 ? "venda passou" : "vendas passaram"} do limite por venda — o operador
            liberou no balcão.
          </p>
        )}

        {/* O esgotamento é INFERÊNCIA, e a tela diz isso: a loja não guarda a série
            do saldo, pelo mesmo motivo que o giro do BI é sell-through. */}
        {score.lastSaleAt && (
          <p className="text-muted-foreground">
            Última venda às{" "}
            <strong>{new Date(score.lastSaleAt).toLocaleTimeString("pt-BR").slice(0, 5)}</strong>, com{" "}
            <strong>{score.groupStock}</strong> em estoque hoje.{" "}
            {score.groupStock === 0 && (
              <em>
                Saldo zerado: provavelmente a promoção acabou por falta de mercadoria, não de apelo — é
                inferência, a loja não guarda o saldo hora a hora.
              </em>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
