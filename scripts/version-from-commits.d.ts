/**
 * Tipagem do módulo irmão em JavaScript puro (ver o porquê do `.js` lá dentro).
 *
 * Este arquivo existe para o `typecheck:pdv`: o `apps/pdv/tsconfig.node.json`
 * inclui o `vite.config.ts`, que importa o `build-version.ts`, que importa o
 * módulo declarado aqui. Sem a declaração, o `tsc` reprova com TS2307.
 */
export declare function versionFromCommitCount(commitCount: number): string;
