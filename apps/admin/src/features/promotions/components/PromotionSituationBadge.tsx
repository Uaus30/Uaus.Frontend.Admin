import { Badge } from "@workspace/ui";
import { CircleDot, Clock, PowerOff, Square } from "lucide-react";
import type { PromotionSituation } from "../types";

/**
 * Situação da promoção em cor, ícone e palavra.
 *
 * As três juntas, nunca só a cor: quem não distingue verde de âmbar fica sem a
 * informação, e em impressão ou captura em preto e branco ela some para todo
 * mundo. É a regra de `dominio/convencoes-de-interface.md`.
 *
 * O vocabulário é o do sistema inteiro — verde é "dentro da meta/no ar", âmbar é
 * "em andamento/atenção", cinza é "sem ação possível". Nenhum significado novo
 * foi inventado aqui.
 */
const ESTILOS: Record<PromotionSituation, { rotulo: string; classe: string; Icone: typeof CircleDot }> = {
  "no-ar": {
    rotulo: "No ar",
    classe: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    Icone: CircleDot,
  },
  programada: {
    rotulo: "Programada",
    classe: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    Icone: Clock,
  },
  encerrada: {
    rotulo: "Encerrada",
    classe: "border-muted-foreground/30 bg-muted text-muted-foreground",
    Icone: Square,
  },
  inativa: {
    rotulo: "Inativa",
    classe: "border-muted-foreground/30 bg-muted text-muted-foreground",
    Icone: PowerOff,
  },
};

export function PromotionSituationBadge({ situation }: { situation: PromotionSituation }) {
  const { rotulo, classe, Icone } = ESTILOS[situation];

  return (
    <Badge variant="outline" className={`gap-1 ${classe}`}>
      <Icone className="h-3 w-3" />
      {rotulo}
    </Badge>
  );
}
