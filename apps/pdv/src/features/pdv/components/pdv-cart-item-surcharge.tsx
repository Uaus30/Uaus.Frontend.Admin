import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button, Dialog, DialogContent, DialogTitle, Input, Label } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { PdvItem } from "../types";

/**
 * O acréscimo da linha do carrinho — o serviço cobrado junto do produto, como
 * gravar músicas no pendrive vendido.
 *
 * ## Como ele entra
 *
 * Pelo CAMPO DE PREÇO da linha, e não por um botão próprio. O operador digita o
 * valor combinado com o cliente: abaixo da tabela vira desconto, acima vira
 * acréscimo. É uma porta só, e é a que o balcão já usa para negociar — o botão
 * "+ Acréscimo" que existia antes era uma segunda forma de dizer a mesma coisa,
 * e obrigava a somar de cabeça o que o cliente ia pagar.
 *
 * Quem calcula o valor é `PdvCartItem`, que conhece o preço de tabela e o que
 * foi digitado. Este diálogo recebe o número pronto e pergunta **só o motivo** —
 * que é o dado que ninguém consegue derivar, e o que sai impresso no cupom logo
 * abaixo do valor.
 *
 * ## A cor
 *
 * Âmbar é "atenção" no vocabulário da casa (`Uaus.Docs/dominio/convencoes-de-
 * interface.md`): a linha tem cobrança além do produto e o operador tem que
 * reparar ao conferir o carrinho. O verde continua sendo do desconto. Nunca cor
 * sozinha — o rótulo "Acréscimo" e o ícone vão junto.
 */

type PdvCartItemSurchargeChipProps = {
  item: PdvItem;
  /** Tira o acréscimo da linha e devolve o preço ao valor de tabela. */
  onRemove: () => void;
};

/** O acréscimo já aplicado, na própria linha do carrinho. */
export function PdvCartItemSurchargeChip({ item, onRemove }: PdvCartItemSurchargeChipProps) {
  const surcharge = item.surcharge ?? 0;
  if (surcharge <= 0) return null;

  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <Plus className="h-3 w-3 shrink-0 text-amber-500" />
        <span className="shrink-0 text-[10px] font-semibold text-amber-500">
          Acréscimo {formatCurrency(surcharge)}
        </span>
        {/* O motivo quebra em quantas linhas precisar: truncá-lo esconderia
            justamente o que o operador tem que ler em voz alta no balcão. */}
        <span className="min-w-0 break-words text-[10px] text-muted-foreground">{item.surchargeReason}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
        aria-label="Remover acréscimo"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

type PdvSurchargeReasonDialogProps = {
  /** Acréscimo unitário em reais, já calculado. `null` mantém o diálogo fechado. */
  amount: number | null;
  /** Nome do produto, para o operador conferir em qual linha está mexendo. */
  productName: string;
  /** Preço de tabela do produto, o "de" da conta. */
  listPrice: number;
  /** Justificativa que já estava na linha, quando havia. */
  currentReason?: string;
  /** Confirma com o motivo escrito. */
  onConfirm: (reason: string) => void;
  /** Desiste: a linha volta ao que era, inclusive o campo de preço. */
  onCancel: () => void;
};

/**
 * Pergunta o MOTIVO de um acréscimo já calculado.
 *
 * O valor aparece pronto e não é editável: quem o define é o preço digitado na
 * linha. Dois campos para o mesmo número dariam ao operador a chance de deixá-los
 * discordando — e aí o cupom mostraria um acréscimo diferente do que a conta
 * cobrou.
 *
 * Confirmar sem motivo é recusado aqui e no servidor. É a única trava que sobrou
 * no caminho de cobrar a mais, e é de propósito que ela seja escrever alguma
 * coisa: um R$ 300,00 digitado no lugar de R$ 30,00 chega aqui como "Acréscimo
 * de R$ 275,00", em cima do preço de tabela, e o operador cancela.
 */
export function PdvSurchargeReasonDialog({
  amount,
  productName,
  listPrice,
  currentReason,
  onConfirm,
  onCancel,
}: PdvSurchargeReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  // Reset durante a renderização, e não num efeito: o campo já sai com o motivo
  // em vigor no primeiro paint. É o mesmo padrão do diálogo de desconto — um
  // efeito aqui reagiria a cada mudança do carrinho e apagaria o que o operador
  // estivesse digitando.
  const openedFor = amount === null ? null : `${productName}:${amount}`;
  const [resetFor, setResetFor] = useState<string | null>(null);
  if (openedFor !== null && openedFor !== resetFor) {
    setResetFor(openedFor);
    setReason(currentReason ?? "");
    setTouched(false);
  }

  const faltaMotivo = touched && !reason.trim();

  const confirm = () => {
    if (!reason.trim()) {
      setTouched(true);
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <Dialog open={amount !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="border-border bg-card p-6 shadow-2xl sm:max-w-[400px]">
        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
          <Plus className="h-5 w-5 text-amber-500" />
          Acréscimo no Item
        </DialogTitle>

        <div className="mt-6 space-y-5">
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
            <p className="truncate text-xs text-muted-foreground">{productName}</p>
            <p className="font-mono text-lg font-bold text-amber-500">+ {formatCurrency(amount ?? 0)}</p>
            <p className="text-[11px] text-muted-foreground">
              por unidade, sobre a tabela de {formatCurrency(listPrice)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo-acrescimo">Motivo (sai impresso no cupom)</Label>
            <Input
              id="motivo-acrescimo"
              type="text"
              placeholder="Gravação de músicas"
              className="h-12"
              maxLength={150}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirm();
              }}
              // `autoFocus` com seleção do texto: o diálogo abre pedindo UMA
              // coisa, e o cursor tem que estar nela. Selecionar o que já havia
              // deixa reescrever o motivo com uma digitada só.
              autoFocus
              onFocus={(e) => e.target.select()}
            />
            {faltaMotivo && (
              <p className="text-[11px] font-semibold text-destructive">
                Escreva o motivo — ele sai impresso no cupom do cliente.
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="ghost" className="flex-1" onClick={onCancel}>
              Cancelar
            </Button>
            <Button className="flex-1 bg-amber-500 text-white hover:bg-amber-600" onClick={confirm}>
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
