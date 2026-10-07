import { CalendarX2 } from "lucide-react";

type StaleLocalDataBannerProps = {
  /** O dia do caixa ou da base local deste aparelho ("06/10/2026"), ou `null`. */
  since: string | null;
  /**
   * Celular deitado: uma linha só, com o texto curto. Lá a altura é o que falta
   * (~280px úteis num Android de 360), e a faixa sempre aparece junto da do
   * modo offline — com duas linhas, as duas comiam a lista do carrinho e
   * cortavam o FINALIZAR.
   */
  compact?: boolean;
};

/**
 * "Este aparelho está com o caixa de ontem" — o aviso do celular de contingência
 * (07/10/2026).
 *
 * Vermelho, e não o âmbar da faixa de offline: offline é um estado previsto, e
 * o PDV vende normalmente; isto é um RISCO. A sessão de caixa guardada neste
 * aparelho pode já ter sido fechada no computador, e aí cada venda daqui é
 * recusada quando a internet voltar — com o cliente já atendido. O texto diz o
 * que fazer. Decisão do dono: só avisar; a venda não é bloqueada.
 */
export function StaleLocalDataBanner({ since, compact = false }: StaleLocalDataBannerProps) {
  if (!since) return null;

  if (compact) {
    return (
      <div
        role="alert"
        className="flex h-7 shrink-0 items-center justify-center gap-2 bg-red-600 px-4 text-xs font-medium text-white shadow-md"
      >
        <CalendarX2 className="h-4 w-4 shrink-0" />
        <span className="min-w-0 truncate">
          Caixa e preços de {since}: se esse caixa já fechou, as vendas daqui serão recusadas.
        </span>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="flex shrink-0 items-center justify-center gap-2 bg-red-600 px-4 py-1.5 text-center text-xs font-medium text-white shadow-md sm:text-sm"
    >
      <CalendarX2 className="h-4 w-4 shrink-0" />
      <span>
        Este aparelho está sem internet e com o caixa e os preços de {since}. Se esse caixa já foi fechado, as
        vendas daqui serão recusadas: conecte e abra o PDV antes de vender.
      </span>
    </div>
  );
}
