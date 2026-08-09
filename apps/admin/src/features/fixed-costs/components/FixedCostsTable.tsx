import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarOff, Edit2, ReceiptText, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { formatMonth, isFixedCostActive } from "../hooks/useFixedCosts";
import type { FixedCostDto } from "../types";

interface FixedCostsTableProps {
  items: FixedCostDto[];
  isLoading: boolean;
  /** True enquanto um encerramento está em andamento — bloqueia o segundo clique. */
  isEnding: boolean;
  /** True enquanto uma exclusão está em andamento — bloqueia o segundo clique. */
  isDeleting: boolean;
  onEdit: (item: FixedCostDto) => void;
  onEnd: (item: FixedCostDto) => void;
  onDelete: (item: FixedCostDto) => void;
}

/**
 * Tabela dos custos fixos com a vigência por competência ("jan/2026 — atual")
 * e as ações de editar, encerrar (só para vigentes) e excluir.
 */
export function FixedCostsTable({
  items,
  isLoading,
  isEnding,
  isDeleting,
  onEdit,
  onEnd,
  onDelete,
}: FixedCostsTableProps) {
  if (isLoading) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Carregando custos fixos...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground border rounded-lg bg-card">
        <ReceiptText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
        <p className="font-medium text-base">Nenhum custo fixo encontrado</p>
        <p className="text-sm">Cadastre aluguel, contador, energia... para entrarem no fechamento financeiro.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Nome</TableHead>
            <TableHead>Valor mensal</TableHead>
            <TableHead>Vigência</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const active = isFixedCostActive(item);

            return (
              <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-semibold text-foreground">
                  <div className="flex items-center gap-2">
                    <ReceiptText className="w-4 h-4 text-primary shrink-0" />
                    <span>{item.name}</span>
                  </div>
                </TableCell>

                <TableCell className="font-mono">{formatCurrency(item.monthlyAmount)}</TableCell>

                <TableCell className="text-muted-foreground">
                  {formatMonth(item.startsOn)} — {item.endsOn ? formatMonth(item.endsOn) : "atual"}
                </TableCell>

                <TableCell>
                  {active ? (
                    <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                      Vigente
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="font-medium">
                      Encerrado
                    </Badge>
                  )}
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {active && !item.endsOn && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEnd(item)}
                        disabled={isEnding}
                        title="Encerrar vigência no mês atual"
                        className="h-8 w-8"
                      >
                        <CalendarOff className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(item)}
                      title="Editar custo fixo"
                      className="h-8 w-8"
                    >
                      <Edit2 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(item)}
                      disabled={isDeleting}
                      title="Excluir custo fixo"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
