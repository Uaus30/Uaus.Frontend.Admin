import React from "react";
import { CalendarDays, ExternalLink, Lock, Receipt, Trash2, Truck, UserRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui";
import { Button } from "@workspace/ui";
import { ConfirmDialog } from "@workspace/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui";
import { Spinner } from "@workspace/ui";
import type { ReceivedPurchaseEntryDto, ReceivedPurchaseEntryItemDto } from "@workspace/api-client-react";
import { purchaseDetailPathname } from "@/features/purchases/purchases-route";
import { EntryItemCostCell } from "./EntryItemCostCell";
import { describeCostCorrectionImpact } from "../lib/cost-correction";
import type { CostCorrectionPayload } from "../hooks/useEntryCostCorrection";

type StockEntryDetailsModalProps = {
  /** A modal está aberta. */
  open: boolean;
  /** Fechar e abrir. */
  onOpenChange: (open: boolean) => void;
  /** Entrada aberta. Aparece no título enquanto os detalhes carregam. */
  selectedEntryId: number | null;
  /**
   * O espelho da nota. `undefined` enquanto a consulta não respondeu — é o que
   * o React Query devolve, e o tipo do api-client é o mesmo que a API serializa.
   */
  entryDetails: ReceivedPurchaseEntryDto | undefined;
  /** A consulta dos detalhes está em andamento. */
  isLoadingDetails: boolean;
  formatCurrency: (val: number) => string;
  formatShortDate: (dateStr: string) => string;
  /**
   * Cancela a entrada: apaga os lotes dela, recalcula o saldo dos produtos e
   * devolve para "A caminho" a compra que a lançou, quando houve uma.
   */
  onDelete: (payload: { id: number }) => void;
  /**
   * Corrige o custo de um item da ÚLTIMA entrada da variação. Rejeita quando o
   * servidor recusa — é o que mantém a confirmação aberta. Sem ele, o lápis da
   * correção fica desligado.
   */
  onCorrectUnitCost?: (payload: CostCorrectionPayload) => Promise<void>;
  /** Uma correção de custo está em andamento. */
  isCorrectingCost?: boolean;
};

/**
 * O espelho da nota de entrada, com os itens recebidos e o cancelamento.
 *
 * **É o único lugar que vê e cancela uma entrada** desde 13/09/2026, quando a
 * listagem `/estoque/entradas` saiu do admin: quem chega aqui vem da aba
 * **Estoque** do cadastro do produto, pelo olho da linha.
 *
 * O cancelamento **só existe enquanto o lote está intacto** (`canDelete`, do
 * backend): apagar a entrada apaga os lotes dela, e lote com unidade já vendida
 * não tem como voltar atrás. Antes, o botão simplesmente não aparecia nesse
 * caso, e a tela ficava parecendo quebrada — hoje ela diz por quê.
 *
 * Desde 14/09/2026 o cancelamento **também devolve a compra** que lançou a nota
 * para "A caminho", e a confirmação avisa. Sem esse aviso, quem cancela pela aba
 * Estoque do produto mexe numa compra que não está vendo — e o efeito é bom
 * (antes ela ficava travada em "Lançado" sem saída), mas surpresa em tela de
 * estoque é como se perde a confiança no botão.
 *
 * Desde 23/09/2026 **o custo da última entrada se corrige aqui** (decisão do
 * dono): o lápis ao lado do custo unitário aparece só no item cujo lote é o mais
 * recente da variação, e a confirmação diz o que muda junto — o lucro das vendas
 * que já consumiram o lote. Quantidade e o resto da nota continuam sem edição. A
 * seção dos itens virou **Recebimento** (a entrada é de um produto só, com as
 * variações dele) e ganhou o link para a compra que a lançou, de onde sai o link
 * do anúncio quando a compra foi num marketplace.
 */
export function StockEntryDetailsModal({
  open,
  onOpenChange,
  selectedEntryId,
  entryDetails,
  isLoadingDetails,
  formatCurrency,
  formatShortDate,
  onDelete,
  onCorrectUnitCost,
  isCorrectingCost = false,
}: StockEntryDetailsModalProps) {
  // O cancelamento mexe em estoque de verdade — recalcula saldo de produto.
  // A confirmação vira estado para poder ser lida e testada, em vez de um
  // window.confirm que trava a aba enquanto o operador decide.
  const [cancelConfirmOpen, setCancelConfirmOpen] = React.useState(false);
  // A correção de custo pedida pela célula, esperando a confirmação.
  const [custoPendente, setCustoPendente] = React.useState<{
    item: ReceivedPurchaseEntryItemDto;
    unitCost: number;
  } | null>(null);
  // Um custo está sendo digitado: o Esc é da célula ("desisto"), não da nota.
  const [editandoCusto, setEditandoCusto] = React.useState(false);
  // A nota fechada com o campo aberto desmonta a célula sem avisar; sem isto, a
  // próxima abertura seguraria o Esc à toa. Ajustado durante o render, como o
  // resto do admin faz com estado derivado de prop.
  if (!open && editandoCusto) setEditandoCusto(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] max-w-3xl flex-col"
        onEscapeKeyDown={(evento) => {
          if (editandoCusto) evento.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Detalhes da Entrada #{selectedEntryId}
          </DialogTitle>
          <DialogDescription>Dados da entrada de mercadoria e do recebimento.</DialogDescription>
        </DialogHeader>

        {isLoadingDetails || !entryDetails ? (
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <>
            <div className="mt-4 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-4 rounded-xl border border-border/50 bg-muted/20">
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Fornecedor</span>
                  <span
                    className="text-sm font-semibold flex items-center gap-1.5"
                    title={entryDetails.supplierName}
                  >
                    <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                    {entryDetails.supplierName}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Data</span>
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    {formatShortDate(entryDetails.entryDate)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Nota Fiscal</span>
                  <span className="text-sm font-semibold font-mono">
                    {entryDetails.invoiceNumber || "Não informada"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Valor Total</span>
                  <span className="text-sm font-bold text-emerald-500">
                    {formatCurrency(entryDetails.total)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Lançada por</span>
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                    {/* Notas anteriores a 31/08/2026 não gravavam o autor. */}
                    {entryDetails.userName || "Não registrado"}
                  </span>
                </div>
              </div>

              {entryDetails.notes && (
                <div className="p-3 bg-muted/10 rounded-lg border border-border/30">
                  <span className="text-xs text-muted-foreground block mb-1">Observações</span>
                  <p className="text-sm text-foreground/80">{entryDetails.notes}</p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">Recebimento</h4>
                  {entryDetails.purchaseId != null && (
                    <a
                      href={purchaseDetailPathname(entryDetails.purchaseId)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Abrir a compra #${entryDetails.purchaseId}, que lançou esta entrada, em nova aba`}
                      title="Abrir a compra que lançou esta entrada"
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Compra #{entryDetails.purchaseId}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                <div className="border border-border/40 rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="px-4 py-2">Produto</TableHead>
                        <TableHead className="px-4 py-2">Cód. Barras</TableHead>
                        <TableHead className="px-4 py-2 text-right">Qtd.</TableHead>
                        <TableHead className="px-4 py-2 text-right">Custo Unit.</TableHead>
                        <TableHead className="px-4 py-2 text-right">Preço de Venda</TableHead>
                        <TableHead className="px-4 py-2 text-right">Custo Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entryDetails.items.map((item) => (
                        <TableRow key={item.id} className="hover:bg-muted/5">
                          <TableCell className="px-4 py-2 text-sm font-medium">{item.productName}</TableCell>
                          <TableCell className="px-4 py-2 text-sm font-mono text-xs">
                            {item.barcode}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-sm font-semibold text-right">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-sm text-right">
                            <EntryItemCostCell
                              item={item}
                              formatCurrency={formatCurrency}
                              disabled={!onCorrectUnitCost || isCorrectingCost}
                              onEditingChange={setEditandoCusto}
                              onSubmit={(unitCost) => setCustoPendente({ item, unitCost })}
                            />
                          </TableCell>
                          <TableCell className="px-4 py-2 text-sm text-right text-emerald-500 font-semibold">
                            {formatCurrency(item.productPrice)}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-sm text-right font-semibold">
                            {formatCurrency(item.totalCost)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4 flex items-center justify-between gap-3 border-t border-border/40 pt-4">
              {entryDetails.canDelete ? (
                <Button
                  type="button"
                  variant="destructive"
                  className="mr-auto gap-2"
                  onClick={() => setCancelConfirmOpen(true)}
                >
                  <Trash2 className="h-4 w-4" /> Cancelar Entrada
                </Button>
              ) : (
                /* O botão sumia sem explicação, e a tela parecia quebrada para
                   quem tinha acabado de cancelar outra entrada. O motivo é sempre
                   o mesmo, e é definitivo: parte do lote já saiu. */
                <p className="mr-auto flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Esta entrada não pode mais ser cancelada: parte do que ela trouxe já saiu do estoque. Para
                    corrigir o saldo, use a Contagem Física na aba Estoque do produto.
                  </span>
                </p>
              )}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </DialogFooter>

            <ConfirmDialog
              open={cancelConfirmOpen}
              onOpenChange={setCancelConfirmOpen}
              title="Cancelar esta entrada de estoque?"
              itemName={`Entrada #${entryDetails.id} — ${entryDetails.supplierName} — ${formatCurrency(entryDetails.total)}`}
              /* A compra volta junto desde 14/09/2026, e quem cancela aqui não
                 tem como saber disso — a aba Estoque não fala de Compras. O "se"
                 é obrigatório: a mesma nota serve à entrada lançada direto por
                 esta aba, que não veio de compra nenhuma, e o espelho da nota
                 não guarda qual dos dois caminhos a criou. */
              description="Isto removerá os lotes de estoque associados e recalculará o estoque atual dos produtos. Os itens recebidos nesta nota deixam de contar no saldo. Se ela veio de uma compra, a compra volta para A caminho e pode ser lançada de novo. A nota cancelada não volta."
              confirmLabel="Sim, cancelar entrada"
              destructive
              onConfirm={() => onDelete({ id: entryDetails.id })}
            />

            <ConfirmDialog
              open={custoPendente !== null}
              onOpenChange={(aberto) => {
                if (!aberto) setCustoPendente(null);
              }}
              title="Corrigir o custo desta entrada?"
              itemName={
                custoPendente
                  ? `${custoPendente.item.productName} — de ${formatCurrency(custoPendente.item.unitCost)} para ${formatCurrency(custoPendente.unitCost)} por unidade`
                  : undefined
              }
              description={
                custoPendente ? describeCostCorrectionImpact(custoPendente.item, entryDetails.purchaseId) : ""
              }
              confirmLabel="Sim, corrigir o custo"
              loading={isCorrectingCost}
              onConfirm={async () => {
                if (!custoPendente || !onCorrectUnitCost) return;
                await onCorrectUnitCost({
                  entryId: entryDetails.id,
                  itemId: custoPendente.item.id,
                  unitCost: custoPendente.unitCost,
                });
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
