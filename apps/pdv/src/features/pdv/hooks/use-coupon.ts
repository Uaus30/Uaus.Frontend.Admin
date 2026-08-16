import { useCallback, useState } from "react";
import { create } from "zustand";
import {
  ApiError,
  COUPON_DISCOUNT_TYPE,
  enumCode,
  lookupPdvCoupon,
} from "@workspace/api-client-react";
import { describeApiError } from "@workspace/core";
import { lookupLocalCoupon, type LocalCoupon } from "@/offline";
import { useOfflineStore } from "@/stores/use-offline-store";
import { usePdvStore, type AppliedCoupon, type CouponAnswer } from "@/stores/use-pdv-store";
import type { CouponQuestion, FoundCoupon } from "../types";

/**
 * Cupom de desconto no balcão: consultar, responder o questionário, aplicar e
 * tirar da venda.
 *
 * ## O que este hook NÃO faz
 *
 * **Não guarda o abatimento em reais.** O que vai para o store é a definição do
 * cupom — código, tipo e valor —, e o desconto é derivado do carrinho a cada
 * leitura (`couponDiscountFor`, em `stores/use-pdv-store.ts`). Guardar o valor
 * calculado deixaria o desconto estagnado: um cupom de 10% aplicado antes de o
 * operador bipar o último item abateria 10% do carrinho antigo, a tela mostraria
 * um número e o payload levaria outro.
 *
 * **Não reserva nada.** Nem a consulta online nem a offline travam um uso do
 * cupom. O gate real é o UPDATE condicional dentro da transação da venda, no
 * servidor — é o único ponto sem janela entre conferir e consumir. Dois caixas
 * podem ver "resta 1 uso" ao mesmo tempo, e os dois estão vendo a verdade.
 *
 * ## Como a recusa chega ao operador
 *
 * Cupom vencido, inativo ou esgotado não é erro de sistema: é acontecimento
 * normal de uma loja com panfleto em circulação. O servidor devolve 400 com a
 * frase pronta para o balcão ("Cupom expirado em 30/09/2026 às 23:59!") e sem
 * gravar log de erro. A tela exibe **essa** frase — trocá-la por um "falha ao
 * consultar" genérico obrigaria o operador a adivinhar o que dizer ao cliente.
 */

/**
 * Estado observável de "o diálogo do cupom está aberto".
 *
 * Mora num store, e não no `usePdvDialogs`, porque quem abre (o resumo da venda)
 * e quem renderiza (o bloco de diálogos) são componentes IRMÃOS: passar o
 * controle pela página obrigaria a atravessar duas fronteiras de props para um
 * booleano. Os demais diálogos do PDV nasceram antes desta feature e continuam
 * como estão.
 */
export const useCouponDialog = create<{
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Abre o diálogo — é o que o botão do carrinho e o atalho de teclado chamam. */
  show: () => void;
}>((set) => ({
  open: false,
  setOpen: (open) => set(() => ({ open })),
  show: () => set(() => ({ open: true })),
}));

/**
 * Restringe o tipo de desconto aos dois que existem de verdade.
 *
 * `None` (0) é o zero do `smallint` e nunca é um cupom válido; um código
 * desconhecido só pode vir de uma base local velha ou de um backend mais novo.
 * Nos dois casos o certo é recusar: seguir com um tipo que ninguém sabe
 * interpretar aplicaria "R$ 10" onde o panfleto prometia "10%".
 */
function toDiscountType(code: number): AppliedCoupon["discountType"] | null {
  if (code === COUPON_DISCOUNT_TYPE.Percentage) return COUPON_DISCOUNT_TYPE.Percentage;
  if (code === COUPON_DISCOUNT_TYPE.Amount) return COUPON_DISCOUNT_TYPE.Amount;
  return null;
}

/** Traduz o cupom da base local para o formato único da tela. */
function fromLocalCoupon(
  coupon: LocalCoupon,
  discountType: AppliedCoupon["discountType"],
  remainingUses: number | null,
  overLimit: boolean,
): FoundCoupon {
  return {
    couponId: coupon.couponId,
    code: coupon.code,
    description: coupon.description,
    discountType,
    discountValue: coupon.discountValue,
    remainingUses,
    overLimit,
    fromLocalDatabase: true,
    questions: coupon.questions,
  };
}

/** Perguntas obrigatórias que ainda estão sem resposta. */
function missingRequired(questions: CouponQuestion[], answers: CouponAnswer[]): CouponQuestion[] {
  return questions.filter(
    (question) =>
      question.isRequired && !answers.some((answer) => answer.questionId === question.questionId),
  );
}

/** Mensagem de recusa quando o tipo de desconto não é interpretável. */
const UNKNOWN_TYPE_MESSAGE =
  "Este cupom tem um tipo de desconto que este caixa não conhece. Atualize a base local!";

