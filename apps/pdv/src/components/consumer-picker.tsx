import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IdCard, Loader2, Search, UserCheck, X } from "lucide-react";
import { apiGet, type BackendPagedResult, type CustomerDto } from "@workspace/api-client-react";
import { Button } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Label } from "@workspace/ui";
import { searchLocalCustomers } from "@/offline";
import { useOfflineStore } from "@/stores/use-offline-store";
import { EMPTY_CONSUMER, type PdvConsumer } from "@/stores/use-pdv-store";
import { MIN_SEARCH_LENGTH, useDebouncedValue } from "@/features/pdv/hooks/use-debounced-value";

type ConsumerPickerProps = {
  consumer: PdvConsumer;
  onChange: (consumer: PdvConsumer) => void;
};

/** Resultado da busca de clientes, no mínimo que a tela usa. */
type ConsumerOption = Pick<CustomerDto, "id" | "name" | "document">;

/**
 * Busca clientes na API e, quando ela não responde, na base local.
 *
 * A busca local existe porque identificar o consumidor é parte da venda: sem ela,
 * a queda de internet obrigaria a digitar nome e CPF de um cliente que já está
 * cadastrado.
 *
 * @param term Termo digitado, já com o debounce aplicado.
 * @param online Se a API está respondendo.
 */
async function searchConsumers(term: string, online: boolean): Promise<ConsumerOption[]> {
  if (online) {
    try {
      const result = await apiGet<BackendPagedResult<CustomerDto>>("/Customers", {
        search: term,
        page: 1,
        size: 8,
      });
      // Sem corpo, cai para a base local junto com os erros de rede: no balcão,
      // busca vazia e busca que falhou têm o mesmo desfecho útil.
      if (result) return result.items ?? [];
    } catch {
      // Cai para a base local: a queda pode acontecer com o checkout já aberto.
    }
  }

  return searchLocalCustomers(term);
}

/**
 * Identificação do consumidor no fechamento da venda.
 *
 * São dois caminhos: escolher um cliente já cadastrado no painel administrativo,
 * ou digitar o CPF/CNPJ ali no balcão. Os dois são excludentes — com cliente
 * escolhido, o cadastro é a fonte da verdade e o campo livre some.
 *
 * O balcão informa **apenas o documento**: é o que o cliente dita na hora de
 * pagar, e é a única identificação que sai no cupom. O nome do cliente cadastrado
 * ainda aparece aqui, mas só para o operador conferir quem escolheu na busca.
 */
export function ConsumerPicker({ consumer, onChange }: ConsumerPickerProps) {
  const [search, setSearch] = useState("");

  // Campo vazio zera a busca na hora, sem esperar o debounce: quem apaga o termo
  // (ou remove o cliente escolhido) não pode continuar vendo a lista anterior.
  const debouncedTerm = useDebouncedValue(search.trim());
  const debouncedSearch = search.trim() === "" ? "" : debouncedTerm;

  const online = useOfflineStore((state) => state.online);

  const { data, isFetching } = useQuery({
    queryKey: ["pdv-consumer-search", debouncedSearch, online],
    queryFn: () => searchConsumers(debouncedSearch, online),
    enabled: debouncedSearch.length >= MIN_SEARCH_LENGTH,
  });

  const results = debouncedSearch.length >= MIN_SEARCH_LENGTH ? (data ?? []) : [];
  const hasRegisteredCustomer = consumer.customerId !== null;

  const clear = () => {
    setSearch("");
    onChange(EMPTY_CONSUMER);
  };

  if (hasRegisteredCustomer) {
    return (
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          Consumidor
        </Label>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <UserCheck className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight">{consumer.name}</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {consumer.document || "Sem documento cadastrado"}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Remover cliente"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive cursor-pointer"
            onClick={clear}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        Consumidor
      </Label>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar cliente cadastrado..."
          className="h-10 pl-9"
        />
        {isFetching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {debouncedSearch.length >= MIN_SEARCH_LENGTH && (
        <div className="max-h-[132px] overflow-y-auto rounded-xl border border-border/50">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-center text-[11px] italic text-muted-foreground">
              {isFetching ? "Buscando..." : "Nenhum cliente encontrado com esse termo."}
            </p>
          ) : (
            results.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() =>
                  onChange({
                    customerId: customer.id,
                    name: customer.name,
                    document: customer.document ?? "",
                  })
                }
                className="flex w-full flex-col items-start border-b border-border/40 px-3 py-2 text-left transition-colors last:border-0 hover:bg-primary/10 cursor-pointer"
              >
                <span className="text-sm font-semibold leading-tight">{customer.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {customer.document || "Sem documento"}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <div className="h-px flex-1 bg-border/60" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          ou informe o CPF no balcão
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
            onChange({ ...consumer, customerId: null, name: "", document: event.target.value })
          }
          placeholder="CPF / CNPJ"
          className="h-10 pl-9 font-mono"
        />
      </div>

      <p className="text-[11px] text-muted-foreground">
        Sem preencher nada, o cupom sai como consumidor não identificado.
      </p>
    </div>
  );
}


