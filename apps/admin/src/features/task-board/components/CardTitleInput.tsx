import { forwardRef, useState } from "react";

interface CardTitleInputProps {
  title: string;
  onSave: (title: string) => void;
}

/**
 * O título editável no lugar: salva ao sair do campo ou no Enter; Esc desfaz.
 * Com `forwardRef` porque a modal o usa como `DialogTitle asChild`.
 */
export const CardTitleInput = forwardRef<HTMLInputElement, CardTitleInputProps>(function CardTitleInput(
  { title, onSave, ...rest },
  ref,
) {
  const [value, setValue] = useState(title);

  return (
    <input
      {...rest}
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onSave(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setValue(title);
      }}
      maxLength={200}
      aria-label="Título do cartão"
      className="w-full rounded-md bg-transparent px-1 text-lg font-semibold leading-tight tracking-tight outline-none ring-ring focus:bg-foreground/10 focus:ring-2"
    />
  );
});
