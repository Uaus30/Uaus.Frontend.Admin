import type React from "react";
import { CheckCircle2, ImageIcon, ShoppingCart } from "lucide-react";
import { Link } from "wouter";
import { Button, ImageHoverZoom, Spinner } from "@workspace/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui";
import { buildPublicImageUrl } from "@workspace/api-client-react";
import type { LowStockItem } from "../types";
import { duracaoLegivel, duracaoTone, tituloDaDuracao } from "../lib/duracao";
import { isPlanTrip, lastPurchaseLabel } from "../lib/shopping-list";

type ShoppingListTableProps = {
  items: LowStockItem[];
  isLoading: boolean;
  /** Algum filtro está aplicado — muda o texto do vazio. */
  filtered: boolean;
  page: number;
  totalPages: number;
  setPage: (value: number) => void;
  onComprar: (item: LowStockItem) => void;
};

/** Caminho do detalhe do produto — o id é o do GRUPO, que é o que a tela edita. */
function productDetailHref(productGroupId: number): string {
  return `/produtos/${productGroupId}/detalhes`;
}

/**
 * A ação da linha: **Comprar** (a mesma navegação do relatório de estoque
 * baixo) ou, com compra já registrada (`hasOpenPurchase`), o aviso **Compra em
 * aberto** no lugar do botão — o mesmo texto do relatório. Não é "Comprado": na
 * listagem de produtos esse selo é só da compra A caminho (04/10/2026), e com a
 * caixa desmarcada a compra que sobra aqui é a Pendente.
 */
function ShoppingListAction({
  item,
  onComprar,
}: {
  item: LowStockItem;
  onComprar: (item: LowStockItem) => void;
}) {
  if (item.hasOpenPurchase)
    return (
      <span
        className="text-xs text-blue-500"
        title="Já existe pedido de compra deste produto, Pendente ou A caminho."
      >
        Compra em aberto
      </span>
    );

  return (
    <Button
      type="button"
      size="sm"
      className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
      onClick={() => onComprar(item)}
      title="Abre o pedido de compra deste produto"
    >
      <ShoppingCart className="h-3.5 w-3.5" />
      Comprar
    </Button>
  );
}

/** Fornecedor e, embaixo, a cidade — é por ela que se planeja a viagem. */
function SupplierCell({ item }: { item: LowStockItem }) {
  if (!item.supplierName) return <span className="text-muted-foreground">—</span>;
  return (
    <>
      <span className="block">{item.supplierName}</span>
      {item.supplierCity && <span className="block text-xs text-muted-foreground">{item.supplierCity}</span>}
    </>
  );
}

/**
 * O resumo da linha abaixo do `lg`: as colunas somem (convenção "esconder
 * coluna, nunca rolar") e o essencial vem embaixo do nome, com a ação.
 */
