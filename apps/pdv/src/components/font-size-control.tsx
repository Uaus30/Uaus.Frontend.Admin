import { AArrowDown, AArrowUp, RotateCcw } from "lucide-react";
import { FONT_SCALES, usePdvStore } from "@/stores/use-pdv-store";
import { Hint } from "./hint";

/**
 * Controle de tamanho da fonte do PDV.
 *
 * Escala a interface inteira, não só o texto: todo o layout é medido em `rem`,
 * então mexer na raiz aumenta botões e espaçamentos junto — que é o que ajuda
 * de verdade em monitor de balcão.
 *
 * Compacto de propósito: é um controle que o operador toca uma vez por turno, e
 * no cabeçalho ele disputava espaço com o que se usa a venda inteira (calculadora,
 * tela cheia, operador, menu).
 */
export function FontSizeControl() {
  const fontScaleIndex = usePdvStore((state) => state.fontScaleIndex);
  const stepFontScale = usePdvStore((state) => state.stepFontScale);
  const resetFontScale = usePdvStore((state) => state.resetFontScale);

  const scale = FONT_SCALES[fontScaleIndex];
  const isDefault = scale === 1;

  return (
    <div className="flex items-center rounded-lg border border-border/50 bg-muted/20 p-0.5">
      <Hint label="Diminuir o tamanho do texto" side="bottom">
        <button
          type="button"
          onClick={() => stepFontScale(-1)}
          disabled={fontScaleIndex === 0}
          aria-label="Diminuir o tamanho do texto"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
        >
          <AArrowDown className="h-3.5 w-3.5" />
        </button>
      </Hint>

      <Hint label="Voltar ao tamanho padrão" side="bottom">
        <button
          type="button"
          onClick={resetFontScale}
          disabled={isDefault}
          aria-label="Voltar ao tamanho padrão"
          className="flex min-w-[2.5rem] items-center justify-center gap-0.5 rounded-md px-0.5 py-1 font-mono text-[10px] font-bold text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-muted-foreground cursor-pointer"
        >
          {!isDefault && <RotateCcw className="h-2.5 w-2.5" />}
          {Math.round(scale * 100)}%
        </button>
      </Hint>

      <Hint label="Aumentar o tamanho do texto" side="bottom">
        <button
          type="button"
          onClick={() => stepFontScale(1)}
          disabled={fontScaleIndex === FONT_SCALES.length - 1}
          aria-label="Aumentar o tamanho do texto"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
        >
          <AArrowUp className="h-3.5 w-3.5" />
        </button>
      </Hint>
    </div>
  );
}
