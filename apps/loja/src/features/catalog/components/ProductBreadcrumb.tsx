import { ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { catalogPath } from "@/routes";
import type { CatalogProductDetail } from "../types";

/**
 * Trilha "Departamento &gt; Categoria &gt; Produto" do detalhe.
 *
 * Os dois primeiros níveis são links para a vitrine já filtrada — é o caminho
 * de quem gostou do produto e quer ver o que mais tem parecido, que antes só
 * existia voltando à lista inteira. O último nível é TEXTO, não link: apontar
 * para a página em que o visitante já está é ruído para leitor de tela.
 *
 * No celular o nome do produto trunca em uma linha; departamento e categoria
 * ficam sempre visíveis, porque são eles que servem para navegar.
 */
export function ProductBreadcrumb({ product }: { product: CatalogProductDetail }) {
  return (
    <nav aria-label="Você está aqui">
      <ol className="flex items-center gap-1 text-sm text-muted-foreground">
        <li className="shrink-0">
          <Link
            href={catalogPath({ departmentId: product.departmentId })}
            className="rounded font-semibold transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:outline-none"
          >
            {product.departmentName}
          </Link>
        </li>

        <li aria-hidden className="shrink-0">
          <ChevronRight className="h-4 w-4" />
        </li>

        <li className="shrink-0">
          <Link
            href={catalogPath({
              departmentId: product.departmentId,
              categoryId: product.categoryId,
            })}
            className="rounded font-semibold transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:outline-none"
          >
            {product.categoryName}
          </Link>
        </li>

        <li aria-hidden className="shrink-0">
          <ChevronRight className="h-4 w-4" />
        </li>

        <li aria-current="page" className="line-clamp-1 text-foreground">
          {product.name}
        </li>
      </ol>
    </nav>
  );
}
