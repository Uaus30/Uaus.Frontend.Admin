import * as React from "react";
import { Link } from "wouter";
import { Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from "@workspace/ui";
import type { SupplierProductPerformanceDto } from "@workspace/api-client-react";

/** Uma coluna da lista. `numeric` alinha à direita e liga os dígitos tabulares. */
export type ColunaDeProduto = {
  titulo: string;
  numeric?: boolean;
  render: (produto: SupplierProductPerformanceDto) => React.ReactNode;
};

type SupplierProductListProps = {
  titulo: React.ReactNode;
  descricao?: string;
  produtos: SupplierProductPerformanceDto[];
  colunas: ColunaDeProduto[];
  vazio: string;
  /** Quantas linhas mostrar antes do "e mais N". */
  limite: number;
  rodape?: React.ReactNode;
  /** Compacta a tabela para caber na coluna estreita do detalhe. */
  compacta?: boolean;
};

/**
 * Uma das listas de produto do detalhe do fornecedor.
 *
 * São listas separadas, e não uma tabela com filtro, porque cada uma responde
 * uma pergunta diferente e pede uma ordenação diferente: "o que repor" se lê da
 * menor cobertura para a maior, "o que encalhou" do maior capital parado para o
 * menor. Um filtro único obrigaria o operador a reordenar a cada pergunta.
 */
export function SupplierProductList({
  titulo,
  descricao,
  produtos,
  colunas,
  vazio,
  limite,
  rodape,
  compacta,
}: SupplierProductListProps) {
  const visiveis = produtos.slice(0, limite);
  const restantes = produtos.length - visiveis.length;

  return (
    <Card className="border-border/60 p-5">
      <h2 className="text-[14.5px] font-semibold">{titulo}</h2>
      {descricao && <p className="mt-1 text-xs text-muted-foreground">{descricao}</p>}

      {produtos.length === 0 ? (
        <p className="py-5 text-[12.5px] text-muted-foreground">{vazio}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {colunas.map((coluna) => (
                  <TableHead
                    key={coluna.titulo}
                    className={cn(
                      "h-auto px-2 pb-2 text-[10.5px] font-bold uppercase tracking-wider",
                      coluna.numeric && "text-right",
                    )}
                  >
                    {coluna.titulo}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.map((produto) => (
                <TableRow key={produto.productId} className="border-border/40">
                  {colunas.map((coluna, indice) => (
                    <TableCell
                      key={coluna.titulo}
                      className={cn(
                        "px-2 text-[12.5px] text-foreground/80",
                        compacta ? "py-1.5" : "py-2",
                        coluna.numeric && "text-right font-mono tabular-nums",
                        // A primeira coluna é sempre o produto: trunca em vez de
                        // esticar a tabela e empurrar os números para fora da tela.
                        indice === 0 && "max-w-[240px] truncate text-foreground",
                      )}
                    >
                      {coluna.render(produto)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {restantes > 0 && (
        <p className="mt-2.5 text-[11.5px] text-muted-foreground">
          e mais {restantes} produto{restantes > 1 ? "s" : ""} nesta lista
        </p>
      )}

      {rodape && (
        <div className="mt-3 border-t border-border/50 pt-3 text-xs text-muted-foreground">{rodape}</div>
      )}
    </Card>
  );
}

/** Nome do produto com link para o detalhe do catálogo, quando há grupo. */
export function NomeDoProduto({ produto }: { produto: SupplierProductPerformanceDto }) {
  if (!produto.productGroupId) return <>{produto.productName}</>;

  return (
    <Link
      href={`/produtos/${produto.productGroupId}/detalhes`}
      className="hover:text-primary hover:underline"
      onClick={(event) => event.stopPropagation()}
    >
      {produto.productName}
    </Link>
  );
}
