import { HomeShortcutGrid } from "@/features/home/components/HomeShortcutGrid";
import { PolygonBackground } from "@/features/home/components/PolygonBackground";
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
 *
 * Atrás dos botões, a malha de polígonos (24/10/2026), FIXA na janela inteira.
 * Presa à página, ela só cobria a altura dos botões e deixava a metade de baixo
 * da tela vazia no desktop; esticá-la até a borda do `main` exigiria margem
 * negativa casada com o padding do `layout.tsx`, e no dia em que os dois
 * divergissem a tela ganharia barra de rolagem lateral. Fixa, ela não entra na
 * conta da rolagem; o menu lateral e o cabeçalho, opacos ou translúcidos,
 * passam por cima dela.
 */
export default function HomePage() {
  return (
    <div className="relative isolate flex flex-col gap-6">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        <PolygonBackground />
      </div>

      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Início</h1>
        <p className="mt-1 text-sm text-muted-foreground">Toque para ir direto à tela.</p>
      </div>

      <HomeShortcutGrid shortcuts={HOME_SHORTCUTS} />
    </div>
  );
}