function ShoppingListRowSummary({ item, action }: { item: LowStockItem; action: React.ReactNode }) {
  return (
    <div className="mt-1.5 space-y-1 lg:hidden">
      <p className="text-xs text-muted-foreground">
        Estoque <span className="font-mono font-semibold text-destructive">{item.stock}</span>
        {item.supplierName && (
          <>
            {" · "}
            {item.supplierName}
            {item.supplierCity && ` (${item.supplierCity})`}
          </>
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        Última compra {lastPurchaseLabel(item)} ·{" "}
        {item.recentSales > 0 ? `vendeu ${item.recentSales} em 30 dias` : "sem venda em 30 dias"} · dura{" "}
        <span className={duracaoTone(item.daysOfCover, item.stock)}>
          {duracaoLegivel(item.daysOfCover, item.stock)}
        </span>
      </p>
      <div className="flex justify-start pt-1">{action}</div>
    </div>
  );
}

/**
 * Tabela da Lista de Compras (14/10/2026), no layout do relatório de estoque
 * baixo: abaixo do `lg`, só a coluna do produto com o resumo embaixo; do `lg`
 * ao `xl`, sem saldo e última compra; dali para cima, tudo.
 *
 * O selo **Planejar viagem** marca quem está fora do controle de estoque por
 * compra pequena de atacado ou varejo: o relatório de estoque baixo não o
 * mostra, e esta lista é o único lugar onde ele aparece quando acaba.
 */
export function ShoppingListTable({
  items,
  isLoading,
  filtered,
  page,
  totalPages,
  setPage,
  onComprar,
}: ShoppingListTableProps) {
  if (isLoading)
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );

  if (items.length === 0)
    return (
      <div className="py-12 text-center text-muted-foreground">
        <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500/60" />
        <p className="font-medium text-foreground">
          {filtered ? "Nenhum produto para comprar com esses filtros." : "Nada para comprar agora."}
        </p>
        <p className="mt-1 text-xs">
          {filtered
            ? "Os filtros só estreitam a lista; apague-os para ver tudo."
            : "Entram aqui os produtos com boa saída que esgotaram, duram menos de 30 dias ou chegaram ao mínimo."}
        </p>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-border/40">
        <Table className="lg:min-w-[48rem] xl:min-w-[64rem]">
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="px-3 py-3 lg:px-4">Produto</TableHead>
              <TableHead className="hidden px-4 py-3 lg:table-cell">Fornecedor</TableHead>
              <TableHead className="hidden px-4 py-3 text-right xl:table-cell">Estoque</TableHead>
              <TableHead
                className="hidden px-4 py-3 xl:table-cell"
                title="Quantidade e data da última entrada de compra do produto"
              >
                Última compra
              </TableHead>
              <TableHead className="hidden px-4 py-3 text-right lg:table-cell">Vendas 30d</TableHead>
              <TableHead className="hidden px-4 py-3 text-right lg:table-cell">Dura</TableHead>
              <TableHead className="hidden w-px whitespace-nowrap px-4 py-3 text-right lg:table-cell">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const action = <ShoppingListAction item={item} onComprar={onComprar} />;
              return (
                <TableRow key={item.productId} data-testid="shopping-list-row">
                  <TableCell className="px-3 py-3 lg:px-4">
                    <div className="flex items-center gap-3">
                      {item.imageUrl ? (
                        <ImageHoverZoom
                          src={buildPublicImageUrl(item.imageUrl)}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-md border border-border/50 bg-white object-contain"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted/40">
                          <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                        </div>
                      )}
                      {/* Mesmo teto de ~40 caracteres do relatório: quebra a linha, não corta a variação. */}
                      <div className="min-w-0 max-w-[40ch]">
                        <Link
                          href={productDetailHref(item.productGroupId)}
                          className="block break-words font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {item.productName}
                        </Link>
                        <p className="font-mono text-xs text-muted-foreground">{item.barcode}</p>
                        {isPlanTrip(item) && (
                          <span
                            className="mt-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400"
                            title="Fora do controle de estoque por compra pequena de atacado ou varejo: só se repõe com viagem."
                          >
                            Planejar viagem
                          </span>
                        )}
                        <ShoppingListRowSummary item={item} action={action} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden px-4 py-3 text-sm lg:table-cell">
                    <SupplierCell item={item} />
                  </TableCell>
                  <TableCell className="hidden px-4 py-3 text-right font-mono text-sm xl:table-cell">
                    <span className="font-semibold text-destructive">{item.stock}</span>
                  </TableCell>
                  <TableCell className="hidden px-4 py-3 text-sm xl:table-cell">
                    {lastPurchaseLabel(item)}
                  </TableCell>
                  <TableCell className="hidden px-4 py-3 text-right font-mono text-sm lg:table-cell">
                    {item.recentSales > 0 ? (
                      <span className="font-semibold text-foreground">{item.recentSales}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={`hidden px-4 py-3 text-right text-sm lg:table-cell ${duracaoTone(item.daysOfCover, item.stock)}`}
                  >
                    <span title={tituloDaDuracao(item)}>{duracaoLegivel(item.daysOfCover, item.stock)}</span>
                  </TableCell>
                  <TableCell className="hidden w-px whitespace-nowrap px-4 py-3 text-right lg:table-cell">
                    {action}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-end gap-2">
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
