import { useCallback, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, ScanBarcode } from "lucide-react";
import { useCameraBarcodeScanner } from "../hooks/use-camera-barcode-scanner";
import { createScanGate, type ScanGate } from "../lib/barcode-scanner";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog";
import { Spinner } from "./spinner";

/** Retorno de quem recebe o código, mostrado embaixo do vídeo. */
export interface ScanFeedback {
  tone: "success" | "warning" | "error";
  message: string;
  /**
   * Fecha o diálogo (e desliga a câmera). É o que acontece quando o produto é
   * encontrado: pedido do dono no primeiro uso de verdade (30/09/2026), a cada
   * produto a pessoa toca no botão de novo. "Não encontrado" não fecha — a
   * pessoa tenta de novo ou desiste, e a mensagem precisa ficar à vista.
   */
  close?: boolean;
}

/**
 * Duração da vibração do "achei". Os 60ms da primeira versão o dono não sentiu
 * no aparelho; 150ms é o pulso curto e perceptível do leitor de mão.
 */
export const SCAN_SUCCESS_VIBRATION_MS = 150;

interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /**
   * Recebe cada código lido e decide pelo retorno: o aviso embaixo do vídeo, e
   * se o diálogo fecha (`close`). Sucesso vibra o aparelho.
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
  // Um filtro por tela, e não por abertura: ele precisa lembrar o último código
  // lido quando a câmera reabre (ver createScanGate). O useState com função é a
  // forma de criar uma vez só sem ler ref durante o render.
  const [gate] = useState<ScanGate>(() => createScanGate());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[95dvh] flex-col gap-3 p-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanBarcode className="h-5 w-5" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ScannerBody gate={gate} onDetected={onDetected} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ScannerBody({
  gate,
  onDetected,
  onClose,
}: {
  gate: ScanGate;
  onDetected: BarcodeScannerDialogProps["onDetected"];
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  /**
   * Fechou: o diálogo ainda fica montado ~200ms, na animação de saída, com a
   * câmera lendo. Uma etiqueta vizinha na mira nesse meio-tempo entraria na
   * lista sem o diálogo à vista.
   */
  const closedRef = useRef(false);

  const handleCode = useCallback(
    async (code: string) => {
      if (closedRef.current) return;
      const result = await onDetected(code);
      if (!result || closedRef.current) return;
      // Bipar de olho na prateleira: a vibração confirma sem olhar a tela. O
      // Safari do iPhone não implementa a vibração; lá fica só o aviso.
      if (result.tone === "success") navigator.vibrate?.(SCAN_SUCCESS_VIBRATION_MS);
      if (result.close) {
        closedRef.current = true;
        onClose();
        return;
      }
      setFeedback(result);
    },
    [onDetected, onClose],
  );

  const { status, error } = useCameraBarcodeScanner(videoRef, handleCode, gate);

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
