import { ScrollText, UserCheck, UserRound, X } from "lucide-react";
import { Button } from "@workspace/ui";
import { formatPhone } from "@workspace/core";
import { Hint } from "@/components/hint";
import { EMPTY_CONSUMER, hasIdentifiedCustomer, usePdvStore } from "@/stores/use-pdv-store";
import { CUSTOMER_SHORTCUT_KEY, useCustomerDialog } from "../hooks/use-customer-dialog";
import { useLoyaltyStore } from "../hooks/use-loyalty";

/** Ver `keepFocusOnSearch` em `pdv-cart-actions.tsx`: o foco não sai da busca de produto. */
const keepFocusOnSearch = (event: { preventDefault: () => void }) => event.preventDefault();

/**
 * O cliente da venda no carrinho ESTENDIDO (01/10/2026): o botão Cliente (F2)
 * enquanto ninguém foi identificado, e o nome com o telefone depois. No
 * compacto, o botão mora na engrenagem e o cliente vai numa linha só com o
 * cartão fidelidade (`pdv-cart-customer-compact.tsx`).
 *
 * Fica no carrinho, e não só no checkout, porque o programa de fidelidade
 * precisa do cliente ANTES de fechar: é ele que diz quanto falta para o carimbo
 * e aplica o prêmio. O contador de vendas com cliente fica no Desempenho.
 */
export function PdvCartCustomer() {
  const consumer = usePdvStore((state) => state.consumer);
  const setConsumer = usePdvStore((state) => state.setConsumer);
  const show = useCustomerDialog((state) => state.show);
  const showStatement = useLoyaltyStore((state) => state.showStatement);
  const identified = hasIdentifiedCustomer(consumer);

  return (
    <div className="space-y-1">
      {identified ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5">
          <UserCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <button
            type="button"
            onMouseDown={keepFocusOnSearch}
            onClick={() => show("search")}
            className="min-w-0 flex-1 cursor-pointer text-left"
          >
            <span className="block truncate text-sm font-bold leading-tight">{consumer.name}</span>
            <span className="block truncate font-mono text-[11px] text-muted-foreground">
              {consumer.newCustomer
                ? "Cadastrado sem internet: sobe com a venda"
                : consumer.phone
                  ? formatPhone(consumer.phone)
                  : consumer.document || "Sem telefone"}
            </span>
          </button>
          {consumer.customerId !== null && (
            <Hint label="Extrato do cartão fidelidade">
              <Button
                aria-label="Extrato do cartão fidelidade"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 cursor-pointer text-muted-foreground"
                onMouseDown={keepFocusOnSearch}
                onClick={() => showStatement(consumer.customerId)}
              >
                <ScrollText className="h-4 w-4" />
              </Button>
            </Hint>
          )}
          <Hint label="Tirar o cliente da venda">
            <Button
              aria-label="Tirar o cliente da venda"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 cursor-pointer text-muted-foreground hover:text-destructive"
              onMouseDown={keepFocusOnSearch}
              onClick={() => setConsumer(EMPTY_CONSUMER)}
            >
              <X className="h-4 w-4" />
            </Button>
          </Hint>
        </div>
      ) : (
        <Button
          variant="outline"
          className="h-9 w-full gap-2 border-primary/20 text-xs font-bold tracking-widest hover:bg-primary/5"
          onMouseDown={keepFocusOnSearch}
          onClick={() => show("search")}
        >
          <UserRound className="h-4 w-4" /> CLIENTE ({CUSTOMER_SHORTCUT_KEY})
        </Button>
      )}
    </div>
  );
}
