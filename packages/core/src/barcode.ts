/**
 * Código de barras do produto: dígito verificador, validação do que o operador
 * digita e a simbologia com que as barras são desenhadas.
 *
 * Desde 21/09/2026 o catálogo é padronizado em EAN-13 — todo produto é gravado
 * com 13 dígitos cujo verificador fecha. O código que vem da embalagem é
 * preservado; o que não for EAN-13 legítimo ganha um código da faixa interna,
 * reservada pela GS1 ao uso do comerciante e por isso livre de colidir com
 * código de fabricante.
 *
 * **Este módulo é espelho de `Uaus.Domain/Common/Helpers/Ean13.cs`**, no
 * backend. Os dois precisam concordar sobre o que é aceito e sobre o dígito que
 * sai: divergir não gera erro em lugar nenhum — a prévia da tela mostra um
 * código, a API grava outro, e quem descobre é o caixa que bipa a etiqueta e não
 * acha o produto. As mensagens de recusa também são as mesmas, para a pessoa ler
 * o mesmo texto vindo da tela ou vindo da API.
 *
 * Mora no `core`, e não em `features/products`, porque três telas precisam da
 * mesma regra — cadastro, etiqueta de 80mm e etiqueta de gôndola — e import
 * atravessando feature é justamente o que o CLAUDE.md proíbe.
 */

/** Comprimento do código completo, com o verificador. */
export const EAN13_LENGTH = 13;

/** Comprimento do corpo — o código sem o verificador. */
export const EAN13_BODY_LENGTH = 12;

/** Maior número que cabe no miolo de um código interno (prefixo `2` + 11 dígitos). */
export const MAX_PARTIAL_LENGTH = EAN13_BODY_LENGTH - 1;

/** Formatos que a prévia desenha e a etiqueta imprime; CODE128 é o coringa. */
export type BarcodeFormat = "EAN13" | "EAN8" | "CODE128";

/** O texto tem ao menos um caractere e é só dígito? */
export function isAllDigits(value: string): boolean {
  return value.length > 0 && /^\d+$/.test(value);
}

/**
 * Dígito verificador de um corpo de EAN — 12 dígitos no EAN-13, 7 no EAN-8.
 *
 * Pesos alternados 3 e 1 a partir da DIREITA, como manda a GS1 (é o que põe o
 * peso 3 na segunda posição do EAN-13 e na primeira do EAN-8). Errar o peso não
 * gera erro em lugar nenhum: a etiqueta imprime, o leitor do caixa recusa, e a
 * venda para com o produto na mão do cliente.
 */
