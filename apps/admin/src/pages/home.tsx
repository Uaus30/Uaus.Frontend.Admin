import { HomeShortcutGrid } from "@/features/home/components/HomeShortcutGrid";
import { HOME_SHORTCUTS } from "@/features/home/shortcuts";

/**
 * Início — a tela em que o admin abre (05/10/2026).
 *
 * Uma grade de botões que leva direto às telas do dia a dia, pensada para o
 * celular: no telefone, a barra lateral fica escondida atrás do botão do topo e
 * as telas mais usadas moram dois toques fundo, dentro de um grupo do menu.
 *
 * Não busca dado nenhum, de propósito: é a primeira tela depois do login, e no
 * 4G cada consulta aqui atrasaria o primeiro toque. Número (faturamento,
 * reposição) é do Dashboard, a um toque daqui.
 */
export default function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Início</h1>
        <p className="mt-1 text-sm text-muted-foreground">Toque para ir direto à tela.</p>
      </div>

      <HomeShortcutGrid shortcuts={HOME_SHORTCUTS} />
    </div>
  );
}
