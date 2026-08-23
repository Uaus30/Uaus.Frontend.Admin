import { isDevEnvironment } from "../lib/environment";

/**
 * Altura da faixa, em pixels, espelhando o `h-8` da classe.
 *
 * Existe como constante porque o admin precisa somá-la para deslocar o sidebar,
 * que é `fixed` e ignora o fluxo do documento.
 */
export const DEV_ENVIRONMENT_BANNER_HEIGHT = 32;

/**
 * Faixa que identifica o ambiente de desenvolvimento.
 *
 * Admin e PDV de dev são visualmente idênticos aos de produção, e o custo de
 * confundir os dois não é simétrico: cadastrar em dev achando que é produção só
 * gera retrabalho, enquanto vender ou apagar em produção achando que é dev mexe
 * na loja. A faixa é permanente e ocupa espaço real no topo justamente para não
 * virar paisagem.
 *
 * Ela fica ABAIXO da faixa de conexão: uma queda de servidor é evento urgente e
 * transitório, e precisa do lugar de cima. Quem decide a ordem é o App de cada
 * app, pela posição no JSX.
 *
 * Em produção o componente não renderiza nada — ver `isDevEnvironment`.
 */
export function DevEnvironmentBanner() {
  if (!isDevEnvironment()) return null;

  return (
    <div
      data-slot="dev-environment-banner"
      role="status"
      className="z-[9999] flex h-8 shrink-0 items-center justify-center bg-[#00ffff] px-4 text-center text-xs font-bold tracking-wide text-black shadow-md sm:text-sm"
    >
      AMBIENTE DE DESENVOLVIMENTO
    </div>
  );
}
