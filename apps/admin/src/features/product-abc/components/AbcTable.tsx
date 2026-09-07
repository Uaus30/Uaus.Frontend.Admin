import * as React from "react";
import { Search, X } from "lucide-react";
import { Badge, Button, Card, Input, Table, TableBody, TableHeader, TableRow } from "@workspace/ui";
import type { ProductAbcItemDto } from "@workspace/api-client-react";
import { BiColumnHeader } from "@/components/bi-column-header";
import { formatInteger } from "@/features/supplier-performance/lib/format";
import { AbcRow } from "./AbcRow";

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
 *
 * Toda coluna cujo nome não se explica sozinho carrega a definição no cabeçalho
 * (`BiColumnHeader`). "Acumulado" e "cesta" eram as duas que só tinham resposta
 * no rodapé da página — e rodapé só alcança quem já rolou até o fim.
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
                <BiColumnHeader className="w-10">#</BiColumnHeader>
                <BiColumnHeader>Produto</BiColumnHeader>
                <BiColumnHeader
                  className="w-16 text-center"
                  dica="Classe pelo critério escolhido no filtro: A até 80% do acumulado, B até 95%, C o resto"
                >
                  Classe
                </BiColumnHeader>
                <BiColumnHeader
                  className="w-44"
                  dica="O cruzamento das DUAS classificações — por faturamento e por lucro. É aqui que se lê se o produto é bom ou ruim; a classe sozinha só diz se ele é grande."
                >
                  Leitura
                </BiColumnHeader>
                <BiColumnHeader dica="Quanto do total do critério já foi somado até esta linha, descendo a lista do maior para o menor">
                  Acumulado
                </BiColumnHeader>
                <BiColumnHeader className="text-right" dica="Unidades vendidas no período">
                  Vendidos
                </BiColumnHeader>
                <BiColumnHeader className="text-right">Faturamento</BiColumnHeader>
                <BiColumnHeader
                  className="text-right"
                  dica="Faturamento menos o custo do que saiu do estoque"
                >
                  Lucro
                </BiColumnHeader>
                <BiColumnHeader
                  className="text-right"
                  dica="Lucro sobre o faturamento. Verde a partir de 40%, âmbar de 30% a 40%, vermelho abaixo de 30%."
                >
                  Margem
                </BiColumnHeader>
                <BiColumnHeader
                  className="text-center"
                  dica="Em quantas semanas do período o produto vendeu: constante (60% ou mais), ocasional (20% a 60%) ou raro"
                >
                  Frequência
                </BiColumnHeader>
                <BiColumnHeader
                  className="text-right"
                  dica="Ticket médio das vendas que contêm este produto, dividido pelo ticket médio da loja. Acima de 1, ele aparece em compras maiores que a média — e cortá-lo leva a cesta inteira junto."
                >
                  Cesta
                </BiColumnHeader>
                <BiColumnHeader className="text-right" dica="Saldo disponível hoje, em unidades">
                  Estoque
                </BiColumnHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.map((produto) => (
                <AbcRow key={produto.productId} produto={produto} />
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
