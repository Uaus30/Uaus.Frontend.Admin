import { Label, Switch } from "@workspace/ui";

type SupplierFlagsFieldsProps = {
  isRecurring: boolean;
  onIsRecurringChange: (value: boolean) => void;
};

/**
 * A marca do cadastro que muda o comportamento de OUTRA tela: a compra
 * recorrente, filtro de BI › Desempenho de Fornecedores.
 *
 * Fica com a explicação embaixo de propósito: ela não tem efeito visível nesta
 * tela, e uma caixa sem consequência aparente é uma caixa que ninguém marca — ou
 * que alguém marca sem saber o que mudou.
 *
 * Até 14/10/2026 havia aqui também a chave "É um marketplace". Ela virou um dos
 * valores do seletor "Tipo de fornecedor" (`SupplierTypeField`), que mora com os
 * campos obrigatórios.
 */
export function SupplierFlagsFields({ isRecurring, onIsRecurringChange }: SupplierFlagsFieldsProps) {
  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 p-3">
        <Switch
          id="fornecedor-recorrente"
          checked={isRecurring}
          onCheckedChange={onIsRecurringChange}
          className="mt-0.5"
        />
        <div className="space-y-0.5">
          <Label htmlFor="fornecedor-recorrente" className="cursor-pointer">
            Fornecedor de compra recorrente
          </Label>
          <p className="text-xs text-muted-foreground">
            Aparece no filtro de recorrentes em BI › Desempenho de Fornecedores.
          </p>
        </div>
      </div>
    </div>
  );
}
