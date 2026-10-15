import { useCallback, useEffect, useState } from "react";
import { CATALOG_UNAVAILABLE_REASON, enumCode, getCatalogSelection } from "@workspace/api-client-react";
import type { CatalogSearchItemDto } from "@workspace/api-client-react";
import {
  browserStorage,
  describeUnavailable,
  loadStoredCustom,
  moveItem,
  saveStoredCustom,
  toCustomProducts,
  type CustomItem,
  type UnavailableCode,
} from "../lib/customSelection";
import { CATALOG_FORMATS, CUSTOM_FORMAT_ORDER, formatCapacity } from "../lib/formats";
import { CUSTOM_THEME } from "../lib/themes";
import { normalizeTitle } from "../template/text";
import type { CatalogFormat } from "../types";
import { usePieceSession } from "./usePieceSession";

const FORMATS = CUSTOM_FORMAT_ORDER.map((key) => CATALOG_FORMATS[key]);

/**
 * O que impede gerar, dito para a pessoa. `null` = pode gerar.
 *
 * Trocar do 9:16 para o 4:5 com oito escolhidos não apaga ninguém: quem decide
 * quem sai é a pessoa, e o botão diz quantos tirar.
 */
export function customBlocker(
  count: number,
  capacity: number,
  formatLabel: string,
  title: string,
): string | null {
  if (count === 0) return "Adicione ao menos um produto.";
  if (count > capacity) {
    const extra = count - capacity;
    return `O ${formatLabel} leva até ${capacity} produtos: tire ${extra} da lista.`;
  }
  if (!normalizeTitle(title)) return "Escreva o título do banner.";
  return null;
}

/**
 * Estado e ações da aba Personalizado (15/10/2026): a pessoa escolhe os produtos
 * um a um, na ordem do desenho, e pode reescrever o nome que sai em cada card —
 * como na etiqueta de gôndola.
 *
 * - **Só banner** (9:16 e 4:5): o PDF fica no automático.
 * - **O critério de entrada é o do sorteio** (site, saldo e foto), e quem confere
 *   é o servidor, duas vezes: na busca e na hora de gerar.
 * - **O preço é o de agora**: a geração pede o card de novo
 *   (`POST /Catalogs/selection`), nunca usa o da busca.
 * - **A lista fica no aparelho** e sobrevive ao recarregar; a peça que sai vai
 *   para o histórico como as do sorteio, com o tema Personalizado — e não segura
 *   ninguém no descanso do sorteio (regra do servidor).
 */
export function useCustomCatalog() {
  const session = usePieceSession();
  const { run, draw } = session;

  const [stored] = useState(() => loadStoredCustom(browserStorage()));
  const [formatKey, setFormatKey] = useState<CatalogFormat>(stored?.format ?? "story");
  const [title, setTitle] = useState(stored?.title ?? "");
  const [items, setItems] = useState<CustomItem[]>(stored?.items ?? []);
  // Quem o servidor recusou na última geração, com o motivo. Sai quando a pessoa
  // tira o produto da lista, ou na geração seguinte.
  const [unavailable, setUnavailable] = useState<Record<number, UnavailableCode>>({});

  const format = CATALOG_FORMATS[formatKey];
  const capacity = formatCapacity(format);

  useEffect(() => {
    saveStoredCustom(browserStorage(), { format: formatKey, title, items });
  }, [formatKey, title, items]);

  /**
   * Põe o resultado da busca no fim da lista. Recusa quem não pode entrar, quem
   * já está nela e a lista cheia — a tela já desabilita o "+"; isto é a rede de
   * segurança. Devolve se entrou.
   */
  const add = useCallback(
    (result: CatalogSearchItemDto): boolean => {
      if (enumCode(result.unavailable, CATALOG_UNAVAILABLE_REASON) !== CATALOG_UNAVAILABLE_REASON.None) {
        return false;
      }
      if (items.length >= capacity) return false;
      if (items.some((item) => item.productGroupId === result.productGroupId)) return false;

      setItems([
        ...items,
        {
          productGroupId: result.productGroupId,
          catalogName: result.name,
          printedName: "",
          imageUrl: result.imageUrl ?? undefined,
        },
      ]);
      return true;
    },
    [capacity, items],
  );

  const remove = useCallback(
    (index: number) => {
      const leaving = items[index];
      if (!leaving) return;

      setItems(items.filter((_, position) => position !== index));
      setUnavailable(({ [leaving.productGroupId]: _gone, ...rest }) => rest);
    },
    [items],
  );

  const move = useCallback((index: number, delta: -1 | 1) => {
    setItems((current) => moveItem(current, index, delta));
  }, []);

  const rename = useCallback((index: number, printedName: string) => {
    setItems((current) =>
      current.map((item, position) => (position === index ? { ...item, printedName } : item)),
    );
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setUnavailable({});
  }, []);

  const blocker = customBlocker(items.length, capacity, format.label, title);

  /**
   * Gera o banner com a lista, na ordem dela. Sem reservas: se alguém não pode
   * mais entrar, ou se uma foto não carrega, o banner NÃO sai com um a menos —
   * a tela diz quem e por quê, e a lista fica.
   */
  const generate = useCallback(async () => {
    if (customBlocker(items.length, capacity, format.label, title) !== null) return;

    const target = { theme: CUSTOM_THEME, format };
    await run(format.noun, async (report) => {
      // Sem cache de propósito: o preço vai IMPRESSO na peça e tem de ser o de agora.
      const response = await getCatalogSelection(items.map((item) => item.productGroupId));
      const { products, unavailable: refused } = toCustomProducts(response, items);
      setUnavailable(refused);

      const refusedCount = Object.keys(refused).length;
      if (refusedCount > 0) {
        throw new Error(
          `${refusedCount === 1 ? "Um produto não pode" : `${refusedCount} produtos não podem`} entrar no banner: ` +
            `${describeUnavailable(refused, items)}. Tire da lista para gerar.`,
        );
      }

      const result = await draw(target, title, products, [], report);

      if (result.products.length < products.length) {
        const loaded = new Set(result.products.map((product) => product.productGroupId));
        const broken = products.filter((product) => !loaded.has(product.productGroupId));
        throw new Error(
          broken.length === 1
            ? `A foto de ${broken[0].name} não carregou. Tente de novo ou tire o produto da lista.`
            : `As fotos de ${broken.length} produtos não carregaram (${broken.map((p) => p.name).join(", ")}). ` +
                "Tente de novo ou tire esses produtos da lista.",
        );
      }

      return result;
    });
  }, [capacity, draw, format, items, run, title]);

  return {
    formats: FORMATS,
    format,
    selectFormat: setFormatKey,
    /** Quantos produtos o formato comporta: 9 no 9:16, 6 no 4:5. */
    capacity,
    title,
    setTitle,
    items,
    /** Quem não pode entrar, pela última geração. */
    unavailable,
    add,
    remove,
    move,
    rename,
    clear,
    /** O que impede gerar, em texto. `null` = pode. */
    blocker,
    generate,
    status: session.status,
    piece: session.piece,
    progress: session.progress,
    busyNoun: session.busyNoun,
    errorMessage: session.errorMessage,
    isGenerating: session.isGenerating,
    canShare: session.canShare,
    share: session.share,
    download: session.download,
  };
}
