import { ClipboardCheck, Camera, Layers, PackageSearch } from "lucide-react";
import { Button, Card, CardContent, Spinner } from "@workspace/ui";

type InventoryCountStartProps = {
  /** Ainda perguntando ao servidor se existe conferência aberta. */
  isLoading: boolean;
  onStart: () => void;
  isStarting: boolean;
};

/**
 * O convite a começar — o que a aba mostra enquanto NÃO há conferência aberta.
 *
 * Explica antes de oferecer o botão porque "Nova conferência" tira um retrato
 * do catálogo inteiro e passa a bloquear a próxima conferência até esta
 * terminar. Quem clica precisa saber disso antes, não depois.
 */
export function InventoryCountStart({ isLoading, onStart, isStarting }: InventoryCountStartProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="flex flex-col items-center gap-6 px-6 py-12 text-center">
        <span className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
          <ClipboardCheck className="h-10 w-10 text-primary" />
        </span>

        <div className="max-w-2xl space-y-2">
          <h2 className="font-display text-2xl font-bold text-foreground">
            Nenhuma conferência em andamento
          </h2>
          <p className="text-sm text-muted-foreground">
            A conferência tira um retrato do catálogo e monta a lista de tudo que precisa ser revisado — um
            item por cadastro. Você confere aos poucos: cada produto sai da lista quando é marcado como
            conferido, e o que falta continua esperando aqui, mesmo que leve dias.
          </p>
        </div>

        <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-3">
          <Objetivo
            icon={<Camera className="h-4 w-4" />}
            title="Foto certa"
            description="Produto sem imagem não aparece direito no site nem no PDV."
          />
          <Objetivo
            icon={<Layers className="h-4 w-4" />}
            title="Variações certas"
            description="Grade, cor e tamanho conferidos no cadastro do produto."
          />
          <Objetivo
            icon={<PackageSearch className="h-4 w-4" />}
            title="Estoque real"
            description="A contagem física lança sozinha a entrada ou a baixa da diferença."
          />
        </div>

        <div className="space-y-2">
          <Button onClick={onStart} disabled={isStarting} className="hover-elevate gap-2" size="lg">
            {isStarting ? <Spinner className="h-4 w-4" /> : <ClipboardCheck className="h-4 w-4" />}
            {isStarting ? "Montando a lista..." : "Nova conferência"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Só pode haver uma conferência por vez. Produtos cadastrados depois do início não entram nesta.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Objetivo({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/40 p-4 text-left">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-primary">{icon}</span>
        {title}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
