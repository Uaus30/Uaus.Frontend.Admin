import { useEffect, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import { Button } from "@workspace/ui";

/** O navegador sabe abrir tela cheia? Chrome em quiosque e Firefox sabem; nem todo WebView sabe. */
const suportaTelaCheia = () =>
  typeof document !== "undefined" && typeof document.documentElement.requestFullscreen === "function";

/**
 * Liga e desliga a tela cheia do navegador.
 *
 * No balcão o PDV disputa altura com a barra de endereço e as abas do Chrome —
 * são ~90px que saem da lista de itens e voltam quando a tela cheia entra. O
 * atalho F11 já existia; o botão é para quem opera no touchscreen, onde não há
 * teclado para apertar.
 *
 * O estado NÃO é guardado aqui: quem manda é o `document.fullscreenElement`, e
 * é ele que o evento `fullscreenchange` traz de volta. Um booleano próprio
 * dessincronizaria na primeira vez que o operador saísse pelo Esc ou pelo F11,
 * e o botão passaria a oferecer o contrário do que faz.
 */
export function FullscreenToggle() {
  const [emTelaCheia, setEmTelaCheia] = useState(false);

  useEffect(() => {
    const sincronizar = () => setEmTelaCheia(document.fullscreenElement !== null);

    sincronizar();
    document.addEventListener("fullscreenchange", sincronizar);
    return () => document.removeEventListener("fullscreenchange", sincronizar);
  }, []);

  // Sem suporte no navegador, botão nenhum: um que não faz nada ensina o
  // operador a desconfiar dos outros.
  if (!suportaTelaCheia()) return null;

  const alternar = () => {
    // `void` nas duas: o pedido de tela cheia é recusado quando não vem de um
    // gesto do usuário, e a promessa rejeitada não pode virar erro no console
    // de um caixa que está vendendo.
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    void document.documentElement.requestFullscreen().catch(() => undefined);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={alternar}
      title={emTelaCheia ? "Sair da tela cheia (F11)" : "Tela cheia (F11)"}
      aria-label={emTelaCheia ? "Sair da tela cheia" : "Entrar em tela cheia"}
      aria-pressed={emTelaCheia}
      className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all active:scale-90 cursor-pointer"
    >
      {emTelaCheia ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
    </Button>
  );
}
