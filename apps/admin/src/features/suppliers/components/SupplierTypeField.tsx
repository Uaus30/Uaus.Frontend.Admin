import { Label } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { SUPPLIER_TYPE_OPTIONS, type SupplierType } from "@workspace/api-client-react";
import { SUPPLIER_TYPE_HINTS } from "../constants";

type SupplierTypeFieldProps = {
  /** Vazio é "não escolhido" — o cadastro novo nasce assim. */
  value: SupplierType | "";
  onChange: (value: SupplierType) => void;
};

/**
 * O seletor "Tipo de fornecedor" (14/10/2026), que substituiu a chave "É um
 * marketplace".
 *
 * Mora na caixa dos campos obrigatórios, e não em "Informações opcionais", porque
 * o cadastro novo não salva sem ele. Nasce SEM valor de propósito: um padrão
 * pré-escolhido seria aceito sem ler, e o tipo muda regra de outras telas — o
 * link obrigatório na compra do marketplace e a compra pequena de atacado e
 * varejo, que desliga o controle de estoque do produto.
 *
 * A frase embaixo muda com o tipo e diz o efeito, porque nada dele aparece aqui.
 */
export function SupplierTypeField({ value, onChange }: SupplierTypeFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="supplier-type">Tipo de fornecedor</Label>
      {/* Valor vazio mostra o placeholder (Radix Select 2): o controle fica controlado do começo ao fim. */}
      <Select value={value} onValueChange={(next) => onChange(next as SupplierType)}>
        <SelectTrigger id="supplier-type" className="bg-background sm:max-w-xs">
          <SelectValue placeholder="Selecione o tipo..." />
        </SelectTrigger>
        <SelectContent>
          {SUPPLIER_TYPE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground" data-testid="supplier-type-hint">
        {value
          ? SUPPLIER_TYPE_HINTS[value]
          : "Obrigatório no cadastro novo: o tipo decide regras de compra e de estoque em outras telas."}
      </p>
    </div>
  );
}
