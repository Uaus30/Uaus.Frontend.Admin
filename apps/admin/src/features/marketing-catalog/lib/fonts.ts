import montserrat500 from "@fontsource/montserrat/files/montserrat-latin-500-normal.woff?url";
import montserrat600 from "@fontsource/montserrat/files/montserrat-latin-600-normal.woff?url";
import montserrat700 from "@fontsource/montserrat/files/montserrat-latin-700-normal.woff?url";
import montserrat800 from "@fontsource/montserrat/files/montserrat-latin-800-normal.woff?url";
import montserrat900 from "@fontsource/montserrat/files/montserrat-latin-900-normal.woff?url";
import { CATALOG_FONT_FAMILY } from "../template/palette";

/** Uma fonte entregue ao satori. Ele lê TTF, OTF e WOFF — WOFF2 não. */
export interface RenderFont {
  name: string;
  data: ArrayBuffer;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal";
}

/**
 * A Montserrat do molde, nos cinco pesos que ele usa.
 *
 * WOFF, e não WOFF2, porque é o que o satori lê. O recorte `latin` cobre o
 * português inteiro (acentos e cedilha) com ~20 KB por peso.
 */
const FONT_FILES: ReadonlyArray<{ weight: RenderFont["weight"]; url: string }> = [
  { weight: 500, url: montserrat500 },
  { weight: 600, url: montserrat600 },
  { weight: 700, url: montserrat700 },
  { weight: 800, url: montserrat800 },
  { weight: 900, url: montserrat900 },
];

let cached: Promise<RenderFont[]> | null = null;

async function download(): Promise<RenderFont[]> {
  return Promise.all(
    FONT_FILES.map(async ({ weight, url }) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Fonte do catálogo indisponível (${response.status}).`);
      return {
        name: CATALOG_FONT_FAMILY,
        weight,
        style: "normal" as const,
        data: await response.arrayBuffer(),
      };
    }),
  );
}

/** As fontes do molde, baixadas uma vez por sessão. */
export function loadCatalogFonts(): Promise<RenderFont[]> {
  cached ??= download().catch((error: unknown) => {
    cached = null;
    throw error;
  });
  return cached;
}
