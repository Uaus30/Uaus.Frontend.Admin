import React from "react";
import { Package, Receipt } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui";
import { DatePicker, formatDateInput, guardCalendarDismiss, parseDateInput } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Textarea } from "@workspace/ui";
import type { SupplierDto } from "@workspace/api-client-react";
import { CurrencyInput } from "@/features/products/components/CurrencyInput";
import type { SimpleEntryForm } from "../hooks/useProductStockEntries";

type SimpleStockEntryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nome do produto já escolhido — a modal não tem busca de produto. */
  productName: string;
  /** Código de barras, só para conferir que é o item certo da nota. */
  barcode: string | null;
  /** Saldo atual do produto, para a prévia "X → X+N". `null` enquanto carrega. */
  currentStock: number | null;
  suppliers: SupplierDto[];
  form: SimpleEntryForm;
  onChange: <K extends keyof SimpleEntryForm>(field: K, value: SimpleEntryForm[K]) => void;
  isSaving: boolean;
  onSubmit: (e: React.FormEvent) => void;
};

/**
 * Entrada de estoque de UM produto, lançada de dentro da tela do produto.
 *
 * Mesma gravação de `/estoque/entradas` (`POST /PurchaseEntries/receive`) — a
 * entrada é de um produto por vez nas DUAS rotas desde 31/08/2026. O que esta
 * modal tira é a busca de produto: quem chegou pela aba **Estoque** já escolheu
 * o produto, e reapresentar a busca era o atrito que a tela veio resolver.
 */
export function SimpleStockEntryModal({
  open,
  onOpenChange,
  productName,
  barcode,
  currentStock,
  suppliers,
  form,
  onChange,
  isSaving,
  onSubmit,
}: SimpleStockEntryModalProps) {
  const vendeAbaixoDoCusto = form.price > 0 && form.unitCost > 0 && form.price < form.unitCost;
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
          <DialogDescription>Lançamento rápido para este produto — um lote por lançamento.</DialogDescription>
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
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Package className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{productName}</p>
                <p className="font-mono text-xs text-muted-foreground">{barcode || "Sem código de barras"}</p>
              </div>
            </div>
            {currentStock !== null && (
              <p className="shrink-0 text-xs text-muted-foreground">
                Estoque:{" "}
                <span className="font-semibold text-foreground">
                  {currentStock} → {currentStock + (Number.isFinite(form.quantity) ? form.quantity : 0)}
                </span>
              </p>
            )}
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
              {/*
                Data futura viraria o lote "mais recente" e ditaria o custo do
                produto até lá — o backend recusa, e o calendário nem oferece.
              */}
              <DatePicker
                value={parseDateInput(form.entryDate)}
                onChange={(date) => onChange("entryDate", formatDateInput(date))}
                placeholder="Selecionar data"
                clearable={false}
                maxDate={new Date()}
                className="h-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Quantidade <span className="text-red-500">*</span>
              </label>
              {/*
                Sem `Math.max` no onChange de propósito: a trava impedia limpar o
                campo para digitar (voltava para 1 a cada backspace). Quem barra
                zero e fração agora é a validação do submit.
              */}
              <Input
                type="number"
                min="1"
                step="1"
                value={form.quantity}
                onChange={(e) => {
                  const parsed = Number(e.target.value);
                  onChange("quantity", Number.isFinite(parsed) ? parsed : 0);
                }}
                aria-label="Quantidade recebida"
                className="h-10 bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Custo Unitário <span className="text-red-500">*</span>
              </label>
              {/*
                CurrencyInput, e não type=number: é o mesmo campo de moeda com
                vírgula do resto do admin — o type=number exigia ponto decimal.
              */}
              <CurrencyInput
                value={form.unitCost}
                onChange={(val) => onChange("unitCost", val)}
                className="h-10 bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Preço de Venda <span className="text-red-500">*</span>
              </label>
              <CurrencyInput
                value={form.price}
                onChange={(val) => onChange("price", val)}
                className="h-10 bg-background"
              />
              {vendeAbaixoDoCusto && (
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  Preço abaixo do custo unitário — a margem será negativa.
                </p>
              )}
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
