import { useState } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@workspace/ui";
import { Badge } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { ConfirmDialog } from "@workspace/ui";
import { Edit2, Trash2, CreditCard, Percent } from "lucide-react";
import type { PaymentMethodDto } from "../types";

interface PaymentMethodsTableProps {
  items: PaymentMethodDto[];
  isLoading: boolean;
  onEdit: (item: PaymentMethodDto) => void;
  /** Exclui a forma de pagamento. Deve devolver a Promise da mutação — ver o ConfirmDialog. */
  onDelete: (id: number) => void | Promise<unknown>;
}

/**
 * Tabela das formas de pagamento com os parcelamentos e as taxas de cada um.
 *
 * A confirmação da exclusão mora aqui porque o aviso precisa citar o nome e a
 * quantidade de parcelamentos da linha: eles somem junto, e é a informação que
 * o operador não tem como recuperar depois de confirmar.
 */
export function PaymentMethodsTable({ items, isLoading, onEdit, onDelete }: PaymentMethodsTableProps) {
  const [methodToDelete, setMethodToDelete] = useState<PaymentMethodDto | null>(null);

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">Carregando formas de pagamento...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground border rounded-lg bg-card">
        <CreditCard className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
        <p className="font-medium text-base">Nenhuma forma de pagamento cadastrada</p>
        <p className="text-sm">Clique em "Nova Forma de Pagamento" para começar.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Nome</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Parcelamentos & Taxas</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
              <TableCell className="font-semibold text-foreground">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary shrink-0" />
                  <span>{item.name}</span>
                </div>
              </TableCell>

              <TableCell>
                {item.isActive ? (
                  <Badge
                    variant="default"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  >
                    Ativo
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="font-medium">
                    Inativo
                  </Badge>
                )}
              </TableCell>

              <TableCell>
                <div className="flex flex-wrap gap-1.5 max-w-xl">
                  {item.installments.map((inst) => (
                    <Badge
                      key={inst.id}
                      variant="outline"
                      className={`text-xs py-0.5 px-2 font-mono flex items-center gap-1 ${
                        inst.isActive ? "border-primary/40 bg-primary/5" : "opacity-50"
                      }`}
                    >
                      <span className="font-bold">{inst.installmentNumber}x</span>
                      <span className="text-muted-foreground text-[10px] flex items-center">
                        ({inst.feePercentage.toFixed(2)}% <Percent className="w-2.5 h-2.5 ml-0.5" />)
                      </span>
                    </Badge>
                  ))}
                </div>
              </TableCell>

              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(item)}
                    title="Editar forma de pagamento"
                    className="h-8 w-8"
                  >
                    <Edit2 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMethodToDelete(item)}
                    title="Excluir forma de pagamento"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {methodToDelete && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setMethodToDelete(null)}
          title="Excluir esta forma de pagamento?"
          itemName={`${methodToDelete.name} — ${methodToDelete.installments.length} ${
            methodToDelete.installments.length === 1 ? "parcelamento" : "parcelamentos"
          }`}
          description="A forma sai do cadastro junto com todos os parcelamentos e as taxas configuradas neles, e deixa de aparecer no caixa e no registro de vendas. Vendas já registradas com ela continuam como estão. Para apenas tirá-la de circulação sem perder as taxas, prefira desativar pela edição. A ação não pode ser desfeita."
          confirmLabel="Sim, excluir"
          destructive
          onConfirm={async () => {
            await onDelete(methodToDelete.id);
          }}
        />
      )}
    </div>
  );
}
