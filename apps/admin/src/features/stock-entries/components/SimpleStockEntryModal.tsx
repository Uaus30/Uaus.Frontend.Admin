import React from "react";
import { Package, Receipt } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui";
import { DatePicker, formatDateInput, guardCalendarDismiss, parseDateInput } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Textarea } from "@workspace/ui";
import type { SupplierDto } from "@workspace/api-client-react";
import type { SimpleEntryForm } from "../hooks/useProductStockEntries";

type SimpleStockEntryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nome do produto já escolhido — a modal não tem busca de produto. */
  productName: string;
  /** Código de barras, só para conferir que é o item certo da nota. */
  barcode: string | null;
  suppliers: SupplierDto[];
  form: SimpleEntryForm;
  onChange: <K extends keyof SimpleEntryForm>(field: K, value: SimpleEntryForm[K]) => void;
  isSaving: boolean;
  onSubmit: (e: React.FormEvent) => void;
};

/**
 * Entrada de estoque de UM produto, lançada de dentro da tela do produto.
 *
 * É a mesma gravação da nota completa (`POST /PurchaseEntries/receive`) com um
 * item só. O que ela tira é a busca de produto e a grade de itens: quem chegou
 * aqui pela aba **Estoque** já escolheu o produto, e reapresentar a busca era o
 * atrito que a tela veio resolver.
 *
 * Nota com vários produtos continua sendo assunto de `/estoque/entradas` — esta
 * modal não substitui aquela, e o rodapé diz isso em vez de deixar o operador
 * lançar dez notas de um item cada.
 */
export function SimpleStockEntryModal({
  open,
  onOpenChange,
  productName,
  barcode,
  suppliers,
  form,
  onChange,
  isSaving,
  onSubmit,
}: SimpleStockEntryModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        O calendário abre num portal fora do modal; sem as guardas, o Radix trata
        o clique num dia como interação externa e fecha o formulário inteiro.
      */}
      <DialogContent
        className="max-w-2xl overflow-y-auto max-h-[90vh]"
        onInteractOutside={guardCalendarDismiss}
        onFocusOutside={guardCalendarDismiss}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Registrar Entrada de Estoque
          </DialogTitle>
          <DialogDescription>
            Lançamento rápido para este produto. Para uma nota com vários itens, use Produtos › Entradas.
          </DialogDescription>
        </DialogHeader>

        {/*
          `stopPropagation` porque esta modal é aberta de DENTRO do formulário do
          produto. O portal do Radix a tira do form no DOM, mas o React propaga o
          submit pela árvore de componentes — sem isto, salvar a entrada gravava
          o produto junto e fechava a tela por cima do lançamento.
        */}
        <form
          onSubmit={(e) => {
            e.stopPropagation();
            onSubmit(e);
          }}
          className="flex flex-col gap-5 mt-2"
        >
          <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/20 px-4 py-3">
            <Package className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{productName}</p>
              <p className="font-mono text-xs text-muted-foreground">{barcode || "Sem código de barras"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Fornecedor <span className="text-red-500">*</span>
              </label>
              <Select value={form.supplierId} onValueChange={(value) => onChange("supplierId", value)}>
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue placeholder="Selecione um fornecedor..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Nº da Nota Fiscal / Identificador
              </label>
              <Input
                placeholder="Ex: NF-1234"
                value={form.invoiceNumber}
                onChange={(e) => onChange("invoiceNumber", e.target.value)}
                className="h-10 bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Data da Entrada <span className="text-red-500">*</span>
              </label>
              <DatePicker
                value={parseDateInput(form.entryDate)}
                onChange={(date) => onChange("entryDate", formatDateInput(date))}
                placeholder="Selecionar data"
                clearable={false}
                className="h-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Quantidade <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => onChange("quantity", Math.max(1, Number(e.target.value)))}
                aria-label="Quantidade recebida"
                className="h-10 bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Custo Unitário <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.unitCost}
                onChange={(e) => onChange("unitCost", Math.max(0, Number(e.target.value)))}
                aria-label="Custo unitário"
                className="h-10 bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Preço de Venda <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => onChange("price", Math.max(0, Number(e.target.value)))}
                aria-label="Preço de venda"
                className="h-10 bg-background"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Observações internas
            </label>
            <Textarea
              placeholder="Informações adicionais como frete, observações físicas..."
              value={form.notes}
              onChange={(e) => onChange("notes", e.target.value)}
              className="min-h-16"
            />
          </div>

          <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-2">
            <span className="text-xs text-muted-foreground">
              (*) Campos obrigatórios. O custo e o preço lançados passam a valer no cadastro.
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-primary text-primary-foreground" disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar Entrada"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
