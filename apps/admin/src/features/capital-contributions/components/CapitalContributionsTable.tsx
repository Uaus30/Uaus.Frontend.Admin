import { useState } from "react";
import {
  Button,
  ConfirmDialog,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui";
import { Edit2, HandCoins, Trash2 } from "lucide-react";
import { formatCurrency } from "@workspace/core";
import type { CapitalContributionDto } from "../types";

interface CapitalContributionsTableProps {
  items: CapitalContributionDto[];
  /** Total do mês, como o servidor somou. */
  total: number;
  isLoading: boolean;
  /** Mês fechado: editar e excluir ficam travados (o servidor recusaria). */
  isClosed: boolean;
  isDeleting: boolean;
  onEdit: (item: CapitalContributionDto) => void;
  /** Exclui o aporte. Deve devolver a Promise da mutação — ver o ConfirmDialog. */
  onDelete: (item: CapitalContributionDto) => void | Promise<unknown>;
}

/** "2026-11-23T00:00:00" → "23/11/2026", pelos dígitos (sem `Date`, sem fuso). */
function brDate(value: string): string {
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
}

/** Abaixo do `lg` a coluna sai: tabela larga em tela pequena perde coluna, nunca rola. */
const WIDE = "hidden lg:table-cell";

/**
 * Tabela dos aportes do mês: data, sócio, valor, observação e quem lançou, com
 * o total do mês no rodapé.
 *
 * A confirmação da exclusão mora aqui, como na tabela de custos fixos: "qual
 * linha está esperando confirmação" é estado da lista, e o aviso precisa citar
 * a data, o sócio e o valor — num mês com dois aportes do mesmo sócio, o valor
 * é o que diz qual dos dois sai.
 */
export function CapitalContributionsTable({
  items,
  total,
  isLoading,
  isClosed,
  isDeleting,
  onEdit,
  onDelete,
}: CapitalContributionsTableProps) {
  const [toDelete, setToDelete] = useState<CapitalContributionDto | null>(null);

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">Carregando aportes...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-card py-12 text-center text-muted-foreground">
        <HandCoins className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
        <p className="text-base font-medium">Nenhum aporte neste mês</p>
        <p className="text-sm">
          O aporte entra como saldo disponível e pode levar a faixa de compras ao verde.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Data</TableHead>
            <TableHead>Sócio</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className={WIDE}>Observação</TableHead>
            <TableHead className={WIDE}>Lançado por</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="tabular-nums">{brDate(item.contributionDate)}</TableCell>
              <TableCell className="font-medium">{item.partnerName}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatCurrency(item.amount)}
              </TableCell>
              <TableCell
                className={`${WIDE} max-w-[18rem] truncate text-muted-foreground`}
                title={item.notes ?? ""}
              >
                {item.notes || "—"}
              </TableCell>
              <TableCell className={`${WIDE} text-muted-foreground`}>{item.createdBy ?? "—"}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(item)}
                    disabled={isClosed}
                    title={isClosed ? "Mês fechado: o aporte não pode ser alterado" : "Editar aporte"}
                    aria-label={`Editar aporte de ${item.partnerName}`}
                    className="h-9 w-9"
                  >
                    <Edit2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setToDelete(item)}
                    disabled={isClosed || isDeleting}
                    title={isClosed ? "Mês fechado: o aporte não pode ser excluído" : "Excluir aporte"}
                    aria-label={`Excluir aporte de ${item.partnerName}`}
                    className="h-9 w-9 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/20">
            <TableCell colSpan={2} className="font-semibold">
              Total do mês
            </TableCell>
            <TableCell className="text-right font-bold tabular-nums">{formatCurrency(total)}</TableCell>
            <TableCell className={WIDE} />
            <TableCell className={WIDE} />
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Excluir este aporte?"
        itemName={
          toDelete
            ? `${brDate(toDelete.contributionDate)} · ${toDelete.partnerName} · ${formatCurrency(toDelete.amount)}`
            : undefined
        }
        description="O aporte sai do saldo disponível do mês, e a faixa de compras é refeita sem ele. A exclusão fica registrada em log com o seu usuário."
        confirmLabel="Sim, excluir aporte"
        destructive
        loading={isDeleting}
        onConfirm={async () => {
          if (toDelete) await onDelete(toDelete);
        }}
      />
    </div>
  );
}
