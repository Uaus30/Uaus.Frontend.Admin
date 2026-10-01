import { useEffect, useState } from "react";
import { Loader2, Search, UserPlus, Users } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  useToast,
} from "@workspace/ui";
import { cityFromCityState, describeApiError, formatCpf, formatPhone } from "@workspace/core";
import type { CreateCustomerPayload } from "@workspace/api-client-react";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { usePdvStore, type PdvConsumer } from "@/stores/use-pdv-store";
import { CUSTOMER_SHORTCUT_KEY, useCustomerDialog } from "../hooks/use-customer-dialog";
import {
  isUnambiguousMatch,
  prefillFromSearch,
  toConsumer,
  useCustomerSearch,
  type CustomerOption,
} from "../hooks/use-customer-search";
import { useRegisterCustomer } from "../hooks/use-register-customer";
import { CustomerQuickForm } from "./customer-quick-form";

/** DDD de fábrica, o do backend, enquanto a configuração da loja não chega. */
const STANDARD_AREA_CODE = 44;

/** Uma linha de cliente: nome e o número pelo qual ele foi achado. */
function CustomerRow({ customer, onPick }: { customer: CustomerOption; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full cursor-pointer items-center gap-3 border-b border-border/40 px-3 py-2 text-left transition-colors last:border-0 hover:bg-primary/10"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-tight">{customer.name}</span>
        <span className="block font-mono text-[11px] text-muted-foreground">
          {[customer.phone && formatPhone(customer.phone), customer.document && formatCpf(customer.document)]
            .filter(Boolean)
            .join(" · ") || "Sem telefone nem CPF"}
        </span>
      </span>
    </button>
  );
}

/**
 * Identificação do cliente da venda (01/10/2026): o botão Cliente do carrinho,
 * o F2 e o checkout abrem este diálogo.
 *
 * O operador digita o número que o cliente disser — telefone até sem DDD, CPF
 * com ou sem máscara — ou o nome. Quando o número aponta um cliente só, sem
 * dúvida (o telefone ou CPF exatos, ou o telefone que termina com o número dito
 * sem DDD), o diálogo já escolhe e fecha. Não achou: o cadastro rápido nasce
 * com o que foi digitado.
 */
export function CustomerDialog() {
  const { open, mode, setOpen, setMode, show } = useCustomerDialog();
  const setConsumer = usePdvStore((state) => state.setConsumer);
  const { settings } = useCompanySettings();
  const { register, isRegistering } = useRegisterCustomer();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [duplicate, setDuplicate] = useState<CustomerOption | null>(null);
  const { term, enabled, results, isFetching, settled } = useCustomerSearch(search);

  // Sem modificadores e sem repetição, como o F4 do cupom.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== CUSTOMER_SHORTCUT_KEY || event.repeat) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      // Já aberto, o F2 não faz nada: trocaria o cadastro meio preenchido pela busca.
      if (!useCustomerDialog.getState().open) show("search");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [show]);

  // Reset durante a renderização, como o diálogo do cupom: o campo já abre vazio.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    setSearch("");
    setDuplicate(null);
  }

  const choose = (consumer: PdvConsumer) => {
    setConsumer(consumer);
    setOpen(false);
  };

  const single = settled && results.length === 1 ? results[0] : null;
  const autoPick = mode === "search" && single && isUnambiguousMatch(term, single) ? single : null;
  useEffect(() => {
    if (!autoPick) return;
    setConsumer(toConsumer(autoPick));
    setOpen(false);
    toast({ title: "Cliente identificado", description: autoPick.name });
  }, [autoPick, setConsumer, setOpen, toast]);

  const submit = async (payload: CreateCustomerPayload) => {
    try {
      const outcome = await register(payload);
      if (outcome.kind === "duplicate") {
        setDuplicate(outcome.existing);
        return;
      }
      if (outcome.kind === "queued") {
        toast({ title: "Cadastrado sem internet", description: "O cadastro sobe junto com a venda." });
      }
      choose(outcome.consumer);
    } catch (error) {
      toast({
        title: "Não foi possível cadastrar",
        description: describeApiError(error),
        error,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card p-6 shadow-2xl sm:max-w-[560px]">
        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
          <Users className="h-5 w-5 text-primary" />{" "}
          {mode === "search" ? "Cliente da venda" : "Cadastrar cliente"}
        </DialogTitle>
        <DialogDescription className="text-xs">
          {mode === "search"
            ? "Telefone (até sem DDD), CPF ou nome."
            : "Nome e telefone ou CPF. O resto é opcional."}
        </DialogDescription>

        {duplicate && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-sm">
              Já cadastrado: <strong>{duplicate.name}</strong>
            </p>
            <Button size="sm" onClick={() => choose(toConsumer(duplicate))}>
              Usar este cliente
            </Button>
          </div>
        )}

        {mode === "register" ? (
          <CustomerQuickForm
            prefill={prefillFromSearch(search)}
            defaultAreaCode={settings.defaultAreaCode ?? STANDARD_AREA_CODE}
            defaultCity={cityFromCityState(settings.cityState)}
            isSaving={isRegistering}
            onSubmit={(payload) => void submit(payload)}
            onBack={() => {
              setDuplicate(null);
              setMode("search");
            }}
          />
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                aria-label="Buscar cliente"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="99876-4321, 529.982.247-25 ou Ana"
                className="h-11 pl-9 text-base"
              />
              {isFetching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>

            {enabled && (
              <div className="max-h-64 overflow-y-auto rounded-xl border border-border/50">
                {results.length === 0 ? (
                  <p className="px-3 py-3 text-center text-xs italic text-muted-foreground">
                    {isFetching ? "Buscando..." : "Nenhum cliente com esse número ou nome."}
                  </p>
                ) : (
                  results.map((customer) => (
                    <CustomerRow
                      key={customer.id}
                      customer={customer}
                      onPick={() => choose(toConsumer(customer))}
                    />
                  ))
                )}
              </div>
            )}

            <Button variant="outline" className="w-full gap-2 font-bold" onClick={() => setMode("register")}>
              <UserPlus className="h-4 w-4" /> Cadastrar novo cliente
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