export function useCoupon() {
  const applied = usePdvStore((state) => state.coupon);
  const discount = usePdvStore((state) => state.getCouponDiscount());
  const applyCoupon = usePdvStore((state) => state.applyCoupon);
  const removeCoupon = usePdvStore((state) => state.removeCoupon);
  const online = useOfflineStore((state) => state.online);

  const [found, setFound] = useState<FoundCoupon | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  /** Consulta o cupom na base local. Nunca lança: recusa é resposta, não erro. */
  const lookupLocally = useCallback(async (code: string): Promise<FoundCoupon | null> => {
    const result = await lookupLocalCoupon(code);

    if (result.outcome === "refused") {
      setRefusal(result.message);
      return null;
    }

    const discountType = toDiscountType(result.coupon.discountType);
    if (discountType === null) {
      setRefusal(UNKNOWN_TYPE_MESSAGE);
      return null;
    }

    const coupon = fromLocalCoupon(
      result.coupon,
      discountType,
      result.remainingUses,
      result.overLimit,
    );
    setFound(coupon);
    return coupon;
  }, []);

  /**
   * Consulta o cupom pelo código digitado ou lido do panfleto.
   *
   * Com conexão vai ao servidor, que é quem sabe o saldo de usos AGORA. Sem
   * conexão — e também quando a rede cai no meio da consulta — cai para a base
   * local: o cliente está no balcão com o papel na mão, e a alternativa seria
   * recusar um cupom válido por causa da internet da loja. Já uma recusa que o
   * servidor **respondeu** é regra de negócio e vale como está; reconsultá-la na
   * base local só trocaria um "não" fundamentado por um "sim" desatualizado.
   *
   * @param code Código como o operador digitou ou o leitor enviou.
   * @returns O cupom encontrado, ou `null` quando houve recusa (a frase para o
   *   operador fica em `refusal`).
   */
  const lookup = useCallback(
    async (code: string): Promise<FoundCoupon | null> => {
      const normalized = code.trim().toUpperCase();
      setFound(null);
      setRefusal(null);

      if (!normalized) {
        setRefusal("Informe o código do cupom!");
        return null;
      }

      setSearching(true);
      try {
        if (!online) return await lookupLocally(normalized);

        try {
          const dto = await lookupPdvCoupon(normalized);
          const discountType = toDiscountType(enumCode(dto.discountType, COUPON_DISCOUNT_TYPE));

          if (discountType === null) {
            setRefusal(UNKNOWN_TYPE_MESSAGE);
            return null;
          }

          const coupon: FoundCoupon = {
            couponId: dto.couponId,
            code: dto.code,
            description: dto.description ?? null,
            discountType,
            discountValue: dto.discountValue,
            // `?? null` obrigatório: o backend OMITE campo nulo do JSON, e nulo
            // aqui significa ILIMITADO. Ler a ausência como zero esgotaria todo
            // cupom sem teto — que é a maioria deles.
            remainingUses: dto.remainingUses ?? null,
            overLimit: false,
            fromLocalDatabase: false,
            questions: dto.questions ?? [],
          };

          setFound(coupon);
          return coupon;
        } catch (error) {
          // O servidor respondeu recusando: é regra de negócio, com a frase já
          // escrita para o balcão.
          if (error instanceof ApiError) {
            setRefusal(describeApiError(error, "Não foi possível validar o cupom!"));
            return null;
          }

          // Qualquer outra falha é rede (fetch abortado, DNS, servidor fora).
          return await lookupLocally(normalized);
        }
      } catch {
        // Sobra a base local em pane (IndexedDB indisponível em janela anônima,
        // cota estourada). Sem esta rede de segurança a promessa rejeitaria sem
        // dono e o diálogo ficaria mudo, com o operador clicando de novo.
        setRefusal("Não foi possível consultar o cupom neste caixa!");
        return null;
      } finally {
        setSearching(false);
      }
    },
    [lookupLocally, online],
  );

  /**
   * Aplica na venda o cupom já consultado, com as respostas do questionário.
   *
   * @param answers Uma resposta por pergunta respondida.
   * @returns `false` quando falta responder alguma pergunta obrigatória — a
   *   frase para o operador fica em `refusal`. O servidor confere a mesma regra,
   *   mas só na gravação, com o cliente já esperando o comprovante.
   */
  const apply = useCallback(
    (answers: CouponAnswer[]): boolean => {
      if (!found) return false;

      const missing = missingRequired(found.questions, answers);
      if (missing.length > 0) {
        setRefusal(`Responda "${missing[0].label}" para aplicar o cupom!`);
        return false;
      }

      applyCoupon({
        couponId: found.couponId,
        code: found.code,
        description: found.description,
        discountType: found.discountType,
        discountValue: found.discountValue,
        answers,
      });

      setFound(null);
      setRefusal(null);
      return true;
    },
    [applyCoupon, found],
  );

  /** Descarta a consulta em andamento. O cupom já aplicado na venda não é tocado. */
  const reset = useCallback(() => {
    setFound(null);
    setRefusal(null);
  }, []);

  /** Tira o cupom da venda. O abatimento some sozinho — ele nunca foi guardado. */
  const remove = useCallback(() => {
    removeCoupon();
    reset();
  }, [removeCoupon, reset]);

  return {
    /** Cupom aplicado na venda, ou `null`. */
    applied,
    /** Abatimento em reais NESTE instante, derivado do carrinho corrente. */
    discount,
    /** Cupom consultado à espera das respostas, ou `null`. */
    found,
    /** Frase pronta para o operador ler ao cliente, ou `null`. */
    refusal,
    /** Uma consulta está em andamento. */
    searching,
    lookup,
    apply,
    reset,
    remove,
  };
}
