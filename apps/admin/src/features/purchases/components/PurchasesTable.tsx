import {
  ImageIcon,
  Loader2,
  MoreVertical,
  Package,
  PackageCheck,
  Pencil,
  Search,
  Trash2,
  Truck,
} from "lucide-react";
import { Link } from "wouter";
import { Button, ImageHoverZoom, Input, Spinner } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui";
import { PURCHASE_STATUS, buildPublicImageUrl, enumCode } from "@workspace/api-client-react";
import { formatCurrency, formatPercentage, formatShortDate, marginBand } from "@workspace/core";
import type { PurchaseDto } from "../types";
import { STATUS_FILTER_ALL, STATUS_FILTER_OPEN } from "../hooks/usePurchases";
import { purchaseMarginPercent } from "../lib/purchase-totals";
import { PurchaseStatusBadge } from "./PurchaseStatusBadge";

/** A cor de cada faixa de margem. Mesma regra da entrada de estoque e do recebimento. */
const MARGIN_COLOR: Record<string, string> = {
  healthy: "text-emerald-600",
  tight: "text-amber-600",
  low: "text-red-600",
};

type PurchasesTableProps = {
  items: PurchaseDto[];
  isLoading: boolean;
  searchValue: string;
  setSearch: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  page: number;
  totalPages: number;
  setPage: (value: number) => void;
  onEdit: (purchase: PurchaseDto) => void;
  onDelete: (id: number) => void;
  onSetStatus: (id: number, status: number) => void;
  onReceive: (purchase: PurchaseDto) => void;
  mutatingId: number | null | undefined;
};

/**
 * Listagem de compras.
 *
 * As colunas de dinheiro respondem à pergunta que a tela existe para responder:
 * <b>por quanto entrou e quanto sobra</b>. Ficaram o unitário final — o custo que
 * o lote vai gravar — e a <b>margem prevista</b>, nas mesmas faixas de cor de
 * toda tela que mostra margem (verde a partir de 40%, amarelo de 30% a 40%,
 * vermelho abaixo). O <b>total final saiu</b> em 13/09/2026: é a soma de um
 * pedido cujo tamanho varia, então R$ 1.500 e R$ 30 não se comparam entre linhas
 * — quem compara é o unitário. O total continua a um clique, na compra.
 *
 * <b>Abaixo de `2xl` a tabela se reduz ao essencial</b> — produto, fornecedor,
 * quantidade, situação e ações. Com as oito colunas a largura mínima passava de
 * 1.200px, e a área útil de quem usa o notebook a 125% de zoom (ou o monitor
 * auxiliar da loja) é de ~1.140px: sobrava uma barra de rolagem horizontal, e o
 * que ficava fora da tela era justamente a ponta direita — a situação e o menu
 * de opções, que é onde se clica.
 *
 * <b>A linha inteira abre a compra, e o nome do produto também</b> (13/09/2026).
 * O nome era link para o cadastro do produto, e clicar nele no meio de uma lista
 * de compras levava para outra tela — o gesto mais natural da linha fazia a
 * única coisa que não era "ver esta compra". O cadastro do produto continua a um
 * clique, no menu de opções.
 */
