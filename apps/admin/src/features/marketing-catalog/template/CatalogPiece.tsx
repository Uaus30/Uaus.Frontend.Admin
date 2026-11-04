import type { PieceData } from "../types";
import { chunkRows, pieceGrid, type PieceSpec } from "./geometry";
import { PieceFrame } from "./PieceFrame";
import { ProductCard } from "./ProductCard";

/**
 * O molde das três peças: o banner 9:16, o banner 4:5 e a página do catálogo
 * em PDF. O que muda entre elas são as medidas (`PieceSpec`), não o desenho.
 *
 * A moldura (arte, título, painel e rodapé) é a de `PieceFrame`, a mesma do
 * banner de destaque; aqui fica a grade de cards dentro do painel.
 *
 * Desenhado pelo satori (ver `ProductCard.tsx`): flexbox, estilo inline, e
 * posição absoluta para as camadas.
 */
export function CatalogPiece({
  spec,
  title,
  caption,
  cards,
  store,
  date,
  art,
}: PieceData & { spec: PieceSpec }) {
  const visible = cards.slice(0, spec.maxProducts);
  const grid = pieceGrid(spec, visible.length);
  const rows = chunkRows(visible, grid.columns);

  return (
    <PieceFrame
      spec={spec}
      title={title}
      caption={caption}
      store={store}
      date={date}
      art={art}
      panelStyle={{
        flexDirection: "column",
        // Com linhas fixas (a página do PDF) a grade encosta em cima: a última
        // página, com menos produtos, não fica com os cards boiando no meio.
        justifyContent: spec.rows ? "flex-start" : "center",
        gap: spec.gap,
        padding: `${spec.panelPaddingY}px ${spec.panelPaddingX}px`,
      }}
    >
      {rows.map((row) => (
        <div
          key={row[0].productGroupId}
          style={{ display: "flex", justifyContent: spec.rows ? "flex-start" : "center", gap: spec.gap }}
        >
          {row.map((card) => (
            <ProductCard key={card.productGroupId} card={card} grid={grid} softShadow={spec.softShadows} />
          ))}
        </div>
      ))}
    </PieceFrame>
  );
}
