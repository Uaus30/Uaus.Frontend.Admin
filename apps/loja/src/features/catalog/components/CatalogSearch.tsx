import { Loader2, Search } from "lucide-react";

interface CatalogSearchProps {
  value: string;
  onChange: (value: string) => void;
  isSearching: boolean;
}

/** Campo de busca da vitrine, no visual do site original. */
export function CatalogSearch({ value, onChange, isSearching }: CatalogSearchProps) {
  return (
    <div className="relative mx-auto max-w-xl">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar produtos por nome ou descrição"
        aria-label="Buscar produtos"
        className="h-12 w-full rounded-2xl border border-border bg-white pr-12 pl-12 text-foreground transition-colors outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
      />
      {isSearching && (
        <Loader2
          aria-label="Buscando"
          className="absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 animate-spin text-primary"
        />
      )}
    </div>
  );
}
