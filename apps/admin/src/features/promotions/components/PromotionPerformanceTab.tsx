import {
  PROMOTION_TYPE,
  enumCode,
  useGetPromotionPerformance,
  type PromotionEverydayDto,
} from "@workspace/api-client-react";
import { formatCurrency, formatDate, formatQuantity } from "@workspace/core";
import { Loader2 } from "lucide-react";
import { PromotionInvestmentPanel } from "./PromotionInvestmentPanel";
import { PromotionScorePanel } from "./PromotionScorePanel";

/**
 * A aba Performance de uma promoção.
 *
 * Relâmpago traz nota; Dia a Dia traz totalizadores. Os dois trazem a escada de
 * reais, o histórico do produto e quem saiu junto — e é o histórico que responde
 * a pergunta que a nota não responde: **este produto é bom para promoção?**
 *
 * Nada aqui é consolidado: todos os números são calculados na leitura, com as
 * réguas ancoradas na própria promoção. A mesma promoção mostra os mesmos
 * números hoje e daqui a um ano.
 */

function TotaisDoDiaADia({ everyday }: { everyday: PromotionEverydayDto }) {
  const subiu = (everyday.impulsePercent ?? 0) >= 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border p-3">
        <p className="text-xs text-muted-foreground">Unidades por dia</p>
        <p className="font-mono text-xl font-bold">{formatQuantity(everyday.unitsPerDay)}</p>
        <p className="text-xs text-muted-foreground">
          antes: {formatQuantity(everyday.unitsPerDayBefore)} / dia
        </p>
      </div>

      <div className="rounded-lg border p-3">
        <p className="text-xs text-muted-foreground">Impulso</p>
        {/* Verde é "positivo" e vermelho é "negativo" no vocabulário da casa, e
            nunca cor sozinha: o sinal vai escrito junto. Sem ritmo anterior não
            há impulso a mostrar — não houve alta infinita, houve estreia. */}
        {everyday.impulsePercent == null ? (
          <p className="font-mono text-xl font-bold text-muted-foreground">—</p>
        ) : (
          <p
            className={`font-mono text-xl font-bold ${subiu ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
          >
            {subiu ? "+" : "−"}
            {formatQuantity(Math.abs(everyday.impulsePercent))}%
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {everyday.impulsePercent == null ? "o produto não vendia antes" : "contra os 30 dias anteriores"}
        </p>
      </div>

      <div className="rounded-lg border p-3">
        <p className="text-xs text-muted-foreground">Margem praticada</p>
        <p className="font-mono text-xl font-bold">
          {everyday.marginPercent == null ? "—" : `${formatQuantity(everyday.marginPercent)}%`}
        </p>
        <p className="text-xs text-muted-foreground">
          antes:{" "}
          {everyday.marginPercentBefore == null ? "—" : `${formatQuantity(everyday.marginPercentBefore)}%`}
        </p>
      </div>

      <div className="rounded-lg border p-3">
        <p className="text-xs text-muted-foreground">Ticket com o produto</p>
        <p className="font-mono text-xl font-bold">{formatCurrency(everyday.ticket)}</p>
        <p className="text-xs text-muted-foreground">loja: {formatCurrency(everyday.storeTicket)}</p>
      </div>
    </div>
  );
}

export function PromotionPerformanceTab({ promotionId }: { promotionId: number }) {
  const { data, isLoading, isError } = useGetPromotionPerformance(promotionId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Medindo a promoção...
      </div>
    );
  }

  /*
   * Sem este ramo a aba girava PARA SEMPRE: depois das tentativas, `isLoading` vira
   * falso e `data` continua indefinido, então um `if (isLoading || !data)` caía de
   * volta no spinner — sem toast, sem mensagem, e com o dono concluindo que a tela
   * travou. A aba gêmea do produto já resolvia assim.
   */
  if (isError || !data) {
    return (
      <p className="py-12 text-sm text-destructive">Não foi possível carregar o desempenho desta promoção.</p>
    );
  }

  const relampago = enumCode(data.type, PROMOTION_TYPE) === PROMOTION_TYPE.Flash;

  return (
    <div className="space-y-6">
      {data.isRunning && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          A promoção ainda está no ar: os números são parciais.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Unidades no preço promocional</p>
          <p className="font-mono text-xl font-bold">{data.soldUnits}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Vendas</p>
          <p className="font-mono text-xl font-bold">{data.salesCount}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Faturamento das linhas promocionais</p>
          <p className="font-mono text-xl font-bold">{formatCurrency(data.revenue)}</p>
        </div>
      </div>

      {relampago && data.score && <PromotionScorePanel score={data.score} />}
      {!relampago && data.everyday && <TotaisDoDiaADia everyday={data.everyday} />}

      <PromotionInvestmentPanel
        investment={data.investment}
        showPerDay={!relampago}
        soldUnits={data.soldUnits}
      />

      {data.companions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Saíram junto</h3>
          <div className="rounded-lg border">
            {data.companions.map((produto) => (
              <div
                key={produto.productId}
                className="flex items-baseline justify-between gap-4 border-b px-3 py-2 last:border-b-0"
              >
                <span className="min-w-0 truncate text-sm">{produto.productName}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {produto.units} un · {formatCurrency(produto.profit)} de lucro
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.groupHistory.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Este produto em outras promoções</h3>
          <p className="text-xs text-muted-foreground">É o número que decide se ele volta ao cartaz.</p>
          <div className="rounded-lg border">
            {data.groupHistory.map((anterior) => (
              <div
                key={anterior.promotionId}
                className="flex items-baseline justify-between gap-4 border-b px-3 py-2 last:border-b-0"
              >
                <span className="text-sm">{formatDate(anterior.validFrom)}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {anterior.soldUnits} un · {formatCurrency(anterior.investment)}
                  {anterior.score != null && (
                    <strong className="ml-2 text-foreground">nota {anterior.score}</strong>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
