import { useCallback, useRef, useState } from "react";
import { getCatalogSpotlight, type CatalogSpotlightDto } from "@workspace/api-client-react";
import { buildSpotlight } from "../lib/buildSpotlight";
import { browserStorage } from "../lib/customSelection";
import { CATALOG_FORMATS, SPOTLIGHT_FORMAT_ORDER } from "../lib/formats";
import { newPieceKey } from "../lib/pieceRecord";
import { pieceFileName } from "../lib/share";
import {
  kindStates,
  noveltyHint,
  promotionNotes,
  smallPhotoHint,
  SPOTLIGHT_KINDS,
  spotlightBlocker,
  suggestedKind,
  toSpotlightProduct,
} from "../lib/spotlight";
import { SPOTLIGHT_THEME } from "../lib/themes";
import { normalizeTitle } from "../template/text";
import type { SpotlightFormat, SpotlightKind } from "../types";
import { usePieceSession } from "./usePieceSession";

/** O produto do banner, como a tela o conhece antes de consultar o servidor. */
export interface SpotlightTarget {
  productGroupId: number;
  name: string;
}

const FORMATS = SPOTLIGHT_FORMAT_ORDER.map((key) => CATALOG_FORMATS[key]);

/** O último tamanho usado fica no aparelho: é o celular de quem divulga. */
export const SPOTLIGHT_FORMAT_KEY = "uaus:catalogo-destaque:formato";

function loadFormat(): SpotlightFormat {
  try {
    return browserStorage()?.getItem(SPOTLIGHT_FORMAT_KEY) === "feed" ? "feed" : "story";
  } catch {
    return "story";
  }
}

function saveFormat(format: SpotlightFormat): void {
  try {
    browserStorage()?.setItem(SPOTLIGHT_FORMAT_KEY, format);
  } catch {
    // Sem armazenamento, o tamanho vale enquanto a tela estiver aberta.
  }
}

/** Tudo o que decide o banner, passado de uma vez: o estado do React só muda no próximo render. */
interface SpotlightInput {
  target: SpotlightTarget;
  kind: SpotlightKind;
  format: SpotlightFormat;
  title: string;
  printedName: string;
}

/**
 * O banner de destaque (04/11/2026): UM produto por imagem, como promoção,
 * novidade ou reposição, nos dois tamanhos de banner. É o mesmo hook na janela
 * do menu da listagem de produtos e na aba Destaque do catálogo.
 *
 * - **O preço é o de agora**: cada geração pede o produto de novo ao servidor
 *   (`GET /Catalogs/spotlight/{grupo}`), que diz também se ele pode entrar.
 * - **Só o promocional trava**, e só sem promoção: o selo mentiria sobre o preço.
 * - **Trocar o tipo troca o título** para o sugerido dele: o texto digitado era
 *   do outro tipo, como no tema do catálogo.
 * - A peça que sai vai para o histórico com o tema Destaque (pelo ciclo comum,
 *   `usePieceSession`), e não segura ninguém no descanso do sorteio.
 */
