import { ExternalLink } from "lucide-react";
import { Button, Input } from "@workspace/ui";

type PurchaseLinkFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** Em marketplace fora de "Pendente" o link deixa de ser opcional. */
  required: boolean;
  supplierName?: string;
  readOnly: boolean;
};

/**
 * O link do anúncio da compra.
 *
 * Vira obrigatório quando o fornecedor é um marketplace e a compra sai de
 * "Pendente": numa plataforma com vários vendedores não há representante,
 * catálogo nem número de pedido para consultar depois — o link é a única forma
 * de reencontrar o item, seja para conferir o que chegou ou para recomprar.
 *
 * O botão de abrir aparece assim que há um link. É o mesmo gesto que a listagem
 * de compras oferece pelo menu, disponível também de dentro do formulário.
 */
export function PurchaseLinkField({
  value,
  onChange,
  required,
  supplierName,
  readOnly,
}: PurchaseLinkFieldProps) {
  return (
    <div className="space-y-2 md:col-span-2">
      <label className="text-xs font-semibold uppercase text-muted-foreground">
        Link da compra {required && <span className="text-red-500">*</span>}
      </label>

      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://..."
          className="h-10 bg-background"
          maxLength={500}
          readOnly={readOnly}
          aria-required={required}
        />
        {value.trim() && (
          <Button type="button" variant="outline" size="icon" className="h-10 w-10" asChild>
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              aria-label="Abrir o link da compra"
              title="Abrir o link da compra"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
      </div>

      {required && (
        <p className="text-xs text-amber-500">
          {supplierName} é um marketplace: sem o link não há como reencontrar o anúncio depois. Só compra
          pendente pode ficar sem ele.
        </p>
      )}
    </div>
  );
}
