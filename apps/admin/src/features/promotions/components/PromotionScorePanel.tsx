import { ScoreGauge } from "@workspace/ui";
import { formatCurrency, formatQuantity } from "@workspace/core";
import {
  PROMOTION_PERFORMANCE_CLASS,
  PROMOTION_PERFORMANCE_CLASS_LABEL,
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

function ComponenteDaNota({ componente }: { componente: PromotionScoreComponentDto }) {
  const formato = FORMATO[componente.key] ?? {
    rotulo: componente.key,
    formatar: (v: number) => formatQuantity(v),
  };

  return (
    <div className={`space-y-1 rounded-lg border p-3 ${componente.excluded ? "opacity-60" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{formato.rotulo}</span>
        <span className="text-xs text-muted-foreground">peso {Math.round(componente.weight * 100)}%</span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-mono text-lg font-bold">{formato.formatar(componente.measured)}</span>
        <span className="text-xs text-muted-foreground">de {formato.formatar(componente.target)}</span>
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
        {componente.excluded ? "Fora da conta: poucas vendas para medir." : componente.targetSource}
      </p>
    </div>
  );
}

export function PromotionScorePanel({ score }: { score: PromotionScoreDto }) {
  const semVenda = score.class === PROMOTION_PERFORMANCE_CLASS.NoSales;
  const rotulo = PROMOTION_PERFORMANCE_CLASS_LABEL[score.class] ?? "";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[auto_1fr] lg:items-center">
        <div className="flex justify-center">
          {/* Zero casa decimal: a decimal do produto existe para desempatar dois
              rankings de 888 itens, e algumas dezenas de promoções por ano não
              são ordenadas por nota. */}
          <ScoreGauge score={score.score} rotulo={rotulo} casasDecimais={0} tamanho={230} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {score.components.map((componente) => (
            <ComponenteDaNota key={componente.key} componente={componente} />
          ))}
        </div>
      </div>

      <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-sm">
        <p className="flex items-start gap-2 text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Medido contra{" "}
            <strong>
              {score.rulerOccurrences} {score.weekdayName.toLowerCase()}
              {score.rulerOccurrences === 1 ? "" : "s"}
            </strong>{" "}
            anteriores.{" "}
            {score.rulerFellBackToAllDays && (
              <>
                Como não há {score.weekdayName.toLowerCase()}s suficientes no histórico, a régua usou{" "}
                <strong>todos os dias</strong> — e por isso ela é mais fraca.
              </>
            )}
          </span>
        </p>

        {score.renormalizedWithoutTicketAndBasket && !semVenda && (
          <p className="flex items-start gap-2 text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span>
              Com menos de três vendas, ticket e arraste são ruído: a nota saiu só de volume e peso no dia.
            </span>
          </p>
        )}

        {score.impulseMultiplier != null && (
          <p className="text-muted-foreground">
            Vendeu <strong>{formatQuantity(score.impulseMultiplier)}×</strong> o de um dia comum do produto.
          </p>
        )}

        {score.salesOverLimit > 0 && (
          <p className="text-muted-foreground">
            <strong>{score.salesOverLimit}</strong> venda(s) passaram do limite por venda — o operador liberou
            no balcão.
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
