/**
 * Import de imagem dentro do pacote.
 *
 * Os três apps declaram `types: ["vite/client"]` no tsconfig e por isso já
 * enxergam `*.png` sozinhos. O `typecheck` do @workspace/ui, que o CI roda em
 * passo separado (`npm run typecheck --workspace=@workspace/ui`), usa o
 * tsconfig daqui — que não carrega os tipos do Vite. Sem esta declaração o
 * pacote reprova sozinho, com "Cannot find module", enquanto os apps passam.
 */
declare module "*.png" {
  const src: string;
  export default src;
}
