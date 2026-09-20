import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useToast,
} from "@workspace/ui";
import { Check, Copy, Image as ImageIcon } from "lucide-react";
import { ART_FORMAT, ART_SIGNATURES, buildPromotionPrompt } from "../hooks/promotionPrompt";
import type { PromotionArtFormat, PromotionPromptInput } from "../hooks/promotionPrompt";

/**
 * O prompt sugerido para gerar a arte, **editável**.
 *
 * A geração acontece FORA do admin (§13): aqui sai o texto e a foto de capa para
 * anexar, e a arte volta por upload. Gerar dentro exigiria chave, custo por
 * imagem e uma fila — três coisas que a loja não pediu e que o WhatsApp não
 * espera.
 *
 * O texto é editável porque direção de arte muda: as três artes que a loja
 * publicou divergem na assinatura, no endereço e na cor do raio. Um molde rígido
 * viraria um parágrafo que alguém reescreve à mão toda semana.
 */
export function PromotionPromptDialog({
  open,
  onOpenChange,
  format,
  input,
  coverImageUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  format: PromotionArtFormat;
  /** Tudo o que o prompt precisa, menos a assinatura — ela é escolhida aqui. */
  input: Omit<PromotionPromptInput, "format" | "signature">;
  /** Capa do produto, para a pessoa baixar e anexar na ferramenta de IA. */
  coverImageUrl?: string | null;
}) {
  const { toast } = useToast();
  const [assinatura, setAssinatura] = useState<string>(ART_SIGNATURES[0]);
  const [texto, setTexto] = useState(() =>
    buildPromotionPrompt({ ...input, format, signature: ART_SIGNATURES[0] }),
  );
  const [composicao, setComposicao] = useState(`${format}|${ART_SIGNATURES[0]}`);
  const [copiado, setCopiado] = useState(false);

  /*
   * O texto é recomposto quando o FORMATO ou a ASSINATURA mudam — e não a cada
   * tecla, senão o compositor apagaria a edição da pessoa por baixo dela.
   *
   * Ajuste de estado DURANTE O RENDER, e não num efeito: é o padrão que a
   * documentação do React indica para estado derivado, e é o que o lint cobra
   * (`setState` síncrono dentro de efeito dispara renders em cascata). O mesmo
   * que `usePromotionEditor` faz com a promoção que chega da API.
   *
   * A modal só existe enquanto está aberta, então fechar e abrir de novo já
   * devolve o texto recomposto pela própria montagem.
   */
  const atual = `${format}|${assinatura}`;
  if (composicao !== atual) {
    setComposicao(atual);
    setTexto(buildPromotionPrompt({ ...input, format, signature: assinatura }));
    setCopiado(false);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast({ title: "Prompt copiado", description: "Cole na ferramenta de IA e anexe a foto do produto." });
    } catch {
      // Área de transferência bloqueada (contexto sem HTTPS, permissão negada):
      // o texto continua na tela e selecionável, então o caminho não morre.
      toast({
        title: "Não foi possível copiar",
        description: "Selecione o texto e copie manualmente.",
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Prompt da arte {ART_FORMAT[format].ratio}</DialogTitle>
          <DialogDescription>
            {ART_FORMAT[format].label} · {ART_FORMAT[format].size}. O texto é sugestão — edite à vontade antes
            de copiar.
          </DialogDescription>
        </DialogHeader>

        {/* Rolagem NATIVA, e não `ScrollArea`: o viewport do Radix é dimensionado
            por `height: 100%`, que exige pai com altura definida — `max-h` não
            dá isso, e o conteúdo excedente fica inalcançável (armadilha 7). */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label>Assinatura</Label>
            <Select value={assinatura} onValueChange={setAssinatura}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ART_SIGNATURES.map((nome) => (
                  <SelectItem key={nome} value={nome}>
                    {nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              As artes publicadas usaram as duas. Trocar aqui recompõe o texto.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Prompt</Label>
            <Textarea
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              rows={18}
              className="font-mono text-xs"
            />
          </div>

          {coverImageUrl && (
            <div className="space-y-2">
              <Label>Foto para anexar</Label>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <img
                  src={coverImageUrl}
                  alt="Capa do produto"
                  className="h-20 w-20 rounded object-contain"
                  loading="lazy"
                />
                <div className="space-y-1 text-sm">
                  <p className="text-muted-foreground">
                    Baixe e anexe junto do prompt: é ela que impede a IA de inventar um produto que a loja não
                    tem.
                  </p>
                  <a
                    href={coverImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold underline"
                  >
                    <ImageIcon className="h-3.5 w-3.5" /> Abrir a foto
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={copiar} className="gap-2">
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiado ? "Copiado" : "Copiar prompt"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
