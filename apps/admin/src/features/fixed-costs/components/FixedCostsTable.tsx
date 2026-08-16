import { useState } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@workspace/ui";
import { Badge } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { ConfirmDialog } from "@workspace/ui";
import { CalendarOff, Edit2, ReceiptText, Trash2 } from "lucide-react";
import { formatCurrency } from "@workspace/core";
import { endMonthFor, formatMonth, isFixedCostActive } from "../hooks/useFixedCosts";
import type { FixedCostDto } from "../types";

interface FixedCostsTableProps {
  items: FixedCostDto[];
  isLoading: boolean;
  /** True enquanto um encerramento está em andamento — bloqueia o segundo clique. */
  isEnding: boolean;
  /** True enquanto uma exclusão está em andamento — bloqueia o segundo clique. */
  isDeleting: boolean;
  onEdit: (item: FixedCostDto) => void;
  /** Encerra a vigência. Deve devolver a Promise da mutação — ver o ConfirmDialog. */
  onEnd: (item: FixedCostDto) => void | Promise<unknown>;
  /** Exclui o custo. Deve devolver a Promise da mutação — ver o ConfirmDialog. */
  onDelete: (item: FixedCostDto) => void | Promise<unknown>;
}

/**
 * Tabela dos custos fixos com a vigência por competência ("jan/2026 — atual")
 * e as ações de editar, encerrar (só para vigentes) e excluir.
 *
 * As duas confirmações moram aqui, e não na página, porque "qual linha está
 * esperando confirmação" é estado da lista: é aqui que o operador clicou, e é
 * aqui que se sabe o nome e a competência a citar no aviso. A página só recebe
 * a tabela pronta.
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
  // Guarda o custo inteiro (não só o id) porque o diálogo precisa mostrar o
  // nome: na tabela paginada o clique no ícone da linha vizinha é o engano mais
  // comum, e o nome é a única chance de perceber antes de confirmar.
  const [costToEnd, setCostToEnd] = useState<FixedCostDto | null>(null);
  const [costToDelete, setCostToDelete] = useState<FixedCostDto | null>(null);

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">Carregando custos fixos...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground border rounded-lg bg-card">
        <ReceiptText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
        <p className="font-medium text-base">Nenhum custo fixo encontrado</p>
        <p className="text-sm">
          Cadastre aluguel, contador, energia... para entrarem no fechamento financeiro.
        </p>
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
                    <Badge
                      variant="default"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                    >
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
                        onClick={() => setCostToEnd(item)}
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
                      onClick={() => setCostToDelete(item)}
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

      {/* Montado só com um custo escolhido: a descrição cita a competência que
          vai ser gravada, e não existe texto honesto para "nenhum custo". */}
      {costToEnd && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setCostToEnd(null)}
          title="Encerrar a vigência deste custo fixo?"
          itemName={`${costToEnd.name} — ${formatCurrency(costToEnd.monthlyAmount)}/mês`}
          description={`A vigência passa a terminar em ${formatMonth(endMonthFor(costToEnd))}. O custo ainda entra no fechamento dessa competência e sai dos meses seguintes — o cadastro continua na lista e pode ser reaberto pela edição.`}
          confirmLabel="Sim, encerrar"
          loading={isEnding}
          onConfirm={async () => {
            await onEnd(costToEnd);
          }}
        />
      )}

      <ConfirmDialog
        open={costToDelete !== null}
        onOpenChange={(open) => !open && setCostToDelete(null)}
        title="Excluir este custo fixo?"
        itemName={
          costToDelete
            ? `${costToDelete.name} — ${formatCurrency(costToDelete.monthlyAmount)}/mês`
            : undefined
        }
        description='O cadastro sai da lista de vez e deixa de entrar em qualquer fechamento futuro. Fechamentos já confirmados não mudam — eles congelaram os totais na confirmação. Para apenas parar a cobrança daqui para frente, prefira "Encerrar". A ação não pode ser desfeita.'
        confirmLabel="Sim, excluir"
        destructive
        loading={isDeleting}
        onConfirm={async () => {
          if (costToDelete) await onDelete(costToDelete);
        }}
      />
    </div>
  );
}
