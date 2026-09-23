import * as React from "react";
import { Check, Pencil, X } from "lucide-react";
import { Button, Input } from "@workspace/ui";
import type { ReceivedPurchaseEntryItemDto } from "@workspace/api-client-react";
import { parseCorrectedCost } from "../lib/cost-correction";

type EntryItemCostCellProps = {
  item: ReceivedPurchaseEntryItemDto;
  formatCurrency: (value: number) => string;
  /** Pede a correção com o custo digitado. Quem confirma é a modal. */
  onSubmit: (unitCost: number) => void;
  /**
   * Avisa a modal quando o campo abre e fecha. É ela que segura o Esc: o Radix
   * escuta a tecla no documento, ANTES do campo, e sem isso o Esc de quem desiste
   * da correção fecharia o espelho da nota inteiro.
   */
  onEditingChange?: (editing: boolean) => void;
  /** Sem a correção disponível (ou com uma em andamento), o lápis fica desligado. */
  disabled?: boolean;
};

/**
 * O custo unitário do item, com a correção quando ela vale: só no item cujo lote
 * é o mais recente da variação, e único do produto na nota (`canEditUnitCost`, do
 * backend). É o custo que vale no cadastro; entrada anterior fica como foi
 * lançada.
 *
 * Quantidade e o resto da nota continuam sem edição (decisão do dono,
 * 23/09/2026).
 */
export function EntryItemCostCell({
  item,
  formatCurrency,
  onSubmit,
  onEditingChange,
  disabled = false,
}: EntryItemCostCellProps) {
  const [editando, setEditando] = React.useState(false);
  const [rascunho, setRascunho] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);

  function mudarEdicao(proximo: boolean) {
    setEditando(proximo);
    onEditingChange?.(proximo);
  }

  if (!item.canEditUnitCost) return <>{formatCurrency(item.unitCost)}</>;

  if (!editando) {
    return (
      <span className="inline-flex items-center justify-end gap-1">
        {formatCurrency(item.unitCost)}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          aria-label={`Corrigir o custo de ${item.productName}`}
          title="Corrigir o custo desta entrada"
          disabled={disabled}
          onClick={() => {
            setRascunho(item.unitCost.toFixed(2).replace(".", ","));
            setErro(null);
            mudarEdicao(true);
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </span>
    );
  }

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    const lido = parseCorrectedCost(rascunho);
    if ("error" in lido) {
      setErro(lido.error);
      return;
    }

    mudarEdicao(false);
    onSubmit(lido.value);
  }

  return (
    <form onSubmit={enviar} className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex items-center gap-1">
        <Input
          autoFocus
          inputMode="decimal"
          value={rascunho}
          onChange={(evento) => {
            setRascunho(evento.target.value);
            setErro(null);
          }}
          onKeyDown={(evento) => {
            // O Esc aqui é "desisto da correção", e não "fecha a nota".
            if (evento.key === "Escape") mudarEdicao(false);
          }}
          aria-label={`Novo custo unitário de ${item.productName}`}
          aria-invalid={erro !== null}
          className="h-8 w-24 text-right"
        />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Confirmar o novo custo"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Desistir da correção"
          onClick={() => mudarEdicao(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </span>
      {erro && <span className="text-[11px] text-destructive">{erro}</span>}
    </form>
  );
}
