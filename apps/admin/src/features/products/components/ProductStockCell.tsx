import { stockTag, type StockSignals } from "../lib/stockSignal";

type ProductStockCellProps = StockSignals & {
  stock: number;
  /**
   * `pill`: a coluna de estoque (computador e variações). `text`: a linha de
   * resumo do celular, embaixo do nome, onde não cabe uma pílula.
   */
  variant?: "pill" | "text";
};

/**
 * A quantidade em estoque da listagem, com o destaque do controle de estoque
 * (04/10/2026).
 *
 * - **Vermelho só no mínimo**: controlado e com o saldo no mínimo que vale para
 *   ele (o próprio ou o padrão da loja), ou esgotado. Até aqui era "menos de 10",
 *   que pintava 961 dos 1.176 vendáveis — o vermelho não dizia nada.
 * - **"Comprar!"**, pulsando, quando o produto está no relatório de estoque
 *   baixo. Pode aparecer sem o vermelho: o relatório inclui quem ainda tem saldo
 *   mas não dura trinta dias.
 * - **"Comprado"**, em verde, com compra "A caminho" — e prevalece sobre
 *   "Comprar!" (ver `stockTag`).
 */
export function ProductStockCell({ stock, variant = "pill", ...signals }: ProductStockCellProps) {
  const tag = stockTag(signals);
  const alerta = signals.atMinimumStock === true;

  return (
    <span
      className={
        variant === "pill" ? "inline-flex flex-col items-start gap-1" : "inline-flex items-center gap-1.5"
      }
    >
      {variant === "pill" ? (
        <span
          className={`inline-block w-max rounded-md px-2.5 py-1 text-xs font-semibold ${
            alerta ? "bg-destructive/20 text-destructive" : "bg-secondary text-secondary-foreground"
          }`}
        >
          {stock} un
        </span>
      ) : (
        <span className={alerta ? "font-semibold text-destructive" : "text-muted-foreground"}>
          {stock} un
        </span>
      )}

      {tag === "bought" && (
        <span
          className="inline-block w-max rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
          title="Já existe compra deste produto com status A caminho."
        >
          Comprado
        </span>
      )}
      {tag === "buy" && (
        <span
          className="animate-restock-glow inline-block w-max rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive-foreground"
          title="Está no relatório de estoque baixo: esgotado, acabando em menos de 30 dias ou no estoque mínimo."
        >
          Comprar!
        </span>
      )}
    </span>
  );
}
