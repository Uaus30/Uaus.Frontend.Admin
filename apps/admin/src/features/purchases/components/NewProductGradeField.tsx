import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { GRADE_TYPES_ALPHABETICAL, GRADE_TYPE_LABELS } from "@workspace/api-client-react";

type NewProductGradeFieldProps = {
  /** Código do tipo da grade (`GRADE_TYPE`), ou nulo para "Sem variações". */
  value: number | null;
  onChange: (tipo: number | null) => void;
  readOnly: boolean;
};

const SEM_VARIACOES = "sem-variacoes";

/**
 * "Variações" da compra de produto NOVO (fase 5 do plano de grupo × variação,
 * 21/10/2026): um tipo de grade só, decisão do dono. Escolhido, o campo de
 * quantidade vira a grade, uma linha por valor; o produto nasce no recebimento,
 * com o código de cada variação bipado ou gerado.
 *
 * "Sem variações" vem primeiro e as grades em ordem alfabética, a regra de todo
 * select do admin (`convencoes-de-interface.md`).
 */
export function NewProductGradeField({ value, onChange, readOnly }: NewProductGradeFieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase text-muted-foreground">Variações</label>
      <Select
        value={value === null ? SEM_VARIACOES : String(value)}
        onValueChange={(escolha) => onChange(escolha === SEM_VARIACOES ? null : Number(escolha))}
        disabled={readOnly}
      >
        <SelectTrigger className="h-10 bg-background" aria-label="Variações do produto novo">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SEM_VARIACOES}>Sem variações</SelectItem>
          {GRADE_TYPES_ALPHABETICAL.map((tipo) => (
            <SelectItem key={tipo} value={String(tipo)}>
              {GRADE_TYPE_LABELS[tipo]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {value === null
          ? "O produto já chega em tamanhos, cores ou marcas? Escolha o tipo, e a quantidade vira uma linha por variação."
          : "O produto é cadastrado no recebimento, já com as variações, e o código de cada uma é bipado ou gerado ali."}
      </p>
    </div>
  );
}
