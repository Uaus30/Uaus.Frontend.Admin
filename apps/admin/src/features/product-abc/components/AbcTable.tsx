import * as React from "react";
import { Link } from "wouter";
import { Search, X } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { ProductAbcItemDto } from "@workspace/api-client-react";
import { formatInteger, formatPercent } from "@/features/supplier-performance/lib/format";
import { CLASS_COLORS, FREQUENCY_HINTS, FREQUENCY_LABELS } from "../lib/abc";

type AbcTableProps = {
  products: ProductAbcItemDto[];
  /** Total antes do recorte — é o que dá sentido a "12 de 511". */
  totalProducts: number;
  search: string;
  onSearchChange: (value: string) => void;
  /** Rótulo do recorte em vigor, quando há um. */
  focusLabel: string | null;
  onClearFocus: () => void;
};

/** Quantas linhas por vez. Quinhentos produtos de uma vez travam a rolagem. */
const PAGINA = 50;

/**
 * A lista classificada.
 *
 * A barra de acumulado na linha é o que transforma a tabela na própria curva: dá
 * para ver onde a classe A termina descendo a lista, sem voltar ao gráfico.
 */
export function AbcTable({
  products,
  totalProducts,
  search,
  onSearchChange,
  focusLabel,
  onClearFocus,
}: AbcTableProps) {
  /**
   * A paginação carrega junto o recorte a que pertence.
   *
   * O recorte muda a lista inteira, e manter o limite anterior mostraria
   * "mostrando 150 de 12". A alternativa seria um efeito que zera o limite, mas
   * aí a tela renderiza uma vez com o número errado antes de se corrigir — a
   * comparação em tempo de render acerta de primeira.
   */
  const recorte = `${focusLabel ?? ""}|${search}`;
  const [paginacao, setPaginacao] = React.useState({ recorte, limite: PAGINA });

  const limite = paginacao.recorte === recorte ? paginacao.limite : PAGINA;
  const visiveis = products.slice(0, limite);

  return (
    <Card className="border-border/60 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-[14.5px] font-semibold">Produtos classificados</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatInteger(products.length)} de {formatInteger(totalProducts)} produtos
          </p>
        </div>

        {focusLabel && (
          <Badge className="gap-1 border-primary/40 bg-primary/10 text-primary" variant="outline">
            {focusLabel}
            <button type="button" onClick={onClearFocus} aria-label="Limpar recorte" className="ml-0.5">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}

        <div className="relative ml-auto w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar por produto, código ou fornecedor..."
            className="bg-background pl-9"
            aria-label="Buscar na curva"
          />
        </div>
      </div>

      {products.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Nenhum produto neste recorte.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-auto w-10 px-2 pb-2 text-[10.5px] uppercase tracking-wider">
                  #
                </TableHead>
                <TableHead className="h-auto px-2 pb-2 text-[10.5px] uppercase tracking-wider">
                  Produto
                </TableHead>
                <TableHead className="h-auto w-16 px-2 pb-2 text-center text-[10.5px] uppercase tracking-wider">
                  Classe
                </TableHead>
                <TableHead className="h-auto px-2 pb-2 text-[10.5px] uppercase tracking-wider">
                  Acumulado
                </TableHead>
                <TableHead className="h-auto px-2 pb-2 text-right text-[10.5px] uppercase tracking-wider">
                  Vendidos
                </TableHead>
                <TableHead className="h-auto px-2 pb-2 text-right text-[10.5px] uppercase tracking-wider">
                  Faturamento
                </TableHead>
                <TableHead className="h-auto px-2 pb-2 text-right text-[10.5px] uppercase tracking-wider">
                  Lucro
                </TableHead>
                <TableHead className="h-auto px-2 pb-2 text-right text-[10.5px] uppercase tracking-wider">
                  Margem
                </TableHead>
                <TableHead className="h-auto px-2 pb-2 text-center text-[10.5px] uppercase tracking-wider">
                  Frequência
                </TableHead>
                <TableHead className="h-auto px-2 pb-2 text-right text-[10.5px] uppercase tracking-wider">
                  Cesta
                </TableHead>
                <TableHead className="h-auto px-2 pb-2 text-right text-[10.5px] uppercase tracking-wider">
                  Estoque
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.map((produto) => (
                <TableRow key={produto.productId} className="border-border/40">
                  <TableCell className="px-2 py-2 text-right font-mono text-[11.5px] text-muted-foreground">
                    {produto.rank}
                  </TableCell>

                  <TableCell className="max-w-[280px] px-2 py-2">
                    {produto.productGroupId ? (
                      <Link
                        href={`/produtos/${produto.productGroupId}/detalhes`}
                        className="block truncate text-[12.5px] font-medium hover:text-primary hover:underline"
                      >
                        {produto.productName}
                      </Link>
                    ) : (
                      <span className="block truncate text-[12.5px] font-medium">{produto.productName}</span>
                    )}
                    <span className="block truncate text-[10.5px] text-muted-foreground">
                      {[produto.categoryName, produto.supplierName].filter(Boolean).join(" · ") ||
                        produto.barcode}
                    </span>
                  </TableCell>

                  <TableCell className="px-2 py-2 text-center">
                    <span
                      className="inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold text-background"
                      style={{ backgroundColor: CLASS_COLORS[produto.class] }}
                      title={`Classe ${produto.class} pelo critério escolhido`}
                    >
                      {produto.class}
                    </span>
                  </TableCell>

                  {/* A barra é a curva vista de dentro da tabela: descendo a
                      lista dá para ver onde a classe A termina. */}
                  <TableCell className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:w-24">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${produto.cumulativeShare}%`,
                            backgroundColor: CLASS_COLORS[produto.class],
                          }}
                        />
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {formatPercent(produto.cumulativeShare, 0)}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="px-2 py-2 text-right font-mono text-[12px] tabular-nums">
                    {formatInteger(produto.units)}
                  </TableCell>
                  <TableCell className="px-2 py-2 text-right font-mono text-[12px] tabular-nums">
                    {formatCurrency(produto.revenue)}
                  </TableCell>
                  <TableCell className="px-2 py-2 text-right font-mono text-[12px] tabular-nums">
                    {formatCurrency(produto.profit)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "px-2 py-2 text-right font-mono text-[12px] tabular-nums",
                      produto.profitClass === "A" ? "text-emerald-400" : "text-foreground/70",
                    )}
                  >
                    {formatPercent(produto.margin)}
                  </TableCell>

                  <TableCell className="px-2 py-2 text-center">
                    <span
                      className="text-[11px] text-muted-foreground"
                      title={`${FREQUENCY_HINTS[produto.frequency]} — ${produto.weeksWithSales} semana(s)`}
                    >
                      {FREQUENCY_LABELS[produto.frequency]}
                    </span>
                  </TableCell>

                  {/* Acima de 1, o item aparece em cestas maiores que a média —
                      o argumento contra cortar a cauda por ela ser cauda. */}
                  <TableCell
                    className={cn(
                      "px-2 py-2 text-right font-mono text-[12px] tabular-nums",
                      produto.basketLift >= 1.2 ? "text-emerald-400" : "text-muted-foreground",
                    )}
                    title="Ticket médio das vendas com este produto, dividido pelo ticket médio da loja"
                  >
                    {produto.basketLift > 0 ? `${produto.basketLift.toFixed(2)}×` : "—"}
                  </TableCell>

                  <TableCell className="px-2 py-2 text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                    {formatInteger(produto.stock)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {products.length > limite && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaginacao({ recorte, limite: limite + PAGINA })}
          >
            Mostrar mais {Math.min(PAGINA, products.length - limite)} de{" "}
            {formatInteger(products.length - limite)} restantes
          </Button>
        </div>
      )}
    </Card>
  );
}
