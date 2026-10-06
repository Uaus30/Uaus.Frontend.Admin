/**
 * O corpo que rola das modais de venda (a nova e a correção).
 *
 * O `relative` não é enfeite. O Select do Radix deixa um `<select>` escondido e
 * `absolute` ao lado do gatilho; sem um ancestral posicionado dentro do corpo,
 * ele se ancora no próprio diálogo — fora da área que rola —, e o diálogo
 * inteiro passava a rolar 42px no celular, tirando do lugar o cabeçalho e o
 * rodapé que deviam ficar parados (medido em 06/10/2026, na Nova venda).
 */
export const SALE_DIALOG_BODY = "relative min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6";
