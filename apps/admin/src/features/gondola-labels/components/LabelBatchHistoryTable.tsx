import { Eye, Printer, Trash2 } from "lucide-react";
import { Button } from "@workspace/ui";
import { Card, CardContent } from "@workspace/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui";
import { Spinner } from "@workspace/ui";
import { formatDate } from "@workspace/core";
import type { ProductLabelBatchDto, UiPagedResult } from "@workspace/api-client-react";

interface LabelBatchHistoryTableProps {
  batchPage: UiPagedResult<ProductLabelBatchDto> | undefined;
  isLoading: boolean;
  page: number;
  setPage: (page: number) => void;
  limit: number;
  setLimit: (limit: number) => void;
  totalPages: number;
  reprintingId: number | null;
  onViewDetails: (id: number) => void;
  onReprint: (id: number) => void;
  onDeleteRequest: (batch: ProductLabelBatchDto) => void;
}

/** Histórico paginado dos lotes impressos, com detalhes, reimpressão e exclusão. */
export function LabelBatchHistoryTable({
  batchPage,
  isLoading,
  page,
  setPage,
  limit,
  setLimit,
  totalPages,
  reprintingId,
  onViewDetails,
  onReprint,
  onDeleteRequest,
}: LabelBatchHistoryTableProps) {
  const batches = batchPage?.data ?? [];

  return (
    <Card className="border-border/50 shadow-lg shadow-black/5">
      <CardContent className="flex flex-col gap-4 pt-6">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        ) : batches.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
            Nenhum lote de etiquetas impresso ainda.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/50">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Lote</th>
                  <th className="px-3 py-2 text-left font-medium">Data</th>
                  <th className="px-3 py-2 text-left font-medium">Identificação</th>
                  <th className="px-3 py-2 text-left font-medium">Usuário</th>
                  <th className="px-3 py-2 text-center font-medium">Produtos</th>
                  <th className="px-3 py-2 text-center font-medium">Etiquetas</th>
                  <th className="px-3 py-2 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium text-foreground">#{batch.id}</td>
                    <td className="whitespace-nowrap px-3 py-2">{formatDate(batch.createdAt)}</td>
                    <td className="max-w-56 truncate px-3 py-2">
                      {batch.description ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="max-w-40 truncate px-3 py-2">
                      {batch.userName ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center">{batch.totalProducts}</td>
                    <td className="px-3 py-2 text-center">{batch.totalLabels}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="Ver etiquetas do lote"
                          onClick={() => onViewDetails(batch.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="Reimprimir lote"
                          disabled={reprintingId !== null}
                          onClick={() => onReprint(batch.id)}
                        >
                          {reprintingId === batch.id ? (
                            <Spinner className="h-4 w-4" />
                          ) : (
                            <Printer className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Excluir do histórico"
                          onClick={() => onDeleteRequest(batch)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Itens por página</span>
            <Select
              value={String(limit)}
              onValueChange={(value) => {
                setLimit(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-20 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[20, 50, 100].map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
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
        </div>
      </CardContent>
    </Card>
  );
}


