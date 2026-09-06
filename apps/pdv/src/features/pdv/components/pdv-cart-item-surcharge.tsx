import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button, Dialog, DialogContent, DialogTitle, Input, Label, useToast } from "@workspace/ui";
import { formatCurrency, parseAmount, round2 } from "@workspace/core";
import { usePdvStore } from "@/stores/use-pdv-store";
import type { PdvItem } from "../types";

type PdvCartItemSurchargeProps = {
  item: PdvItem;
};

/**
 * O acréscimo da linha do carrinho — o serviço cobrado junto do produto, como
 * gravar músicas no pendrive vendido.
 *
 * ## Por que é um campo próprio, e não "digitar um preço maior"
 *
 * O campo de valor unitário da linha só aceita preço ABAIXO da tabela, e essa
 * recusa é proteção contra digitação errada (ver `PdvCartItem`). Se o acréscimo
 * entrasse por ali, a proteção teria que cair para todo mundo, e um R$ 300,00
 * digitado no lugar de R$ 30,00 passaria calado. Aqui o acréscimo é um ato
 * deliberado, com justificativa obrigatória — e o preço unitário continua
 * guardado.
 *
 * A justificativa não é enfeite: ela sai impressa no cupom, logo abaixo do
 * valor, e é o que o operador aponta quando o cliente pergunta por que o
 * pendrive de R$ 25,00 saiu R$ 30,00.
 *
 * ## A cor
 *
 * Âmbar é "atenção" no vocabulário da casa (`Uaus.Docs/dominio/convencoes-de-
 * interface.md`), e é o que a linha com acréscimo é: fora do padrão, para o
 * operador reparar ao conferir o carrinho. O verde continua reservado ao
 * desconto. Nunca cor sozinha — o rótulo "Acréscimo" e o ícone acompanham.
 */
export function PdvCartItemSurcharge({ item }: PdvCartItemSurchargeProps) {
  const { toast } = useToast();
  const applyItemSurcharge = usePdvStore((state) => state.applyItemSurcharge);

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");

  const surcharge = item.surcharge ?? 0;

  /** Abre o diálogo já preenchido com o acréscimo em vigor, quando há um. */
  const openDialog = () => {
    setValue(surcharge > 0 ? surcharge.toFixed(2).replace(".", ",") : "");
    setReason(item.surchargeReason ?? "");
    setOpen(true);
  };

  const confirm = () => {
    const informado = parseAmount(value);

    if (Number.isNaN(informado) || informado <= 0) {
      toast({
        title: "Acréscimo inválido",
        description: "Digite um valor maior que zero.",
        variant: "destructive",
      });
      return;
    }

    // A justificativa é obrigatória aqui e no servidor. Barrar já no balcão evita
    // a venda voltar recusada com o cliente esperando pelo cupom.
    if (!reason.trim()) {
      toast({
        title: "Falta a justificativa",
        description: "Escreva o motivo do acréscimo — ele sai impresso no cupom.",
        variant: "destructive",
      });
      return;
    }

    applyItemSurcharge(item.id, round2(informado), reason);
    setOpen(false);
    toast({
      title: "Acréscimo aplicado",
      description: `${formatCurrency(round2(informado))} por unidade em ${item.name}.`,
      duration: 2000,
    });
  };

  const remove = () => {
    applyItemSurcharge(item.id, 0, "");
    setOpen(false);
    toast({ title: "Acréscimo removido", duration: 2000 });
  };

  return (
    <>
      {surcharge > 0 ? (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1">
          <button
            type="button"
            onClick={openDialog}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            <Plus className="h-3 w-3 shrink-0 text-amber-500" />
            <span className="shrink-0 text-[10px] font-semibold text-amber-500">
              Acréscimo {formatCurrency(surcharge)}
            </span>
            {/* O motivo quebra em quantas linhas precisar: truncá-lo esconderia
                justamente o que o operador tem que ler em voz alta no balcão. */}
            <span className="min-w-0 break-words text-[10px] text-muted-foreground">
              {item.surchargeReason}
            </span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
            aria-label="Remover acréscimo"
            onClick={remove}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button
          variant="link"
          size="sm"
          className="mt-1 h-4 justify-start p-0 text-[10px] font-semibold text-muted-foreground hover:text-amber-500"
          onClick={openDialog}
        >
          <Plus className="mr-1 h-3 w-3" />
          Acréscimo
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-border bg-card p-6 shadow-2xl sm:max-w-[400px]">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Plus className="h-5 w-5 text-amber-500" />
            Acréscimo no Item
          </DialogTitle>

          <div className="mt-6 space-y-6">
            <p className="text-xs text-muted-foreground">
              {item.name} — tabela {formatCurrency(item.price)}
            </p>

            <div className="space-y-2">
              <Label>Quanto de acréscimo, por unidade?</Label>
              <Input
                type="text"
                placeholder="R$ 0,00"
                className="h-12 font-mono text-lg"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Motivo (sai impresso no cupom)</Label>
              <Input
                type="text"
                placeholder="Gravação de músicas"
                className="h-12"
                maxLength={150}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirm();
                }}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              {surcharge > 0 && (
                <Button
                  variant="outline"
                  className="flex-1 cursor-pointer border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={remove}
                >
                  Remover
                </Button>
              )}
              <Button className="flex-1 bg-amber-500 text-white hover:bg-amber-600" onClick={confirm}>
                Aplicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