export function PurchasesTable({
  items,
  isLoading,
  searchValue,
  setSearch,
  statusFilter,
  setStatusFilter,
  page,
  totalPages,
  setPage,
  onEdit,
  onDelete,
  onSetStatus,
  onReceive,
  mutatingId,
}: PurchasesTableProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-border/50 bg-card/50 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por produto, fornecedor ou detalhe..."
            className="pl-9"
            aria-label="Buscar compra"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]" aria-label="Situação">
            <SelectValue placeholder="Situação" />
          </SelectTrigger>
          <SelectContent>
            {/* "Não lançadas" é o padrão: a tela responde "o que ainda está por
                chegar", e a lançada já vive na aba de estoque do produto. */}
            <SelectItem value={STATUS_FILTER_OPEN}>Não lançadas</SelectItem>
            <SelectItem value={STATUS_FILTER_ALL}>Todas as situações</SelectItem>
            <SelectItem value={String(PURCHASE_STATUS.Pending)}>Pendente</SelectItem>
            <SelectItem value={String(PURCHASE_STATUS.InTransit)}>A caminho</SelectItem>
            <SelectItem value={String(PURCHASE_STATUS.Received)}>Lançado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Truck className="mx-auto mb-3 h-12 w-12 opacity-20" />
          <p>Nenhuma compra registrada neste recorte.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/40">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-4 py-3">Produto</TableHead>
                <TableHead className="px-4 py-3">Fornecedor</TableHead>
                <TableHead className="px-4 py-3 text-right">Qtd.</TableHead>
                <TableHead className="hidden px-4 py-3 text-right 2xl:table-cell">Unit. final</TableHead>
                <TableHead className="hidden px-4 py-3 text-right 2xl:table-cell">Margem</TableHead>
                <TableHead className="px-4 py-3">Situação</TableHead>
                <TableHead className="hidden px-4 py-3 2xl:table-cell">Data da compra</TableHead>
                <TableHead className="w-16 px-4 py-3 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((purchase) => {
                const status = enumCode(purchase.status, PURCHASE_STATUS);
                const received = status === PURCHASE_STATUS.Received;
                // Pendente é a anotação de "preciso comprar isto": o pedido ainda
                // não foi fechado, e é ali que o custo pode nem existir. Receber
                // dali pularia a etapa que diz que a compra saiu.
                const pending = status === PURCHASE_STATUS.Pending;
                const busy = mutatingId === purchase.id;
                const cover = purchase.images[0];
                // Custo zero é "ainda não informado" — só compra pendente fica assim — e
                // R$ 0,00 leria como "de graça". O traço diz que o número não existe.
                const hasCost = purchase.finalTotal > 0;
                const margin = purchaseMarginPercent(purchase);
                const band = marginBand(margin);
                return (
                  <TableRow
                    key={purchase.id}
                    data-testid="purchase-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => onEdit(purchase)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onEdit(purchase);
                      }
                    }}
                    aria-label={`Abrir a compra de ${purchase.productName}`}
                    className="cursor-pointer"
                  >
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {cover ? (
                          <ImageHoverZoom
                            src={buildPublicImageUrl(cover.url)}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-md border border-border/50 bg-white object-contain"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted/40">
                            <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                          </div>
                        )}
                        {/* O teto de largura é o que faz o `truncate` abaixo VALER. Numa
                            tabela de layout automático a largura mínima da coluna é a do
                            conteúdo, e texto com `white-space: nowrap` mede o nome
                            INTEIRO — `overflow: hidden` não encolhe essa conta, e o
                            `min-w-0` só solta o piso do flex. Sem teto, um nome de 63
                            caracteres (o maior do catálogo) pedia sozinho ~600px e
                            empurrava a tabela para fora da tela. Com ele o nome longo vira
                            reticências, e o completo continua no `title` e na compra, que
                            a linha abre. */}
                        {/* O nome NÃO é link para o cadastro do produto: clicar nele
                            abre esta compra, como o resto da linha. O cadastro está
                            no menu de opções, que é onde se procura por "ir para
                            outro lugar". */}
                        <div className="min-w-0 max-w-[20rem]">
                          <p className="truncate font-medium text-foreground" title={purchase.productName}>
                            {purchase.productName}
                            {!purchase.productGroupId && (
                              <span className="text-xs font-normal text-muted-foreground">
                                {" "}
                                (produto novo)
                              </span>
                            )}
                          </p>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {/* Com várias variações o código de barras é de UMA
                                delas e não representa a compra; o selo responde
                                melhor "quantas cores vieram nesse pedido". */}
                            {purchase.items.length > 1 ? (
                              <span className="font-sans">{purchase.items.length} variações</span>
                            ) : (
                              (purchase.productBarcode ?? purchase.details ?? "")
                            )}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm">{purchase.supplierName}</TableCell>
                    <TableCell className="px-4 py-3 text-right font-mono text-sm">
                      {purchase.quantity}
                    </TableCell>
                    <TableCell className="hidden px-4 py-3 text-right text-sm 2xl:table-cell">
                      {hasCost ? (
                        <>
                          <span className="font-semibold">{formatCurrency(purchase.unitFinal)}</span>
                          {purchase.adjustmentPercent !== 0 && (
                            <span
                              className={`ml-1 text-xs ${purchase.adjustmentPercent < 0 ? "text-emerald-600" : "text-amber-600"}`}
                              title="Desconto (ou acréscimo) negociado sobre o total bruto"
                            >
                              ({purchase.adjustmentPercent > 0 ? "+" : ""}
                              {formatPercentage(purchase.adjustmentPercent)})
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground" title="Custo ainda não informado">
                          —
                        </span>
                      )}
                    </TableCell>
                    {/* Margem prevista: quanto sobra vendendo pelo preço decidido na
                        compra (ou, sem ele, pelo preço que o produto já tem). Mesmas
                        faixas de cor de toda tela que mostra margem. */}
                    <TableCell className="hidden px-4 py-3 text-right text-sm 2xl:table-cell">
                      {margin === null || band === null ? (
                        <span className="text-muted-foreground" title="Sem custo ou sem preço de venda">
                          —
                        </span>
                      ) : (
                        <span
                          className={`font-semibold ${MARGIN_COLOR[band]}`}
                          title={
                            purchase.suggestedPrice
                              ? `Sobre o preço sugerido nesta compra (${formatCurrency(purchase.suggestedPrice)})`
                              : `Sobre o preço atual do produto (${formatCurrency(purchase.productPrice ?? 0)})`
                          }
                        >
                          {formatPercentage(margin)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <PurchaseStatusBadge status={purchase.status} />
                    </TableCell>
                    {/* E a data da COMPRA, que e por onde a listagem tambem ordena — nao a de
                        criacao da linha, que so responde "quando isso foi digitado".

                        O `||` cobre a JANELA DE DEPLOY: o front e a API sobem em servicos
                        diferentes, e enquanto a API antiga responde sem `purchaseDate` o
                        `formatShortDate` receberia undefined — `Intl` lanca em data invalida, e
                        a listagem inteira deixaria de renderizar por causa de uma coluna. */}
                    <TableCell className="hidden px-4 py-3 text-sm text-muted-foreground 2xl:table-cell">
                      {formatShortDate(purchase.purchaseDate || purchase.createdAt)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={`Opções da compra ${purchase.id}`}
                              disabled={busy}
                              onClick={(event) => event.stopPropagation()}
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreVertical className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                            {/* Pendente não se recebe: o pedido ainda não foi
                                fechado e o custo pode nem existir. O caminho é
                                "Marcar como a caminho", que já exige o custo de
                                que a entrada precisa. */}
                            {!received && (
                              <DropdownMenuItem
                                disabled={pending}
                                onClick={() => onReceive(purchase)}
                                title={
                                  pending
                                    ? "Marque a compra como a caminho antes de lançar o recebimento."
                                    : undefined
                                }
                              >
                                <PackageCheck className="mr-2 h-4 w-4 text-emerald-600" /> Lançar recebimento
                              </DropdownMenuItem>
                            )}
                            {/* O cadastro do produto: o destino que o nome da linha
                                deixou de ser. Sem produto cadastrado não há para
                                onde ir — a compra é de algo que ainda não existe —,
                                e a opção aparece desabilitada em vez de sumir, para
                                a mesma linha ter sempre o mesmo menu. */}
                            {purchase.productGroupId ? (
                              <DropdownMenuItem asChild>
                                <Link href={`/produtos/${purchase.productGroupId}/detalhes`}>
                                  <Package className="mr-2 h-4 w-4" /> Abrir cadastro do produto
                                </Link>
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem disabled title="Este produto ainda não foi cadastrado.">
                                <Package className="mr-2 h-4 w-4" /> Abrir cadastro do produto
                              </DropdownMenuItem>
                            )}
                            {!received && status !== PURCHASE_STATUS.InTransit && (
                              <DropdownMenuItem
                                onClick={() => onSetStatus(purchase.id, PURCHASE_STATUS.InTransit)}
                              >
                                <Truck className="mr-2 h-4 w-4" /> Marcar como a caminho
                              </DropdownMenuItem>
                            )}
                            {!received && status !== PURCHASE_STATUS.Pending && (
                              <DropdownMenuItem
                                onClick={() => onSetStatus(purchase.id, PURCHASE_STATUS.Pending)}
                              >
                                <Truck className="mr-2 h-4 w-4" /> Voltar para pendente
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => onEdit(purchase)}>
                              <Pencil className="mr-2 h-4 w-4" /> {received ? "Ver detalhes" : "Editar"}
                            </DropdownMenuItem>
                            {!received && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => onDelete(purchase.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Excluir
                              </DropdownMenuItem>
                            )}
                            {received && (
                              <DropdownMenuItem disabled>Lançada — não pode ser alterada</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
