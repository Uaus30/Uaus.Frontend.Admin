import * as React from "react";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";

export interface ImageHoverZoomProps {
  /**
   * URL pronta da imagem. Este pacote é folha do grafo e não conhece
   * `buildPublicImageUrl` — quem chama resolve o caminho público antes.
   *
   * A mesma URL serve à miniatura e à ampliação de propósito: o catálogo não
   * guarda duas resoluções, e pedir um segundo arquivo aqui traria 404 na
   * metade das fotos.
   */
  src: string;
  /**
   * Texto alternativo. Passe `""` quando o nome do produto já estiver escrito ao
   * lado da miniatura, como nas tabelas: repeti-lo no `alt` faz o leitor de tela
   * anunciar a mesma coisa duas vezes por linha.
   */
  alt: string;
  /** Classes da miniatura. Cada tela mantém a moldura que já tinha. */
  className?: string;
  /**
   * Para que lado a ampliação abre. O padrão do Radix é `bottom`, que é o certo
   * em tabela; em lista estreita encostada na borda direita, passe `left`.
   */
  side?: "top" | "right" | "bottom" | "left";
  /** Clique na miniatura, quando a tela tem o que fazer com ele. */
  onClick?: React.MouseEventHandler<HTMLImageElement>;
  /**
   * `draggable` do `<img>`. Só existe por causa da galeria reordenável do
   * cadastro de produto: imagem é arrastável por padrão no navegador, e o
   * arrasto nativo dela sequestrava o arrasto de reordenar do cartão em volta.
   */
  draggable?: boolean;
}

/**
 * Miniatura que mostra a foto ampliada quando o mouse passa por cima.
 *
 * Nasceu na listagem de produtos e virou componente em 12/09/2026, quando o
 * mesmo gesto passou a valer para compras, estoque baixo, etiquetas de gôndola,
 * galeria do cadastro e catálogo de imagens. O catálogo da loja tem muito nome
 * parecido — "REFRIG COLA 2L" em três marcas, a mesma embalagem em dois
 * volumes — e num quadrado de 40px a foto não distingue nada: ou se abre o
 * produto, ou se confere pelo código de barras. A ampliação responde ali mesmo,
 * sem tirar a pessoa da tela em que ela está.
 *
 * ## Por que `HoverCard`, e não um `title` ou um diálogo
 *
 * O `HoverCard` do Radix **não move o foco** ao abrir, então ele não atrapalha
 * quem está digitando num filtro ou percorrendo a tabela — e fecha sozinho
 * quando o mouse sai, sem clique de volta. Um diálogo faria a pessoa fechar o
 * que abriu; é caminho para inspecionar a foto de perto, não para bater o olho.
 * Onde os dois fazem sentido, as duas coisas convivem: na listagem de produtos
 * o hover amplia e o clique ainda abre a foto em tamanho maior.
 *
 * ## `object-contain`, não `object-cover`
 *
 * A miniatura pode cortar — ela só precisa preencher o quadradinho da coluna. A
 * ampliação, não: cortar é justamente perder a tampa do frasco e o volume
 * impresso no rótulo, que é o detalhe pelo qual se amplia. O fundo branco
 * acompanha: com `object-contain` sobra moldura quando a proporção da foto não
 * é a do quadro, e no tema escuro essa sobra virava duas faixas pretas em volta
 * de um catálogo inteiro fotografado em fundo branco.
 *
 * É melhoria de mouse, e nada se perde sem ela: a foto continua na miniatura e
 * o nome do produto, ao lado.
 */
export function ImageHoverZoom({ src, alt, className, side, onClick, draggable }: ImageHoverZoomProps) {
  return (
    // Sem atraso nenhum, dos dois lados: a ampliação acompanha o mouse enquanto
    // ele percorre a coluna de fotos, que é como se compara uma linha com a
    // vizinha. Com atraso de abertura, comparar duas viraria esperar duas vezes.
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger asChild>
        <img
          loading="lazy"
          decoding="async"
          src={src}
          alt={alt}
          draggable={draggable}
          onClick={onClick}
          className={className}
        />
      </HoverCardTrigger>
      {/* `collisionPadding`: o conteúdo mora num portal e o Radix o empurra para
          dentro da janela quando não cabe. A folga é para a foto não encostar na
          borda depois de empurrada — na primeira linha de uma tabela ela sobe
          até o topo da tela. */}
      <HoverCardContent
        side={side}
        collisionPadding={12}
        className="h-80 w-80 overflow-hidden rounded-xl border-border/50 bg-white p-0 shadow-2xl"
      >
        <img src={src} alt={alt} className="h-full w-full object-contain" />
      </HoverCardContent>
    </HoverCard>
  );
}
