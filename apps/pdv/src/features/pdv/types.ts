import type { PdvConsumer, PdvItem } from "@/stores/use-pdv-store";
import type { CheckoutPayment } from "@/hooks/use-checkout";

export type { PdvConsumer, PdvItem, CheckoutPayment };

/**
 * Venda gravada, no formato único que a tela usa depois de confirmar o
 * pagamento.
 *
 * São três origens com respostas diferentes — a venda nova pela API, a reedição
 * (`SaleDto`) e a venda que ficou na fila offline — e nada depois da gravação
 * precisa saber de qual delas veio. Sem esta normalização, cada ramo (aviso na
 * tela, cupom, histórico) se ramificava de novo, e foi assim que o cupom da
 * reedição saiu uma vez sem o número da venda.
 */
export interface SavedSale {
  /** Número impresso no cupom: o ID do banco, ou `OFF-n` na venda offline. */
  receiptNumber: number | string;
  /** Momento da venda. */
  createdAt: string | Date;
  total: number;
  notes: string | null;
  /**
   * CPF/CNPJ que a origem devolveu. Nulo no registro: ali o documento está em
   * mãos, no carrinho, e a API não devolveria nada que o balcão já não saiba.
   */
  customerDocument: string | null;
  /** A venda ficou na fila local em vez de ir ao servidor. */
  offline: boolean;
}
