import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { buildPublicImageUrl } from "@workspace/api-client-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@workspace/ui";

type PdvCartItemImageProps = {
  /** Nome do produto. Vai para o texto alternativo da imagem, nunca para a tela. */
  name: string;
  /** Código de barras, exibido sob a ampliação. */
  barcode?: string;
  /** Caminho da imagem principal, como a busca devolve, ou nulo. */
  imageUrl?: string | null;
};

/** Moldura da coluna da foto: a mesma medida com ou sem imagem cadastrada. */
const FRAME_CLASS =
  "flex w-[5.25rem] shrink-0 items-center justify-center self-stretch overflow-hidden rounded-md border border-border/50 bg-muted/30";

/**
 * A coluna da foto do item no carrinho, com ampliação sob demanda.
 *
 * O quadro tem 84px — meia largura a mais que os 56px iniciais, medidos no
 * balcão. É o suficiente para reconhecer o produto, mas não para conferir a
 * variação (a cor da tampa, o volume impresso no rótulo). Passar o mouse ou
 * tocar na foto abre a versão grande; é a conferência que o operador faria
 * pegando o produto de volta da sacola.
 *
 * Produto sem foto cadastrada é comum no catálogo, e aí não há o que ampliar: o
 * quadro vira só o ícone, sem gatilho nenhum. Um botão que abre um retângulo
 * vazio ensina o operador a não clicar mais.
 *
 * ## Por que HoverCard, e por que também no clique
 *
 * O `HoverCard` do Radix não move o foco ao abrir — é o que salva o balcão: o
 * cursor tem que ficar no campo de busca, senão o próximo bipe do leitor é
 * digitado noutro lugar e some. Mas ele só reage a `hover`, e o PDV roda em
 * touchscreen, onde `hover` não existe: por isso o clique também abre, e o
 * `preventDefault` no `mousedown` impede que o toque leve o foco junto.
 */
export function PdvCartItemImage({ name, barcode, imageUrl }: PdvCartItemImageProps) {
  const [open, setOpen] = useState(false);

  if (!imageUrl) {
    return (
      <div className={FRAME_CLASS}>
        <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
      </div>
    );
  }

  const src = buildPublicImageUrl(imageUrl);

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`Ampliar a foto de ${name}`}
          className={`${FRAME_CLASS} cursor-zoom-in transition-colors hover:border-primary/60`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((aberto) => !aberto)}
        >
          <img loading="lazy" decoding="async" src={src} alt="" className="h-full w-full object-contain" />
        </button>
      </HoverCardTrigger>

      {/* Abre para a ESQUERDA: o carrinho é a coluna encostada na borda direita
          da tela, e para o outro lado a ampliação sairia da janela. */}
      <HoverCardContent
        side="left"
        align="center"
        className="w-64 p-3"
        onPointerDownOutside={() => setOpen(false)}
      >
        <img
          src={src}
          alt={name}
          className="h-56 w-full rounded-md border border-border/40 bg-muted/20 object-contain"
        />
        {/* O código de barras, e não o nome: o nome já está na linha do carrinho,
            ao lado desta mesma foto, e repeti-lo aqui gastava a legenda com o que
            o operador acabou de ler. O código saiu da linha para cá — ele só é
            consultado quando há dúvida sobre QUAL produto é, que é exatamente
            quando a foto é ampliada. Produto sem código cai no nome, para a
            legenda não ficar vazia. */}
        <p className="mt-2 text-center font-mono text-base font-semibold tracking-wide leading-tight break-words">
          {barcode?.trim() || name}
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}
