import { ArrowDown, ArrowUp, Eraser, ImageIcon, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { buildPublicImageUrl } from "@workspace/api-client-react";
import { Button, cn, Input } from "@workspace/ui";
import { PRINTED_NAME_MAX_LENGTH, unavailableLabel, type CustomItem } from "../lib/customSelection";

interface CustomSelectionListProps {
  items: readonly CustomItem[];
  /** Quantos o formato comporta. Quem passa disso aparece marcado. */
  capacity: number;
  /** "Banner 9:16" — o formato, para o aviso de quem fica fora. */
  formatLabel: string;
  /** Quem o servidor recusou na última geração, com o código do motivo. */
  unavailable: Readonly<Record<number, number>>;
  disabled: boolean;
  /** O que impede gerar, em texto. `null` = pode. */
  blocker: string | null;
  /** Já há banner desta aba na tela: o botão vira "Atualizar banner". */
  hasPiece: boolean;
  onGenerate: () => void;
  onRename: (index: number, name: string) => void;
  onMove: (index: number, delta: -1 | 1) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
}

/**
 * Os produtos escolhidos, na ordem em que vão ser desenhados — o primeiro é o
 * canto de cima à esquerda do banner.
 *
 * O nome é editável, como na etiqueta de gôndola: o nome do cadastro nem sempre
 * cabe nas duas linhas do card, e "COPO AMERICANO [ORIGINAL]" pode sair "Copo
 * americano". Só no banner — o cadastro não muda. Vazio volta ao nome do
 * cadastro, que é o placeholder.
 *
 * O botão de gerar fica preso ao pé da lista, onde a pessoa termina de montar:
 * no celular a lista é longa, e o botão lá em cima ficaria longe do último "+".
 */
export function CustomSelectionList({
  items,
  capacity,
  formatLabel,
  unavailable,
  disabled,
  blocker,
  hasPiece,
  onGenerate,
  onRename,
  onMove,
  onRemove,
  onClear,
}: CustomSelectionListProps) {
  return (
    <div className="rounded-xl border bg-card p-4 pb-0 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Produtos no banner ({Math.min(items.length, capacity)} de {capacity})
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Na ordem do desenho: o primeiro fica no canto de cima, à esquerda. O nome pode ser encurtado só
            para o banner.
          </p>
        </div>
        {items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1.5"
            disabled={disabled}
            onClick={onClear}
          >
            <Eraser className="h-3.5 w-3.5" /> Limpar
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-border/70 py-8 text-center text-sm text-muted-foreground">
          Busque e adicione os produtos do banner.
        </p>
      ) : (
        <ol className="mt-2 divide-y">
          {items.map((item, index) => {
            const reason = unavailable[item.productGroupId];
            const outside = index >= capacity;
            return (
              <li
                key={item.productGroupId}
                className={cn("flex items-start gap-3 py-2", outside && "opacity-60")}
              >
                <span className="mt-2 w-5 shrink-0 text-right text-xs font-medium text-muted-foreground">
                  {index + 1}
                </span>
                {item.imageUrl ? (
                  <img
                    src={buildPublicImageUrl(item.imageUrl)}
                    alt=""
                    loading="lazy"
                    className="h-10 w-10 shrink-0 rounded-lg border border-border/50 object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                    <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <Input
                    value={item.printedName}
                    maxLength={PRINTED_NAME_MAX_LENGTH}
                    placeholder={item.catalogName}
                    title="Nome que sai impresso no banner"
                    aria-label={`Nome impresso de ${item.catalogName}`}
                    disabled={disabled}
                    onChange={(event) => onRename(index, event.target.value)}
                    className="h-9 w-full bg-background md:h-8"
                  />
                  {reason !== undefined && (
                    <p className="mt-1 text-xs text-destructive">Não entra: {unavailableLabel(reason)}</p>
                  )}
                  {outside && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      Fica fora do {formatLabel}, que leva {capacity}.
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title="Subir"
                    aria-label={`Subir ${item.catalogName}`}
                    disabled={disabled || index === 0}
                    onClick={() => onMove(index, -1)}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title="Descer"
                    aria-label={`Descer ${item.catalogName}`}
                    disabled={disabled || index === items.length - 1}
                    onClick={() => onMove(index, 1)}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    title="Tirar do banner"
                    aria-label={`Tirar ${item.catalogName} do banner`}
                    disabled={disabled}
                    onClick={() => onRemove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="sticky bottom-0 -mx-4 mt-2 space-y-1.5 rounded-b-xl border-t bg-card px-4 py-3">
        <Button
          onClick={onGenerate}
          disabled={blocker !== null || disabled}
          className="w-full gap-2 sm:w-auto"
        >
          {hasPiece ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {hasPiece ? "Atualizar banner" : "Gerar banner"}
        </Button>
        {blocker && <p className="text-xs text-muted-foreground">{blocker}</p>}
      </div>
    </div>
  );
}
