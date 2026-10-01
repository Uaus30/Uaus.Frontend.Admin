import { useEffect, useRef, useState, type RefObject } from "react";
import {
  createBarcodeReader,
  describeCameraError,
  type ScanGate,
  scanRegion,
  tuneCameraTrack,
} from "@/lib/barcode-scanner";

/**
 * Pausa entre duas leituras. Curta porque a leitura em si já é aguardada — não
 * empilha — e cada tentativa custa pouco desde que lê só a faixa da mira.
 */
const SCAN_INTERVAL_MS = 100;

export type CameraScannerStatus = "starting" | "scanning" | "error";

/**
 * Liga a câmera traseira no `<video>` e procura códigos de barras até o
 * componente sair da tela — é o fechamento do diálogo que desliga a câmera.
 *
 * Feito para viver DENTRO do conteúdo do diálogo, que só existe aberto: cada
 * abertura monta o hook do zero, com a câmera ligando de novo.
 *
 * A leitura **pausa** enquanto `onCode` trabalha (a busca do produto, por
 * exemplo): a mesma prateleira não vira três buscas em voo.
 *
 * @param onCode Recebe cada código que passou pelo filtro de repetição.
 * @param gate O filtro de repetição. Vem de FORA porque precisa sobreviver ao
 *   fechamento do diálogo — ver `createScanGate`.
 */
export function useCameraBarcodeScanner(
  videoRef: RefObject<HTMLVideoElement | null>,
  onCode: (code: string) => Promise<void> | void,
  gate: ScanGate,
): { status: CameraScannerStatus; error: string | null } {
  const [status, setStatus] = useState<CameraScannerStatus>("starting");
  const [error, setError] = useState<string | null>(null);
  const onCodeRef = useRef(onCode);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    const video = videoRef.current;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Sem isto a luz da câmera fica acesa depois de fechar o diálogo. Vale
    // também para o fechamento que acontece enquanto a permissão é pedida: o
    // stream chega depois da limpeza e precisa ser desligado na chegada.
    const stopStream = () => {
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    };

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          // 1920×1080: as barras finas do EAN-13 precisam de pixels. Em 720p,
          // a um palmo da embalagem, cada barra tinha 1 ou 2 pixels e o leitor
          // não achava nada com os números perfeitamente legíveis na tela. O
          // custo por quadro fica contido porque só a faixa da mira é lida.
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (stopped || !video) return stopStream();
        await tuneCameraTrack(stream.getVideoTracks()[0]);

        const reader = await createBarcodeReader();
        if (stopped) return stopStream();

        video.srcObject = stream;
        await video.play();
        if (stopped) return;
        setStatus("scanning");

        gate.rearm(performance.now());
        // A leitura é feita num recorte da faixa da mira, desenhado num canvas
        // fora da tela — ver scanRegion.
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        const tick = async () => {
          if (stopped) return;
          try {
            const region = scanRegion(video.videoWidth, video.videoHeight);
            if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && region) {
              let source: HTMLVideoElement | HTMLCanvasElement = video;
              if (context) {
                canvas.width = region.sw;
                canvas.height = region.sh;
                context.drawImage(
                  video,
                  region.sx,
                  region.sy,
                  region.sw,
                  region.sh,
                  0,
                  0,
                  region.sw,
                  region.sh,
                );
                source = canvas;
              }
              const found = await reader.detect(source);
              const codes = found
                .map((barcode) => barcode.rawValue?.trim())
                .filter((code): code is string => !!code);
              const code = stopped ? null : gate.pick(codes, performance.now());
              if (code) {
                await onCodeRef.current(code);
                gate.touch(code, performance.now());
              }
            }
          } catch (scanError) {
            // Um quadro ruim não derruba a leitura; o próximo tenta de novo.
            console.warn("Falha ao ler o quadro da câmera:", scanError);
          }
          if (!stopped) timer = setTimeout(() => void tick(), SCAN_INTERVAL_MS);
        };
        void tick();
      } catch (startError) {
        stopStream();
        if (stopped) return;
        console.error("Erro ao abrir a câmera:", startError);
        setError(describeCameraError(startError));
        setStatus("error");
      }
    };

    void start();

    return () => {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      stopStream();
      if (video) video.srcObject = null;
    };
  }, [videoRef, gate]);

  return { status, error };
}
