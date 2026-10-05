import { ScanSearch } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@workspace/ui";
import { PRODUCT_ANOMALIES_PATH } from "../anomalies-route";

/**
 * Botão "Anomalias" do topo da listagem de produtos (pedido do dono, 05/10/2026).
 *
 * Quem corrige cadastro parte da listagem de produtos, e a tela de anomalias
 * morava só no menu, dentro de BI. O botão encurta o caminho.
 *
 * Só leva, não conta. A contagem exigiria a varredura do catálogo inteiro
 * (`/ProductAnomalies` não tem resumo) a cada abertura da listagem — que é a
 * tela mais aberta do admin. Contorno neutro, e não vermelho como o "para
 * repor" ao lado: sem número, ele não afirma que há pendência.
 */
export function AnomaliesShortcut() {
  return (
    <Button asChild variant="outline">
      <Link href={PRODUCT_ANOMALIES_PATH} data-testid="anomalies-shortcut">
        <ScanSearch className="mr-2 h-4 w-4" />
        Anomalias
      </Link>
    </Button>
  );
}
