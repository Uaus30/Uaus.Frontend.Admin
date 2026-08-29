import { Tag } from "lucide-react";
import type { CatalogTag } from "../types";

/**
 * Selos coloridos sobre a imagem do card — o sucessor do "Super Oferta" do
 * site antigo, que era um boolean fixo. Aqui cada etiqueta PÚBLICA do produto
 * (Tag.IsPublic, marcada no admin como "Exibir no site") vira um selo com a
 * cor cadastrada: o admin controla o texto e a cor sem deploy.
 */
export function TagRibbons({ tags }: { tags: CatalogTag[] }) {
  if (tags.length === 0) return null;

  return (
    <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag.name}
          style={{ backgroundColor: tag.color }}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md"
        >
          <Tag className="h-3 w-3" />
          {tag.name}
        </span>
      ))}
    </div>
  );
}
