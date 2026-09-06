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
  /**
   * Para que lado a ampliação abre. `left` é o do carrinho, encostado na borda
   * direita da tela; a lista de resultados fica na coluna da esquerda e abre
   * para a `right`, senão a ampliação sairia da janela.
   */
  side?: "left" | "right";
  /**
   * Moldura da miniatura. O carrinho usa a coluna de 84px que se estica com a
   * linha; a lista de resultados, um quadrado de 48px. Só a moldura muda — a
   * ampliação e a legenda são as mesmas nos dois lugares.
   */
  frameClassName?: string;
};

/** Moldura da coluna da foto: a mesma medida com ou sem imagem cadastrada. */
const FRAME_CLASS =
  "relative flex w-[5.25rem] shrink-0 items-center justify-center self-stretch overflow-hidden rounded-md border border-border/50";

/**
 * Fundo branco atrás da foto, aqui e na ampliação.
 *
 * O `object-contain` deixa sobra quando a proporção da foto não é a do quadro, e
 * essa sobra era o fundo escuro do tema: a foto deitada ganhava duas faixas
 * pretas e o carrinho ficava com miniaturas de formatos diferentes uma embaixo
 * da outra. O catálogo é fotografado em fundo branco, então o branco continua a
 * própria foto — a sobra some, e todo item fica com o mesmo retângulo
 * arredondado.
 *
 * Branco fixo, e não um token de tema: ele acompanha a foto, não a interface, e
 * escurecer no tema escuro traria as faixas de volta.
 */
const PHOTO_BACKGROUND = "bg-white";

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
 *
 * Nasceu no carrinho e desde 05/09/2026 serve também a lista de resultados da
 * busca (`PdvSearchPanel`): escolher entre "...CONICA" e "...RETA" pela
 * miniatura de 48px era chute, e a ampliação já existia a um painel de
 * distância. É o MESMO componente de propósito — a foto que o operador vê ao
 * escolher é a que ele vê ao conferir a sacola.
 */
export function PdvCartItemImage({
  name,
  barcode,
  imageUrl,
  side = "left",
  frameClassName = FRAME_CLASS,
}: PdvCartItemImageProps) {
  const [open, setOpen] = useState(false);

  if (!imageUrl) {
    return (
      // Sem foto o quadro segue o tema: não há sobra para disfarçar, e o ícone
      // esmaecido sobre branco ficaria ilegível no balcão.
      <div className={`${frameClassName} bg-muted/30`}>
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
          className={`${frameClassName} ${PHOTO_BACKGROUND} cursor-zoom-in transition-colors hover:border-primary/60`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((aberto) => !aberto)}
        >
          {/* `absolute` para a foto NÃO entrar na conta da altura do card. Em
              fluxo normal, uma foto em pé (80x200) esticava a linha inteira do
              carrinho para caber inteira, e o item ficava três vezes mais alto
              que o vizinho — o oposto do quadro igual para todos. Assim a altura
              vem só do texto ao lado, e a foto se encaixa no que sobrou. */}
          <img
            loading="lazy"
            decoding="async"
            src={src}
            alt=""
            className="absolute inset-0 h-full w-full object-contain"
          />
        </button>
      </HoverCardTrigger>

      {/* O lado vem de quem monta: o carrinho abre para a ESQUERDA (é a coluna
          encostada na borda direita da tela) e a busca para a DIREITA.

          `collisionPadding`: o conteúdo mora num portal e o Radix o empurra
          para dentro da janela quando não cabe — na primeira linha da busca a
          foto grande subiria além do topo. A folga é para ela não encostar na
          borda depois de empurrada. */}
      <HoverCardContent
        side={side}
        align="center"
        collisionPadding={12}
        className="w-64 p-3"
        onPointerDownOutside={() => setOpen(false)}
      >
        <img
          src={src}
          alt={name}
          className={`h-56 w-full rounded-md border border-border/40 object-contain ${PHOTO_BACKGROUND}`}
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
