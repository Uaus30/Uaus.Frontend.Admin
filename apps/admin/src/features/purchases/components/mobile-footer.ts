/**
 * Rodapé de botões preso ao pé da tela no celular, para os diálogos de compra
 * que rolam o conteúdo inteiro (registrar/editar e lançar recebimento).
 *
 * No celular o diálogo é tela cheia (kit, 06/10/2026), e o formulário da compra
 * tem uns dezesseis campos empilhados: o Salvar só aparecia no fim da rolagem.
 * `sticky` deixa os botões sempre à mão; as margens negativas cobrem o respiro
 * `p-6` do diálogo, para o conteúdo que passa por baixo não aparecer pelas
 * laterais nem embaixo.
 *
 * `-bottom-6`, e não `bottom-0`: o navegador mede o `bottom` do sticky a partir
 * da borda INTERNA do respiro de quem rola. Com zero, a barra grudava 24px acima
 * do pé da tela e o formulário aparecia rolando por baixo dela (medido em
 * 06/10/2026: 24px com `bottom-0`, 0 com `-bottom-6`, no meio e no fim da
 * rolagem). Só abaixo de `sm` — do `sm` para cima o diálogo volta a
 * ser caixa e o rodapé fica no fim, como antes.
 */
export const MOBILE_STICKY_FOOTER =
  "max-sm:sticky max-sm:-bottom-6 max-sm:z-10 max-sm:-mx-6 max-sm:-mb-6 max-sm:bg-background max-sm:px-6 max-sm:pb-4 max-sm:[&>button]:flex-1";
