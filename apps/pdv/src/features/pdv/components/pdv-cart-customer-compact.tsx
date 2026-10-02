import { Gift, ScrollText, Star, UserCheck, X } from "lucide-react";
import { Button } from "@workspace/ui";
import { formatPhone } from "@workspace/core";
import { Hint } from "@/components/hint";
import { EMPTY_CONSUMER, hasIdentifiedCustomer, usePdvStore } from "@/stores/use-pdv-store";
import { useCustomerDialog } from "../hooks/use-customer-dialog";
import { useLoyaltyStore } from "../hooks/use-loyalty";
import { useLoyaltyCard } from "../hooks/use-loyalty-card";

/** Ver `keepFocusOnSearch` em `pdv-cart-actions.tsx`: o foco não sai da busca de produto. */
const keepFocusOnSearch = (event: { preventDefault: () => void }) => event.preventDefault();

const chip = "inline-flex items-center gap-1 rounded-md border px-2 py-1";

/**
 * Cliente e cartão fidelidade no carrinho COMPACTO, numa linha só (pedido do
 * dono, 01/10/2026): "Wagner vai ganhar 1 carimbo", o prêmio com "Guardar", o
 * extrato e o X que tira o cliente.
 *
 * O monitor do caixa da loja é HD. Medido em 1366×768: o cliente (com o
 * contador do turno) e as três caixas do programa tiravam 151px da lista de
 * itens — com cliente e prêmio, ela caía de 377px para 226px. Por isso, no
 * compacto, o botão Cliente mora na engrenagem (o F2 continua), o contador foi
 * para o Desempenho, e esta linha só aparece com o cliente identificado.
 */
export function PdvCartCustomerCompact() {
  const consumer = usePdvStore((state) => state.consumer);
  const setConsumer = usePdvStore((state) => state.setConsumer);
  const show = useCustomerDialog((state) => state.show);
  const showStatement = useLoyaltyStore((state) => state.showStatement);
  const loyalty = useLoyaltyCard();

  if (!hasIdentifiedCustomer(consumer)) return null;

  const firstName = consumer.name.trim().split(/\s+/)[0] || consumer.name;
  const contact = consumer.newCustomer
    ? "Cadastrado sem internet: sobe com a venda"
    : consumer.phone
      ? formatPhone(consumer.phone)
      : consumer.document || "";
  const cardHint = loyalty ? ` · cartão fidelidade: ${loyalty.cardLabel}` : "";

  // O que a compra faz no cartão, com o nome do cliente; sem programa ou sem
  // item, só o nome — é ele que diz ao operador de quem é a venda.
  const status =
    loyalty?.hasItems && loyalty.earnsStamp ? (
      <span
        className={`${chip} border-amber-500/50 bg-amber-400/15 font-semibold text-amber-800 dark:text-amber-300`}
      >
        <Star className="h-3.5 w-3.5 fill-current" aria-hidden /> {firstName} vai ganhar 1 carimbo
      </span>
    ) : loyalty?.hasItems ? (
      <span className={`${chip} border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-300`}>
        {firstName}: faltam <strong>{loyalty.missing}</strong> para o carimbo
      </span>
    ) : (
      <span className={`${chip} border-emerald-500/40 bg-emerald-500/10 font-semibold`}>
        <UserCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden /> {firstName}
        {loyalty?.required ? (
          <span className="font-normal tabular-nums text-muted-foreground">
            · {loyalty.stamps}/{loyalty.required}
          </span>
        ) : null}
      </span>
    );

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <Hint label={`${consumer.name}${contact ? ` · ${contact}` : ""}${cardHint}. Clique para trocar.`}>
        <button
          type="button"
          aria-label={`Cliente da venda: ${consumer.name}. Trocar cliente`}
          onMouseDown={keepFocusOnSearch}
          onClick={() => show("search")}
          className="cursor-pointer rounded-md text-left"
        >
          {status}
        </button>
      </Hint>

      {loyalty?.prizeApplied && (
        // Abaixo do mínimo do prêmio, o chip fica apagado e a explicação vai para a
        // dica: escrita, ela quebrava a linha no começo da venda — e o rodapé já
        // diz quanto falta.
        <Hint
          label={
            loyalty.couponDiscount > 0
              ? null
              : "Abaixo da compra mínima do prêmio: entra quando a compra chegar lá"
          }
        >
          <span
            className={`${chip} border-emerald-500/40 bg-emerald-500/10 py-0.5 pr-0.5 font-semibold ${
              loyalty.couponDiscount > 0 ? "" : "opacity-60"
            }`}
          >
            <Gift className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            Prêmio {loyalty.appliedLabel}
            <Button
              aria-label="Guardar para a próxima"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px]"
              onMouseDown={keepFocusOnSearch}
              onClick={loyalty.save}
            >
              Guardar
            </Button>
          </span>
        </Hint>
      )}

      {loyalty?.offeredReward && (
        <Button
          aria-label={`Usar o prêmio de ${loyalty.offeredLabel}`}
          variant="outline"
          size="sm"
          className="h-7 gap-1 border-emerald-500/40 px-2 text-[11px]"
          onMouseDown={keepFocusOnSearch}
          onClick={loyalty.useReward}
        >
          <Gift className="h-3.5 w-3.5" aria-hidden /> Usar {loyalty.offeredLabel}
        </Button>
      )}

      <span className="ml-auto flex items-center">
        {consumer.customerId !== null && (
          <Hint label="Extrato do cartão fidelidade">
            <Button
              aria-label="Extrato do cartão fidelidade"
              variant="ghost"
              size="icon"
              className="h-6 w-6 cursor-pointer text-muted-foreground"
              onMouseDown={keepFocusOnSearch}
              onClick={() => showStatement(consumer.customerId)}
            >
              <ScrollText className="h-3.5 w-3.5" />
            </Button>
          </Hint>
        )}
        <Hint label="Tirar o cliente da venda">
          <Button
            aria-label="Tirar o cliente da venda"
            variant="ghost"
            size="icon"
            className="h-6 w-6 cursor-pointer text-muted-foreground hover:text-destructive"
            onMouseDown={keepFocusOnSearch}
            onClick={() => setConsumer(EMPTY_CONSUMER)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </Hint>
      </span>
    </div>
  );
}
