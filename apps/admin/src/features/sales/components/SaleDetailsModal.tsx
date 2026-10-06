import React from "react";
import { Loader2, Printer, Receipt } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui";
import { Badge } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { computeSaleDiscountTotal, formatCurrency, formatDate, round2 } from "@workspace/core";
import { useGetSaleDetails } from "@workspace/api-client-react";

/**
 * Um item da venda no recorte que o modal lê, seja qual for a origem: o detalhe
 * da API (`SaleItemDto`) ou a lista enriquecida da tela (`EnrichedSale`).
 * Estrutural de propósito, para o modal não ter que escolher entre os dois
 * tipos — nem cair no `any` que escolhia por ele.
 */
type SaleDetailsItem = {
  id: number;
  productId: number;
  productName?: string | null;
  product?: { name?: string | null } | null;
  quantity: number;
  /** Preço unitário praticado, já líquido do desconto e já com o acréscimo do item. */
  unitPrice: number;
  /**
   * Desconto unitário do item, em reais; o preço de tabela era
   * `unitPrice + discount − surcharge`.
   */
  discount?: number | null;
  /**
   * Acréscimo unitário do item — o serviço cobrado junto do produto. Já está
   * dentro de `unitPrice`.
   */
  surcharge?: number | null;
  /** Justificativa do acréscimo, como o operador a escreveu no balcão. */
  surchargeReason?: string | null;
  subtotal: number;
  unitCost?: number | null;
  totalCost?: number | null;
};

/** Uma forma de pagamento da venda, das duas origens. */
type SaleDetailsPayment = {
  id: number;
  paymentMethodId: number;
  paymentMethodName?: string | null;
  amount: number | null;
};

/**
 * A venda no recorte que o modal desenha — o `SaleDto` da API e a
 * `EnrichedSale` da listagem cabem nele. Estrutural pelo mesmo motivo dos
 * itens: quem abre o modal a partir de outra tela (a aba Vendas do produto) não
 * tem a venda enriquecida em mãos, só o id.
 */
export type SaleDetailsSale = {
  id: number;
  createdAt: string;
  total: number;
  discount: number;
  notes?: string | null;
  customerName?: string | null;
  customerDocument?: string | null;
  customer?: { name?: string | null } | null;
  userName?: string | null;
  paymentMethodId?: number | null;
  paymentMethodName?: string | null;
  payments?: SaleDetailsPayment[];
  items?: SaleDetailsItem[];
};

type SaleDetailsModalProps = {
  /** Visibility status of the modal */
  open: boolean;
  /** Callback triggered when visibility status changes */
  onOpenChange: (open: boolean) => void;
  /**
   * A venda a exibir, quando quem abre já a tem (a listagem de Vendas): o
   * cabeçalho aparece na hora, e o detalhe da API completa itens e pagamentos.
   */
  saleToView?: SaleDetailsSale | null;
  /**
   * Só o id, quando quem abre não tem a venda em mãos (a aba Vendas do
   * produto). O modal busca tudo na API e mostra o carregamento até chegar.
   * Ignorado quando `saleToView` veio.
   */
  saleId?: number | null;
  /** Map of payment methods names */
  paymentMethodById?: Record<number, string>;
  /**
   * Reimpressão do cupom. Opcional: fora da tela de Vendas ninguém tem a
   * cadeia do cupom montada, e o botão simplesmente não aparece.
   */
  onPrintReceipt?: (id: number) => void;
  /** Active sale ID having its receipt printed, or null */
  printingSaleId?: number | null;
};

/** Sem forma cadastrada em mãos, o nome vem da própria venda. */
const SEM_FORMAS: Record<number, string> = {};

/**
 * SaleDetailsModal
 *
 * Dialog component showing purchase details and transaction aggregates.
 */
