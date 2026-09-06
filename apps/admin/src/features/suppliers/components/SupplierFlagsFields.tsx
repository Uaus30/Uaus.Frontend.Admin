import { Label, Switch } from "@workspace/ui";

type SupplierFlagsFieldsProps = {
  isRecurring: boolean;
  onIsRecurringChange: (value: boolean) => void;
  isMarketplace: boolean;
  onIsMarketplaceChange: (value: boolean) => void;
};

/**
 * As duas marcas do cadastro que mudam o comportamento de OUTRAS telas.
 *
 * Ficam juntas e com a explicação embaixo de propósito: nenhuma das duas tem
 * efeito visível nesta tela, e uma caixa sem consequência aparente é uma caixa
 * que ninguém marca — ou que alguém marca sem saber o que mudou.
 *
 * O estado mora no modal, e não aqui, porque o submit precisa dos dois valores;
 * o que muda na hora é o aviso do marketplace, que reage à própria marca.
 */
export function SupplierFlagsFields({
  isRecurring,
  onIsRecurringChange,
  isMarketplace,
  onIsMarketplaceChange,
}: SupplierFlagsFieldsProps) {
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

      <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 p-3">
        <Switch
          id="fornecedor-marketplace"
          checked={isMarketplace}
          onCheckedChange={onIsMarketplaceChange}
          className="mt-0.5"
        />
        <div className="space-y-0.5">
          <Label htmlFor="fornecedor-marketplace" className="cursor-pointer">
            É um marketplace
          </Label>
          <p className="text-xs text-muted-foreground">
            Plataforma com vários vendedores (Shopee, Mercado Livre, Amazon).
            {isMarketplace
              ? " As compras deste fornecedor passam a exigir o link do anúncio para sair de Pendente — sem ele não há como reencontrar o item depois."
              : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