function calculateCheckDigit(body: string): number {
  const sum = body
    .split("")
    .reverse()
    .reduce((acc, digit, index) => acc + parseInt(digit, 10) * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10;
}

/** Dígito verificador do EAN-13, calculado sobre os 12 primeiros dígitos. */
export function calculateEan13CheckDigit(code: string): number {
  return calculateCheckDigit(code.slice(0, EAN13_BODY_LENGTH));
}

/**
 * É um EAN-13 completo e íntegro: 13 dígitos com o verificador fechando.
 *
 * É o único teste que autoriza gravar o código como o operador digitou.
 */
export function hasValidEan13CheckDigit(code: string): boolean {
  if (code.length !== EAN13_LENGTH || !isAllDigits(code)) return false;
  return calculateEan13CheckDigit(code) === parseInt(code.slice(-1), 10);
}

/**
 * O verificador fecha, seja EAN-8 ou EAN-13?
 *
 * Só serve para escolher a simbologia de desenho em {@link resolveBarcodeFormat}
 * — o cadastro não aceita mais EAN-8, mas lotes de etiqueta gravados antes de
 * 21/09/2026 têm códigos congelados que ainda precisam ser reimpressos.
 */
function hasValidEanCheckDigit(code: string): boolean {
  if (!/^\d{8}$|^\d{13}$/.test(code)) return false;
  return calculateCheckDigit(code.slice(0, -1)) === parseInt(code.slice(-1), 10);
}

/**
 * Código interno a partir do número que o operador digitou.
 *
 * `2` + zeros + número + verificador, de modo que quem digitou `0020` ainda
 * reconhece o `20` dentro de `2000000000206`.
 *
 * Números que só diferem em zero à esquerda produzem o MESMO código (`20` e
 * `0020`). Não é defeito, é consequência de preservar o número no miolo: quem
 * barra a segunda gravação é a checagem de duplicidade da API.
 */
export function buildInternalBarcode(digits: string): string {
  if (!isAllDigits(digits) || digits.length > MAX_PARTIAL_LENGTH) {
    throw new Error(`O miolo do código interno aceita de 1 a ${MAX_PARTIAL_LENGTH} dígitos.`);
  }

  const body = "2" + digits.padStart(MAX_PARTIAL_LENGTH, "0");
  return body + calculateCheckDigit(body);
}

/** O que a tela faz com o que está digitado no campo. */
export type BarcodeInputResolution =
  /** Campo vazio: o código só existe depois de salvar, porque vem da sequence do banco. */
  | { kind: "generated"; code: null; error: null }
  /** Código da embalagem, gravado como veio. */
  | { kind: "factory"; code: string; error: null }
  /** Número curto que virou código interno. */
  | { kind: "internal"; code: string; error: null }
  /** Não é uma entrada válida; `error` é o texto que a tela mostra. */
  | { kind: "invalid"; code: null; error: string };

/**
 * O que vai ser gravado a partir do que está no campo — ou a razão da recusa.
 *
 * Espelha `Ean13.FromTyped` do backend, incluindo as mensagens. A tela usa isto
 * para mostrar na prévia **o código que será gravado**, e não o rascunho do que
 * a pessoa está digitando: até 21/09/2026 a prévia desenhava o texto cru, e por
 * isso mostrava um número que o cadastro não guardaria.
 */
export function resolveBarcodeInput(typed: string): BarcodeInputResolution {
  const trimmed = typed.trim();

  if (trimmed.length === 0) return { kind: "generated", code: null, error: null };

  if (!isAllDigits(trimmed)) {
    return {
      kind: "invalid",
      code: null,
      error: "O código de barras aceita apenas números. Deixe o campo vazio para a loja gerar um código.",
    };
  }

  if (trimmed.length === EAN13_LENGTH) {
    if (!hasValidEan13CheckDigit(trimmed)) {
      return {
        kind: "invalid",
        code: null,
        error: `O código '${trimmed}' não é um EAN-13 válido: o último dígito deveria ser ${calculateEan13CheckDigit(trimmed)}. Confira o número impresso na embalagem.`,
      };
    }

    return { kind: "factory", code: trimmed, error: null };
  }

  if (trimmed.length === EAN13_BODY_LENGTH) {
    return {
      kind: "invalid",
      code: null,
      error:
        `O código '${trimmed}' tem ${EAN13_BODY_LENGTH} dígitos — confira se falta um dígito do código da embalagem. ` +
        `O cadastro aceita os ${EAN13_LENGTH} dígitos completos, até ${MAX_PARTIAL_LENGTH} dígitos para gerar um código interno, ou o campo vazio.`,
    };
  }

  if (trimmed.length > EAN13_LENGTH) {
    return {
      kind: "invalid",
      code: null,
      error: `O código '${trimmed}' tem ${trimmed.length} dígitos e não cabe no padrão EAN-13, que tem ${EAN13_LENGTH}.`,
    };
  }

  return { kind: "internal", code: buildInternalBarcode(trimmed), error: null };
}

/**
 * Simbologia com que o código vai ser desenhado.
 *
 * EAN fiel quando o verificador fecha; **CODE128 em todo o resto**, que aceita
 * qualquer texto. Sem esse desvio a jsbarcode lança para EAN com verificador
 * errado, e o que sobra na tela é a moldura branca vazia do `<svg>` (300x150, o
 * tamanho padrão de SVG sem conteúdo) — foi assim que a prévia do produto
 * apareceu em branco em 07/09/2026.
 *
 * Depois da padronização de 21/09/2026 todo produto do catálogo é EAN-13 válido,
 * e o coringa deixou de valer para o cadastro. Ele continua aqui porque
 * `product_label_batch_items` **congela** o código impresso: reimprimir um lote
 * de antes da padronização ainda desenha os códigos velhos, alguns com
 * verificador torto.
 */
export function resolveBarcodeFormat(code: string): BarcodeFormat {
  if (code.length === EAN13_LENGTH && hasValidEanCheckDigit(code)) return "EAN13";
  if (code.length === 8 && hasValidEanCheckDigit(code)) return "EAN8";
  return "CODE128";
}
