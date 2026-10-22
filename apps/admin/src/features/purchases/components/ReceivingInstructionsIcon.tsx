import { useState } from "react";
import { MessageSquareWarning } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui";

type ReceivingInstructionsIconProps = {
  /** O texto das instruções de recebimento da compra. */
  text: string;
};

/**
 * O ícone da compra que tem INSTRUÇÕES DE RECEBIMENTO, na listagem (22/10/2026,
 * sugestão do dono): mensagem âmbar pulsando, com o texto num tooltip.
 *
 * Âmbar porque é "em andamento, atenção" no vocabulário de cores da loja — não é
 * erro. Pulsa para quem recebe a mercadoria não passar pela linha sem ver; quem
 * pediu menos movimento no sistema (`prefers-reduced-motion`) vê o ícone parado.
 *
 * O tooltip abre no mouse e também no TOQUE: no celular não há "passar o mouse",
 * então o clique alterna. O clique não chega à linha — que abriria a compra —,
 * nem o Enter do teclado.
 */
export function ReceivingInstructionsIcon({ text }: ReceivingInstructionsIconProps) {
  const [aberto, setAberto] = useState(false);

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip open={aberto} onOpenChange={setAberto}>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-testid="receiving-instructions-icon"
            aria-label={`Instruções de recebimento: ${text}`}
            // Sem isto o Radix fecha o tooltip no `pointerdown` e o clique logo em
            // seguida o reabre: o segundo toque nunca fechava.
            onPointerDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.stopPropagation();
              setAberto((atual) => !atual);
            }}
            onKeyDown={(event) => event.stopPropagation()}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-amber-500 hover:bg-amber-500/10 dark:text-amber-400"
          >
            <MessageSquareWarning className="h-4 w-4 motion-safe:animate-pulse" />
          </button>
        </TooltipTrigger>
        {/* O conteúdo vai para um portal, mas o React propaga o clique pela ÁRVORE
            de componentes: sem o `stopPropagation`, tocar no texto abria a compra. */}
        <TooltipContent
          className="max-w-xs whitespace-pre-line text-left text-xs leading-relaxed"
          onClick={(event) => event.stopPropagation()}
        >
          <span className="mb-1 block font-semibold">Instruções de recebimento</span>
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
