import {
  ExternalLink,
  ImageIcon,
  Loader2,
  MoreVertical,
  PackageCheck,
  Pencil,
  Search,
  Trash2,
  Truck,
} from "lucide-react";
import { Link } from "wouter";
import { Button, Input, Spinner } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui";
import { PURCHASE_STATUS, buildPublicImageUrl, enumCode } from "@workspace/api-client-react";
import { formatCurrency, formatPercentage, formatShortDate } from "@workspace/core";
import type { PurchaseDto } from "../types";
import { STATUS_FILTER_ALL, STATUS_FILTER_OPEN } from "../hooks/usePurchases";
import { PurchaseStatusBadge } from "./PurchaseStatusBadge";

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
 * A coluna de valor mostra o total FINAL com o percentual de desconto ou
 * acréscimo ao lado: é o número que o operador confere contra o extrato, e o
 * bruto sozinho esconderia o frete ou o desconto que fecham a conta.
 *
 * <b>Abaixo de `2xl` a tabela se reduz ao essencial</b> — produto, fornecedor,
 * quantidade, situação e ações. Com as oito colunas a largura mínima passa de
 * 1.200px, e a área útil de quem usa o notebook a 125% de zoom (ou o monitor
 * auxiliar da loja) é de ~1.140px: sobrava uma barra de rolagem horizontal, e o
 * que ficava fora da tela era justamente a ponta direita — a situação e o menu
 * de opções, que é onde se clica. Total final, unitário final e data da compra
 * seguem a um clique de distância, porque a linha abre a compra; a barra de
 * rolagem, não. Quem tem monitor largo continua vendo tudo.
 *
 * <b>A linha inteira abre a compra.</b> O botão verde de receber saiu daqui: ele
 * já existia por extenso no menu de opções, e ocupar a coluna de ações com uma
 * duplicata deixava a listagem sem o gesto mais óbvio de todos, que é clicar na
 * linha para ver o que se comprou. Compra já lançada abre em leitura — o backend
 * recusa alterá-la, e um formulário editável que não salva é pior que um
 * bloqueado que explica.
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
                <TableHead className="hidden px-4 py-3 text-right 2xl:table-cell">Total final</TableHead>
                <TableHead className="hidden px-4 py-3 text-right 2xl:table-cell">Unit. final</TableHead>
                <TableHead className="px-4 py-3">Situação</TableHead>
                <TableHead className="hidden px-4 py-3 2xl:table-cell">Data da compra</TableHead>
                <TableHead className="w-16 px-4 py-3 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((purchase) => {
                const status = enumCode(purchase.status, PURCHASE_STATUS);
                const received = status === PURCHASE_STATUS.Received;
                const busy = mutatingId === purchase.id;
                const cover = purchase.images[0];
                // Custo zero é "ainda não informado" — só compra pendente fica assim — e
                // R$ 0,00 leria como "de graça". O traço diz que o número não existe.
                const hasCost = purchase.finalTotal > 0;
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
                          <img
                            src={buildPublicImageUrl(cover.url)}
                            alt=""
                            loading="lazy"
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
                        <div className="min-w-0 max-w-[20rem]">
                          {purchase.productGroupId ? (
                            <Link
                              href={`/produtos/${purchase.productGroupId}/detalhes`}
                              className="block truncate font-medium text-foreground hover:text-primary hover:underline"
                              title={purchase.productName}
                              onClick={(event) => event.stopPropagation()}
                            >
                              {purchase.productName}
                            </Link>
                          ) : (
                            <p className="truncate font-medium text-foreground" title={purchase.productName}>
                              {purchase.productName}{" "}
                              <span className="text-xs font-normal text-muted-foreground">
                                (produto novo)
                              </span>
                            </p>
                          )}
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {purchase.productBarcode ?? purchase.details ?? ""}
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
                          <span className="font-semibold">{formatCurrency(purchase.finalTotal)}</span>
                          {purchase.adjustmentPercent !== 0 && (
                            <span
                              className={`ml-1 text-xs ${purchase.adjustmentPercent < 0 ? "text-emerald-600" : "text-amber-600"}`}
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
                    <TableCell className="hidden px-4 py-3 text-right text-sm 2xl:table-cell">
                      {hasCost ? (
                        formatCurrency(purchase.unitFinal)
                      ) : (
                        <span className="text-muted-foreground" title="Custo ainda não informado">
                          —
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
                            {!received && (
                              <DropdownMenuItem onClick={() => onReceive(purchase)}>
                                <PackageCheck className="mr-2 h-4 w-4 text-emerald-600" /> Lançar recebimento
                              </DropdownMenuItem>
                            )}
                            {purchase.purchaseLink && (
                              <DropdownMenuItem asChild>
                                <a href={purchase.purchaseLink} target="_blank" rel="noreferrer">
                                  <ExternalLink className="mr-2 h-4 w-4" /> Abrir link da compra
                                </a>
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
