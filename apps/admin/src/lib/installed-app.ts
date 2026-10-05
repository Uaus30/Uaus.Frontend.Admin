/**
 * O admin aberto como app instalado na tela de início do iPhone (ou iPad).
 *
 * Lá, o app NÃO divide o armazenamento com o Safari: a sessão do admin mora no
 * `localStorage` do app, e o que ele abre em nova aba vai para o Safari, que
 * não a tem — a tela nova cai no login. No Android isso não acontece: o app
 * instalado usa o mesmo armazenamento do Chrome.
 *
 * `navigator.standalone` só existe no Safari do iOS, e só é `true` dentro do
 * app instalado. Por isso ele separa o caso sem pegar o app do Android nem o do
 * computador, onde a nova aba continua funcionando.
 *
 * @param nav Só os testes passam; em runtime é o `navigator` do navegador.
 */
export function isIosInstalledApp(nav?: Navigator): boolean {
  const alvo = nav ?? (typeof navigator !== "undefined" ? navigator : undefined);
  return (alvo as (Navigator & { standalone?: boolean }) | undefined)?.standalone === true;
}

/**
 * Atributos de âncora para o link que leva a OUTRA TELA DO ADMIN em nova aba.
 *
 * Fora do app do iPhone: nova aba, para a tela de origem não se perder (é o
 * motivo de cada um desses links). Dentro dele: a mesma janela, porque a nova
 * aba cairia no login do Safari.
 *
 * Só para link que sai de tela de CONSULTA. Os que saem de tela com trabalho
 * não salvo — o "+" de departamento e de categoria e o "Padrão: N" do cadastro
 * do produto, o "Compra #N" da entrada (modal da aba Estoque, dentro do mesmo
 * cadastro) e o "Editar produto" das etiquetas — continuam em nova aba também
 * no iPhone, por decisão do dono (05/10/2026): o login no Safari é uma vez só,
 * e na mesma janela o que foi digitado se perderia. Na dúvida se a tela de
 * origem guarda algo não salvo, ela guarda: fique com a nova aba.
 *
 * Link para fora do admin (site do fornecedor, WhatsApp, foto, anexo, PDV) não
 * usa isto: esse deve mesmo abrir no navegador.
 */
export function adminNewTabProps(nav?: Navigator): { target?: "_blank"; rel?: "noreferrer" } {
  return isIosInstalledApp(nav) ? {} : { target: "_blank", rel: "noreferrer" };
}
