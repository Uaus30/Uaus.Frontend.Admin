import React, { useState } from "react";
import { Check, ChevronsUpDown, UserRound } from "lucide-react";
import {
  Button,
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from "@workspace/ui";

type CustomerOption = { id: number; name: string; document?: string | null; phone?: string | null };

type CustomerPickerProps = {
  customers: CustomerOption[];
  value: number | null;
  onChange: (customerId: number | null) => void;
};

/**
 * O cliente da venda, por busca (06/10/2026). Era um select com a lista inteira
 * de clientes — no celular, rolar centenas de nomes no dedo para achar um.
 *
 * Busca por nome, CPF ou telefone, na lista que já veio para a tela (o filtro do
 * `cmdk` casa por trecho, sem acento nem caixa). "Consumidor final" é a primeira
 * opção, como era. `Popover modal`: ele abre dentro de diálogo, e sem isso a lista
 * não rola com a roda do mouse (ver convenções de interface, 06/10/2026).
 */
export function CustomerPicker({ customers, value, onChange }: CustomerPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = customers.find((customer) => customer.id === value) ?? null;

  function choose(customerId: number | null) {
    onChange(customerId);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Cliente da venda"
          className="h-10 w-full justify-between bg-background font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected ? selected.name : "Consumidor final"}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Nome, CPF ou telefone..." />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
            <CommandItem value="consumidor final" onSelect={() => choose(null)} className="py-2.5">
              <Check className={cn("mr-2 h-4 w-4", value === null ? "opacity-100" : "opacity-0")} />
              Consumidor final
            </CommandItem>
            {customers.map((customer) => (
              <CommandItem
                key={customer.id}
                // O `value` é o que o filtro procura: nome, documento e telefone juntos.
                value={`${customer.name} ${customer.document ?? ""} ${customer.phone ?? ""} #${customer.id}`}
                onSelect={() => choose(customer.id)}
                className="py-2.5"
              >
                <Check className={cn("mr-2 h-4 w-4", value === customer.id ? "opacity-100" : "opacity-0")} />
                <span className="min-w-0">
                  <span className="block truncate">{customer.name}</span>
                  {customer.document && (
                    <span className="block font-mono text-xs text-muted-foreground">{customer.document}</span>
                  )}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
