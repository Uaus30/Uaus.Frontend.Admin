import { CATALOG_THEME, enumCode, type CatalogThemeDto, type EnumValue } from "@workspace/api-client-react";

/** Uma opção do seletor de tema: o que a tela mostra e o que vai ao sorteio. */
export interface CatalogThemeOption {
  /** Identificador do `<Select>`: o tema, mais o departamento quando houver. */
  key: string;
  /** Código de `CATALOG_THEME`. */
  theme: number;
  departmentId?: number;
  /** Como o tema aparece no seletor. */
  label: string;
  /** O título sugerido para o cabeçalho da peça — a pessoa pode trocar. */
  title: string;
  /** Quantos cadastros o tema tem para sortear. */
  products: number;
  /** Desses, quantos têm foto que aguenta o card grande do catálogo em PDF. */
  productsWithLargePhoto: number;
}

/**
 * Rótulo e título dos temas fixos. Texto de tela mora no front; da API só vem
 * nome de departamento, que é dado de cadastro.
 *
 * "Achados" é o nome que o dono deu à pouca saída (03/10/2026): o cliente não
 * pode ler nada que soe a encalhe.
 */
const FIXED_THEMES: Record<number, { label: string; title: string }> = {
  // "Promoções e Novidades" desde 05/10/2026, a pedido do dono — é o título que
  // ele já vinha digitando à mão nas peças do sorteio inteligente.
  [CATALOG_THEME.General]: { label: "Geral (mistura inteligente)", title: "Promoções e Novidades" },
  [CATALOG_THEME.NewsAndOffers]: { label: "Novidades e promoções", title: "Novidades e promoções" },
  [CATALOG_THEME.BestSellers]: { label: "Mais vendidos", title: "Os mais vendidos" },
  [CATALOG_THEME.Finds]: { label: "Achados", title: "Achados" },
};

/** O tema que a tela abre selecionado. */
export const DEFAULT_THEME_KEY = String(CATALOG_THEME.General);

/**
 * As opções do seletor, na ordem em que a API manda: os temas fixos e depois os
 * departamentos, em ordem alfabética. Tema que esta versão da tela não conhece
 * fica de fora em vez de aparecer sem nome.
 */
export function buildThemeOptions(themes: readonly CatalogThemeDto[]): CatalogThemeOption[] {
  return themes.flatMap((item): CatalogThemeOption[] => {
    const theme = enumCode(item.theme, CATALOG_THEME);

    if (theme === CATALOG_THEME.Department) {
      if (item.departmentId == null || !item.departmentName) return [];
      return [
        {
          key: `${theme}:${item.departmentId}`,
          theme,
          departmentId: item.departmentId,
          label: item.departmentName,
          title: item.departmentName,
          products: item.products,
          productsWithLargePhoto: item.productsWithLargePhoto,
        },
      ];
    }

    const fixed = FIXED_THEMES[theme];
    return fixed
      ? [
          {
            key: String(theme),
            theme,
            ...fixed,
            products: item.products,
            productsWithLargePhoto: item.productsWithLargePhoto,
          },
        ]
      : [];
  });
}

/** O nome do tema de uma peça do histórico. No tema de departamento, o do departamento. */
export function themeLabel(theme: EnumValue, departmentName?: string | null): string {
  const code = enumCode(theme, CATALOG_THEME);
  if (code === CATALOG_THEME.Department) return departmentName || "Departamento";
  if (code === CATALOG_THEME.General) return "Geral";
  return FIXED_THEMES[code]?.label ?? "Tema";
}

/** "1 produto", "12 produtos" — a contagem ao lado de cada tema. */
export function describeProductCount(products: number): string {
  return products === 1 ? "1 produto" : `${products} produtos`;
}
