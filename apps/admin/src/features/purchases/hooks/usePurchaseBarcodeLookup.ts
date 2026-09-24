import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { resolveBarcodeInput } from "@workspace/core";
import { getProductsPage } from "@/services/products.service";
import { toProductSearchOption, type ProductSearchOption } from "@/components/product-search-option";

/**
 * Quanto se espera parar de digitar antes de consultar.
 *
 * O leitor não "bipa": ele DIGITA os treze dígitos em milissegundos. A espera é
 * o que faz o bipe virar uma consulta só, e não treze.
 */
const DEBOUNCE_MS = 400;

/** Quantas linhas trazer da busca — o filtro do backend é `Contains`, e a igualdade é conferida aqui. */
const LIMITE_BUSCA = 20;

/**
 * O código a procurar no catálogo a partir do que está no campo, ou `null`.
 *
 * A regra de conversão é a do cadastro de produto (`resolveBarcodeInput`, espelho
 * do `Ean13.FromTyped` do backend): 13 dígitos são o código da embalagem, e até
 * 11 viram o código interno com o número dentro. É por ela que "20" encontra o
 * produto de código `2000000000206`.
 *
 * `completo` separa as duas ocasiões de consultar. Durante a digitação só o EAN
 * inteiro dispara: um número curto é também o começo de um número maior, e
 * consultar "1" no meio de "123" vincularia a compra ao produto errado. O número
 * curto é consultado quando a pessoa ENCERRA o campo — Enter ou saída.
 */
function codigoParaProcurar(digitado: string, completo: boolean): string | null {
  const resolvido = resolveBarcodeInput(digitado);
  if (resolvido.kind === "factory") return resolvido.code;
  if (resolvido.kind === "internal" && !completo) return resolvido.code;
  return null;
}

type UsePurchaseBarcodeLookupParams = {
  /**
   * A compra pode receber um vínculo agora? Só com a modal aberta, editável e
   * SEM produto vinculado — é o caso em que o campo de código aparece.
   */
  enabled: boolean;
  /** Recebe o produto dono do código e o código procurado: é o vínculo automático. */
  onFound: (product: ProductSearchOption, code: string) => void;
};

/**
 * Reconhece, no campo "Código de barras" da compra, um código que já é de um
 * produto cadastrado (24/09/2026).
 *
 * Sem isto, a compra de um item já cadastrado registrada como "produto novo" só
 * dava errado lá na frente: o cadastro do recebimento recusaria o código repetido
 * — ou, sem código, nasceria o SEGUNDO cadastro do mesmo item, com o estoque
 * dividido entre os dois. Aqui o bipe troca o assunto na hora: quem recebe o
 * achado é o `selectProduct` do formulário, o mesmo caminho do campo "Produto já
 * cadastrado", com a mesma pergunta quando o vínculo substituiria nome digitado
 * ou foto anexada.
 *
 * É a versão da compra do `useBarcodeLookup` do cadastro de produto, que não se
 * importa daqui (import entre features é proibido) e faz outra coisa com o
 * achado: lá ele CARREGA o produto na tela.
 *
 * A consulta é conveniência, não garantia: o backend recusa gravar compra de
 * produto novo com código que já tem dono.
 */
export function usePurchaseBarcodeLookup({ enabled, onFound }: UsePurchaseBarcodeLookupParams) {
  const queryClient = useQueryClient();
  const [searching, setSearching] = useState(false);

  /**
   * Espelho do último render. O disparo é adiado, e quando ele acontece o
   * `enabled` e o `onFound` capturados no agendamento podem estar velhos — o
   * `onFound` inclusive, que decide pelo formulário como ele está AGORA.
   */
  const paramsRef = useRef({ enabled, onFound });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Cada tecla invalida a consulta em voo: a resposta velha não vincula nada. */
  const versaoRef = useRef(0);
  /** O último código consultado, para o Enter e a saída do campo não repetirem a consulta do bipe. */
  const ultimoRef = useRef<string | null>(null);

  // Sem lista de dependências: o espelho acompanha todo render. Quem o lê é o
  // temporizador, depois de os efeitos terem rodado.
  useEffect(() => {
    paramsRef.current = { enabled, onFound };
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function procurar(code: string, versao: number) {
    if (!paramsRef.current.enabled || ultimoRef.current === code) return;
    ultimoRef.current = code;

    setSearching(true);
    let achado;
    try {
      const pagina = await queryClient.fetchQuery({
        queryKey: ["product-by-barcode", code],
        queryFn: () => getProductsPage({ search: code, limit: LIMITE_BUSCA }),
        staleTime: 30_000,
      });
      // Duplicata é igualdade: o backend filtra por `Contains`.
      achado = pagina.data.find((produto) => produto.barcode === code) ?? null;
    } catch {
      // Falha de rede aqui não vira aviso para quem só está digitando.
      achado = null;
      ultimoRef.current = null;
    } finally {
      setSearching(false);
    }

    // Relido DEPOIS da viagem: nesse meio-tempo a pessoa pode ter mudado o
    // código, vinculado outro produto pela busca ou fechado a modal.
    if (!achado || versao !== versaoRef.current || !paramsRef.current.enabled) return;
    paramsRef.current.onFound(toProductSearchOption(achado), code);
  }

  /** A cada tecla do campo: consulta depois da pausa, e só o EAN inteiro. */
  function onBarcodeChange(digitado: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    versaoRef.current += 1;
    ultimoRef.current = null;

    const code = codigoParaProcurar(digitado, true);
    if (!code) return;

    const versao = versaoRef.current;
    timerRef.current = setTimeout(() => void procurar(code, versao), DEBOUNCE_MS);
  }

  /**
   * O campo foi ENCERRADO — Enter (o fim do bipe) ou saída do campo: consulta
   * na hora, inclusive o número curto do código interno.
   */
  function onBarcodeCommit(digitado: string) {
    if (timerRef.current) clearTimeout(timerRef.current);

    const code = codigoParaProcurar(digitado, false);
    if (!code) return;

    void procurar(code, versaoRef.current);
  }

  return { onBarcodeChange, onBarcodeCommit, searchingBarcode: searching };
}
