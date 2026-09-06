import { useState } from "react";
import { Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui";
import { Loader2, Plus, Receipt, Trash2 } from "lucide-react";
import { formatCurrency } from "@workspace/core";
import type { FinancialClosingVariableCostDto } from "../types";

interface VariableCostsTableProps {
  items: FinancialClosingVariableCostDto[];
  total: number;
  /**
   * Handlers de edição. Ausentes = tabela só de leitura, que é como o detalhe
   * de um fechamento confirmado a exibe: documento fechado não se edita.
   */
  onAdd?: (cost: FinancialClosingVariableCostDto) => void;
  onRemove?: (index: number) => void;
  /** Trava a edição enquanto o servidor recalcula a prévia. */
  isRecalculating?: boolean;
}

/**
 * VariableCostsTable
 *
 * Gastos eventuais do período — a conta do contador, o conserto do freezer, a
 * taxa que apareceu uma vez. Descem do lucro bruto junto com os custos fixos.
 *
 * Na prévia a tabela é editável e **cada linha lançada refaz o cálculo no
 * servidor**: os itens exibidos são o eco da resposta, nunca o estado local, de
 * modo que a tabela e o lucro líquido ao lado nunca contam histórias
 * diferentes. Sem isso, uma falha de rede deixaria a linha na tela e o valor
 * fora da conta.
 */
export function VariableCostsTable({
  items,
  total,
  onAdd,
  onRemove,
  isRecalculating = false,
}: VariableCostsTableProps) {
  const editable = onAdd != null;
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const parsedAmount = Number(amount);
  const canAdd =
    description.trim().length > 0 &&
    amount.trim().length > 0 &&
    !Number.isNaN(parsedAmount) &&
    parsedAmount > 0;

  function handleAdd() {
    if (!canAdd || !onAdd || isRecalculating) return;
    onAdd({ description: description.trim(), amount: parsedAmount });
    setDescription("");
    setAmount("");
  }

  // Documento confirmado sem nenhum gasto eventual não precisa de tabela vazia.
  if (!editable && items.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Receipt className="h-4 w-4 text-primary" />
        Custos variáveis no período
        {isRecalculating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </p>

      <div className="rounded-md border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              {editable && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={editable ? 3 : 2} className="text-sm text-muted-foreground">
                  Nenhum gasto eventual lançado — o lucro líquido considera só os custos fixos.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <TableRow key={`${item.description}-${index}`}>
                  <TableCell className="font-medium">{item.description}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(item.amount)}</TableCell>
                  {editable && (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        disabled={isRecalculating}
                        onClick={() => onRemove?.(index)}
                        title={`Remover ${item.description}`}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Remover {item.description}</span>
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}

            {items.length > 0 && (
              <TableRow className="bg-muted/20">
                <TableCell className="text-sm font-semibold">Total</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(total)}</TableCell>
                {editable && <TableCell />}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {editable && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label="Descrição do custo variável"
            placeholder="Ex.: conserto do freezer"
            value={description}
            maxLength={150}
            disabled={isRecalculating}
            onChange={(event) => setDescription(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleAdd()}
          />
          <Input
            aria-label="Valor do custo variável"
            type="number"
            step="0.01"
            min={0}
            placeholder="0,00"
            className="sm:w-40"
            value={amount}
            disabled={isRecalculating}
            onChange={(event) => setAmount(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleAdd()}
          />
          <Button
            type="button"
            variant="outline"
            className="gap-1.5 sm:w-40"
            disabled={!canAdd || isRecalculating}
            onClick={handleAdd}
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}
