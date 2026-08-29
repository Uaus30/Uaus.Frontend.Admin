import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Volta ao topo a cada troca de rota.
 *
 * O wouter não restaura scroll sozinho; no site antigo só a página de produtos
 * se lembrava de subir, e navegar Home → Contato aterrissava no meio da página.
 * Global aqui, nenhuma página precisa lembrar.
 */
export function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location]);

  return null;
}
