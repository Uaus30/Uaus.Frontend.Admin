import { ROUTES } from "@/routes";

/**
 * Título da aba derivado da rota.
 *
 * O título é o que o **histórico do navegador** mostra. Com o título fixo do
 * `index.html`, as vinte e cinco telas do admin apareciam no histórico como
 * "Painel Administrativo" — todas iguais —, e voltar para "aquela tela de
 * ontem" virava adivinhação.
 *
 * O nome de cada tela sai do `label` do `routes.ts`, a fonte única. Nenhuma
 * string de tela é escrita aqui: rota nova ganha título sozinha, e renomear no
 * menu renomeia no histórico. Uma segunda lista para manter em sincronia é
 * exatamente o que o `routes.ts` existe para evitar.
 */

/** Sufixo que identifica o app. Vem depois do nome da tela, nunca antes. */
export const TITULO_DO_APP = "Uaus Admin";

/**
 * Nome da tela em que o caminho está, ou `null` quando ele não é de rota
 * conhecida.
 *
 * Casa pelo caminho MAIS LONGO que prefixa a localização: assim
 * `/produtos/709/detalhes` acha "Produtos" e `/financeiro/relatorios` acha
 * "Relatórios", e não "Financeiro". Sem a ordenação por comprimento, a rota mais
 * curta ganharia pelo acaso da ordem de declaração.
 *
 * @param pathname Caminho SEM o base do Vite — é o que o `useLocation` do
 *   wouter devolve, porque o `<Router>` já foi montado com `base`.
 */
export function nomeDaTela(pathname: string): string | null {
  const casadas = ROUTES.filter(
    (rota) => rota.label && (pathname === rota.path || pathname.startsWith(`${rota.path}/`)),
  ).sort((a, b) => b.path.length - a.path.length);

  return casadas[0]?.label ?? null;
}

/**
 * Monta o título completo.
 *
 * O específico vem PRIMEIRO porque o histórico e a aba cortam o fim: "Produtos ·
 * Uaus Admin" continua legível numa aba estreita, "Uaus Admin · Produtos" vira
 * "Uaus Admi…" em todas as telas.
 */
export function comporTitulo(nome?: string | null): string {
  const limpo = nome?.trim();
  return limpo ? `${limpo} · ${TITULO_DO_APP}` : TITULO_DO_APP;
}