export function SaleDetailsModal({
  open,
  onOpenChange,
  saleToView = null,
  saleId = null,
  paymentMethodById = SEM_FORMAS,
  onPrintReceipt,
  printingSaleId = null,
}: SaleDetailsModalProps) {
  const id = saleToView?.id ?? saleId ?? null;
  const { data: saleDetails, isLoading: loadingDetails } = useGetSaleDetails(open && id ? id : undefined);

  // O detalhe da API é a fonte mais completa; a venda da listagem segura o
  // cabeçalho enquanto ele não chega.
  const sale: SaleDetailsSale | null = saleDetails ?? saleToView;
  const items: SaleDetailsItem[] = saleDetails?.items ?? saleToView?.items ?? [];
  const payments: SaleDetailsPayment[] = saleDetails?.payments ?? saleToView?.payments ?? [];

  /** Subtotal LÍQUIDO: a soma dos itens ao preço praticado. É a base do lucro. */
  const itemsSubtotal = items.reduce((sum, item) => sum + (item.subtotal ?? 0), 0);

  /**
   * Subtotal BRUTO, a preço de tabela. É o que o rodapé mostra: com o desconto
   * de item somado na linha "Desconto", a conta só fecha de cima para baixo se
   * o subtotal for o de antes de qualquer abatimento (22,00 − 2,00 = 20,00).
   */
  const grossSubtotal = round2(
    items.reduce((sum, item) => sum + (item.unitPrice + Math.max(0, item.discount ?? 0)) * item.quantity, 0),
  );

  /**
   * Quanto da venda foi serviço cobrado na linha, e não produto.
   *
   * Sai em linha própria no rodapé porque ele já está dentro do subtotal bruto
   * acima — a linha não soma nem subtrai nada, ela DISCRIMINA. Sem ela, o
   * acréscimo se confunde com preço de produto exatamente como se confundiria se
   * nunca tivesse ganhado coluna.
   */
  const surchargeTotal = round2(
    items.reduce((sum, item) => sum + Math.max(0, item.surcharge ?? 0) * item.quantity, 0),
  );
  const totalCost = items.reduce((sum, item) => sum + (item.totalCost ?? 0), 0);
  const hasCost = items.some((item) => item.totalCost != null);

  /**
   * Tudo o que foi abatido: desconto de item, da venda e cupom. `discount` do
   * cabeçalho sozinho não inclui o desconto de item — ele já saiu do preço
   * gravado — e o modal dizia "sem desconto" para a venda remarcada só no item.
   * É a mesma conta do histórico e do cupom do PDV.
   */
  const discountTotal = computeSaleDiscountTotal({ discount: sale?.discount ?? 0, items });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col border-border/50 bg-card sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-display">
            <Receipt className="h-5 w-5 text-primary" /> Detalhes da Venda #{id?.toString().padStart(4, "0")}
          </DialogTitle>
        </DialogHeader>
        {/* Só com o id em mãos o cabeçalho ainda não existe: a espera é da venda inteira. */}
        {!sale && loadingDetails && (
          <div className="flex items-center justify-center py-12" data-testid="sale-details-loading">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {sale && (
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto py-4 pr-2">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Data</p>
                <p className="mt-1 font-medium">{formatDate(sale.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Consumidor</p>
                <p className="mt-1 font-medium">
                  {sale.customerName || sale.customer?.name || "Consumidor Final"}
                </p>
                {sale.customerDocument && (
                  <p className="font-mono text-xs text-muted-foreground">{sale.customerDocument}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Operador</p>
                <p className="mt-1 font-medium">
                  {sale.userName || <span className="text-muted-foreground">Não informado</span>}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Pagamento</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {payments.length > 0 ? (
                    payments.map((payment) => (
                      <Badge key={payment.id} variant="secondary">
                        {payment.paymentMethodName || paymentMethodById[payment.paymentMethodId] || "—"}
                        {payments.length > 1 && payment.amount != null && (
                          <span className="ml-1 opacity-70">{formatCurrency(payment.amount)}</span>
                        )}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="secondary">
                      {sale.paymentMethodName ||
                        (sale.paymentMethodId ? paymentMethodById[sale.paymentMethodId] : null) ||
                        "Não informado"}
                    </Badge>
                  )}
                </div>
              </div>
              {sale.notes && (
                <div className="col-span-2 mt-2 rounded-r border-l-2 border-primary/50 bg-primary/5 py-1 pl-3">
                  <p className="text-xs text-muted-foreground">Observação</p>
                  <p className="italic">{sale.notes}</p>
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-border/50">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 sm:px-4">Item</th>
                    <th className="hidden px-4 py-2 text-center sm:table-cell">Qtd</th>
                    <th className="hidden px-4 py-2 text-right sm:table-cell">Unitário</th>
                    <th className="hidden px-4 py-2 text-right sm:table-cell">Custo un.</th>
                    <th className="px-3 py-2 text-right sm:px-4">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingDetails ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                        Nenhum item encontrado nesta venda.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="border-b border-border/50 last:border-0">
                        <td className="px-3 py-3 font-medium sm:px-4">
                          {item.productName || item.product?.name || `Produto #${item.productId}`}
                          {/* Celular: quantidade, preço e custo embaixo do nome. As
                              cinco colunas, dentro da caixa `overflow-hidden`,
                              CORTAVAM o Subtotal sem deixar rolar até ele. */}
                          <p className="mt-0.5 text-xs font-normal text-muted-foreground sm:hidden">
                            {item.quantity} × {formatCurrency(item.unitPrice)}
                            {(item.discount ?? 0) > 0 && (
                              <span className="ml-1 line-through">
                                {formatCurrency(round2(item.unitPrice + (item.discount ?? 0)))}
                              </span>
                            )}
                            {item.unitCost != null && <> · custo {formatCurrency(item.unitCost)}</>}
                          </p>
                          {/* Âmbar, o "atenção" da casa: a linha tem cobrança
                              além do produto. Nunca cor sozinha — o rótulo e o
                              motivo escrito pelo operador vêm junto, que é o que
                              responde "por que essa venda deu R$ 5,00 a mais". */}
                          {(item.surcharge ?? 0) > 0 && (
                            <p className="text-[11px] text-amber-500">
                              + {formatCurrency(round2((item.surcharge ?? 0) * item.quantity))} ·{" "}
                              {item.surchargeReason || "Acréscimo sem justificativa"}
                            </p>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 text-center sm:table-cell">{item.quantity}</td>
                        <td className="hidden px-4 py-3 text-right sm:table-cell">
                          {formatCurrency(item.unitPrice)}
                          {/* Preço de tabela riscado quando houve desconto no item: é o
                              mesmo sinal que o carrinho do PDV dá, e sem ele o desconto
                              do rodapé não teria de onde ter vindo. */}
                          {(item.discount ?? 0) > 0 && (
                            <p className="text-[11px] text-muted-foreground line-through">
                              {formatCurrency(round2(item.unitPrice + (item.discount ?? 0)))}
                            </p>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 text-right text-muted-foreground sm:table-cell">
                          {item.unitCost != null ? formatCurrency(item.unitCost) : "—"}
                        </td>
                        <td className="px-3 py-3 text-right font-medium sm:px-4">
                          {formatCurrency(item.subtotal)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-border/50 bg-background/50 p-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal Itens</span>
                {/* Sem os itens em mãos (detalhe ainda carregando), o único
                    desconto conhecido é o do cabeçalho — e a conta fecha do
                    mesmo jeito: total + cabeçalho − cabeçalho. */}
                <span>{formatCurrency(items.length > 0 ? grossSubtotal : sale.total + sale.discount)}</span>
              </div>
              {/* DISCRIMINA, não soma: o acréscimo já está dentro do subtotal
                  logo acima. Por isso "dos quais" e não um "+" — um sinal ali
                  faria a coluna deixar de fechar de cima para baixo. */}
              {surchargeTotal > 0 && (
                <div className="flex justify-between text-amber-500">
                  <span>dos quais acréscimo em itens</span>
                  <span>{formatCurrency(surchargeTotal)}</span>
                </div>
              )}
              {discountTotal > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Desconto</span>
                  <span>-{formatCurrency(discountTotal)}</span>
                </div>
              )}
              {hasCost && items.length > 0 && (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Custo dos itens</span>
                    <span>{formatCurrency(totalCost)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Lucro</span>
                    <span>{formatCurrency(itemsSubtotal - totalCost)}</span>
                  </div>
                </>
              )}
              <div className="mt-1 flex justify-between border-t border-border/50 pt-2 text-lg font-bold text-primary">
                <span>Total</span>
                <span>{formatCurrency(sale.total)}</span>
              </div>
            </div>
          </div>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          {onPrintReceipt ? (
            <Button
              variant="outline"
              disabled={!sale || printingSaleId === sale.id}
              onClick={() => sale && onPrintReceipt(sale.id)}
            >
              {sale && printingSaleId === sale.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Printer className="mr-2 h-4 w-4" />
              )}
              Imprimir cupom
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
