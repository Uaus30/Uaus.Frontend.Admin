import { IdCard, UserCheck, UserRound, X } from "lucide-react";
import { Button, Input, Label } from "@workspace/ui";
import { formatPhone } from "@workspace/core";
import { EMPTY_CONSUMER, hasIdentifiedCustomer, type PdvConsumer } from "@/stores/use-pdv-store";
import { CUSTOMER_SHORTCUT_KEY, useCustomerDialog } from "@/features/pdv/hooks/use-customer-dialog";
import { Hint } from "./hint";

type ConsumerPickerProps = {
  consumer: PdvConsumer;
  onChange: (consumer: PdvConsumer) => void;
};

/**
 * Identificação do consumidor no fechamento da venda.
 *
 * São dois caminhos, excludentes: o cliente cadastrado — escolhido ou
 * cadastrado no diálogo de cliente, o mesmo do botão Cliente do carrinho e do
 * F2 (01/10/2026) — ou o CPF/CNPJ digitado no balcão, sem cadastro, que é o
 * "CPF na nota" e só sai impresso no cupom.
 *
 * A busca saiu daqui e foi para o diálogo: uma busca só, com as mesmas regras
 * (telefone até sem DDD, CPF, nome) e o cadastro rápido ao lado.
 */
export function ConsumerPicker({ consumer, onChange }: ConsumerPickerProps) {
  const show = useCustomerDialog((state) => state.show);

  if (hasIdentifiedCustomer(consumer)) {
    return (
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          Cliente
        </Label>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <UserCheck className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight">{consumer.name}</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {consumer.newCustomer
                  ? "Cadastrado sem internet: sobe com a venda"
                  : [consumer.phone && formatPhone(consumer.phone), consumer.document]
                      .filter(Boolean)
                      .join(" · ") || "Sem telefone nem CPF"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 cursor-pointer"
              onClick={() => show("search")}
            >
              Trocar
            </Button>
            <Hint label="Tirar o cliente da venda">
              <Button
                aria-label="Tirar o cliente da venda"
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive cursor-pointer"
                onClick={() => onChange(EMPTY_CONSUMER)}
              >
                <X className="h-4 w-4" />
              </Button>
            </Hint>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Cliente</Label>

      <Button
        type="button"
        variant="outline"
        className="h-10 w-full gap-2 font-bold"
        onClick={() => show("search")}
      >
        <UserRound className="h-4 w-4" /> Identificar ou cadastrar cliente ({CUSTOMER_SHORTCUT_KEY})
      </Button>

      <div className="flex items-center gap-2 pt-1">
        <div className="h-px flex-1 bg-border/60" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          ou só o CPF na nota
        </span>
        <div className="h-px flex-1 bg-border/60" />
      </div>

      <div className="relative">
        <IdCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={consumer.document}
          onChange={(event) =>
            // O documento digitado no balcão é sempre avulso: escolher um cliente
            // cadastrado é o outro caminho, e os dois são excludentes.
            onChange({ ...EMPTY_CONSUMER, document: event.target.value })
          }
          placeholder="CPF / CNPJ"
          className="h-10 pl-9 font-mono"
        />
      </div>

      <p className="text-[11px] text-muted-foreground">
        Sem preencher nada, o cupom sai como consumidor não identificado. O CPF na nota não participa do
        programa de fidelidade: para isso, identifique o cliente.
      </p>
    </div>
  );
}