export function useSpotlightBanner() {
  const session = usePieceSession();
  const { run, clear } = session;

  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<SpotlightTarget | null>(null);
  const [kind, setKindState] = useState<SpotlightKind>("new");
  const [format, setFormatState] = useState<SpotlightFormat>(loadFormat);
  const [title, setTitle] = useState(SPOTLIGHT_KINDS.new.title);
  const [printedName, setPrintedName] = useState("");
  const [info, setInfo] = useState<CatalogSpotlightDto | null>(null);

  // O tamanho da foto do último arquivo gerado, pela chave dele: o aviso da foto
  // pequena vale só para a peça que está na moldura.
  const [lastPhoto, setLastPhoto] = useState<{ key: string; width: number; height: number } | null>(null);
  // A consulta da aba Destaque ao escolher um produto: a resposta atrasada de
  // um produto anterior não pode sugerir o tipo do atual.
  const lookupRef = useRef(0);

  const generateWith = useCallback(
    async (input: SpotlightInput) => {
      const option = CATALOG_FORMATS[input.format];

      await run(option.noun, async () => {
        // Sem cache de propósito: o preço vai IMPRESSO e tem de ser o de agora.
        const spotlight = await getCatalogSpotlight(input.target.productGroupId);
        setInfo(spotlight);

        const blocker = spotlightBlocker(spotlight, input.kind);
        if (blocker) throw new Error(blocker);

        const product = toSpotlightProduct(spotlight.card!, input.kind, input.printedName);
        if (!product) throw new Error(`${spotlight.name} não tem foto para o banner.`);

        const date = new Date();
        const printedTitle = normalizeTitle(input.title) || SPOTLIGHT_KINDS[input.kind].title;
        const result = await buildSpotlight({
          format: input.format,
          kind: input.kind,
          title: printedTitle,
          product,
          notes: promotionNotes(spotlight.card!, input.kind, date),
          date,
        });

        const key = newPieceKey();
        setLastPhoto({ key, ...result.photo });
        return {
          key,
          file: new File(
            [result.blob],
            pieceFileName(`${printedTitle} ${product.name}`, date, option.extension),
            {
              type: option.mimeType,
            },
          ),
          pages: [result.blob],
          products: [product],
          title: printedTitle,
          theme: SPOTLIGHT_THEME,
          format: option,
        };
      });
    },
    [run],
  );

  /** O menu da listagem: abre a janela e já gera, no tipo escolhido e no último tamanho. */
  const openFor = useCallback(
    (next: SpotlightTarget, nextKind: SpotlightKind) => {
      const nextTitle = SPOTLIGHT_KINDS[nextKind].title;
      lookupRef.current += 1;
      clear();
      setTarget(next);
      setKindState(nextKind);
      setTitle(nextTitle);
      setPrintedName("");
      setInfo(null);
      setOpen(true);
      void generateWith({ target: next, kind: nextKind, format, title: nextTitle, printedName: "" });
    },
    [clear, format, generateWith],
  );

  /**
   * A aba Destaque: escolhe o produto e consulta o servidor para sugerir o
   * tipo. Não gera — a pessoa ainda pode mudar tipo, título e nome.
   */
  const select = useCallback(
    (next: SpotlightTarget) => {
      const lookup = ++lookupRef.current;
      clear();
      setTarget(next);
      setPrintedName("");
      setInfo(null);

      getCatalogSpotlight(next.productGroupId)
        .then((spotlight) => {
          if (lookup !== lookupRef.current) return;
          const suggested = suggestedKind(spotlight);
          setInfo(spotlight);
          setKindState(suggested);
          setTitle(SPOTLIGHT_KINDS[suggested].title);
        })
        .catch((error: unknown) => {
          // A geração consulta de novo e mostra o erro; aqui só faltaria a sugestão.
          console.warn("Catálogo: não foi possível consultar o produto do banner de destaque.", error);
        });
    },
    [clear],
  );

  const setKind = useCallback((next: SpotlightKind) => {
    setKindState(next);
    setTitle(SPOTLIGHT_KINDS[next].title);
  }, []);

  const setFormat = useCallback((next: SpotlightFormat) => {
    setFormatState(next);
    saveFormat(next);
  }, []);

  const generate = useCallback(() => {
    if (!target) return Promise.resolve();
    return generateWith({ target, kind, format, title, printedName });
  }, [format, generateWith, kind, printedName, target, title]);

  const piece = session.piece;
  const hints = [
    noveltyHint(info, kind),
    smallPhotoHint(piece && lastPhoto?.key === piece.key ? lastPhoto : undefined),
  ].filter((hint): hint is string => hint !== null);

  return {
    open,
    setOpen,
    target,
    openFor,
    select,
    /** O que o servidor disse do produto na última consulta. */
    info,
    kinds: kindStates(info),
    kind,
    setKind,
    formats: FORMATS,
    format: CATALOG_FORMATS[format],
    setFormat,
    title,
    setTitle,
    /** O título que sai se o campo ficar vazio. */
    titlePlaceholder: SPOTLIGHT_KINDS[kind].title,
    printedName,
    setPrintedName,
    /** Avisos que não travam: novidade fora da janela e foto pequena. */
    hints,
    generate,
    status: session.status,
    piece,
    progress: session.progress,
    busyNoun: session.busyNoun,
    errorMessage: session.errorMessage,
    isGenerating: session.isGenerating,
    canShare: session.canShare,
    share: session.share,
    download: session.download,
  };
}

/** O estado do banner de destaque, para os componentes que só desenham. */
export type SpotlightBannerState = ReturnType<typeof useSpotlightBanner>;
