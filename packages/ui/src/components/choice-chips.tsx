import { Check } from "lucide-react";
import { cn } from "../lib/utils";

export type ChoiceChipOption<T extends string | number> = {
  value: T;
  label: string;
};

type ChoiceChipsProps<T extends string | number> = {
  /** Rótulo do grupo, lido pelo leitor de tela. */
  label: string;
  options: ReadonlyArray<ChoiceChipOption<T>>;
  /** Valor escolhido, ou `null` quando nenhum. */
  value: T | null;
  onChange: (value: T | null) => void;
  /**
   * Tocar de novo no escolhido desmarca. Ligado por padrão: nos campos opcionais
   * do cadastro, "não sei" é voltar ao vazio, não escolher uma opção a mais.
   */
  allowDeselect?: boolean;
  className?: string;
};

/**
 * Escolha única em botões lado a lado, para listas curtas (sexo, faixa de
 * idade).
 *
 * No caixa, um toque resolve o que no select seriam dois (abrir e escolher), e
 * todas as opções ficam à vista para o operador ler em voz alta. O escolhido
 * ganha o mesmo verde do campo preenchido (`filledFieldClass`) e um ✓.
 */
export function ChoiceChips<T extends string | number>({
  label,
  options,
  value,
  onChange,
  allowDeselect = true,
  className,
}: ChoiceChipsProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(selected && allowDeselect ? null : option.value)}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-input bg-transparent px-2.5 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              selected &&
                "border-emerald-500 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-400 dark:bg-emerald-500/10 dark:text-emerald-200",
            )}
          >
            {selected && <Check className="h-3 w-3" aria-hidden />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
