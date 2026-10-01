import { useCallback, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, ScanBarcode } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Spinner,
} from "@workspace/ui";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";

/** Retorno de quem recebe o código, mostrado embaixo do vídeo. */
export interface ScanFeedback {
  tone: "success" | "warning" | "error";
  message: string;
}

interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /**
   * Recebe cada código lido. Quem chama decide o que fazer: a lista de
   * etiquetas adiciona e deixa a câmera aberta para o próximo; a listagem de
   * produtos busca e fecha o diálogo.
   */
  onDetected: (code: string) => Promise<ScanFeedback | void> | ScanFeedback | void;
}

const FEEDBACK_STYLES: Record<ScanFeedback["tone"], string> = {
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
};

/**
 * Diálogo de leitura de código de barras pela câmera traseira.
 *
 * O conteúdo só existe com o diálogo aberto (o Radix desmonta ao fechar), e é
 * isso que liga e desliga a câmera — ver {@link useCameraBarcodeScanner}.
 */
export function BarcodeScannerDialog({
  open,
  onOpenChange,
  title,
  description,
  onDetected,
}: BarcodeScannerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[95dvh] flex-col gap-3 p-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanBarcode className="h-5 w-5" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ScannerBody onDetected={onDetected} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ScannerBody({
  onDetected,
  onClose,
}: {
  onDetected: BarcodeScannerDialogProps["onDetected"];
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);

  const handleCode = useCallback(
    async (code: string) => {
      const result = await onDetected(code);
      if (!result) return;
      setFeedback(result);
      // Bipar de olho na prateleira: a vibração confirma sem olhar a tela.
      // O iPhone não vibra pelo navegador, e para ele fica o aviso colorido.
      if (result.tone === "success") navigator.vibrate?.(60);
    },
    [onDetected],
  );

  const { status, error } = useCameraBarcodeScanner(videoRef, handleCode);

  return (
    <>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black">
        {/* playsInline e muted: sem eles o Safari do iPhone abre o vídeo em
            tela cheia, fora do diálogo, ou nem toca. */}
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />

        {status === "scanning" && (
          // Faixa de mira: código de barras é largo e baixo.
          <div className="pointer-events-none absolute inset-x-[10%] top-1/2 h-1/3 -translate-y-1/2 rounded-md border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
        )}

        {status === "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white/80">
            <Spinner className="h-6 w-6" />
            Abrindo a câmera...
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">
            {error}
          </div>
        )}
      </div>

      <div
        aria-live="polite"
        className={`flex min-h-[2.75rem] items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
          feedback ? FEEDBACK_STYLES[feedback.tone] : "border-border/50 text-muted-foreground"
        }`}
      >
        {feedback ? (
          <>
            {feedback.tone === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <CircleAlert className="h-4 w-4 shrink-0" />
            )}
            <span className="min-w-0 break-words">{feedback.message}</span>
          </>
        ) : status === "error" ? (
          // Sem câmera, "aponte para o código" mandaria fazer o impossível.
          "Feche e busque pelo nome ou pelo código digitado."
        ) : (
          "Aponte para o código de barras, dentro da faixa."
        )}
      </div>

      <Button type="button" variant="outline" onClick={onClose}>
        Concluir
      </Button>
    </>
  );
}
