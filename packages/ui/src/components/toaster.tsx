import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardCheck, Copy, TriangleAlert } from "lucide-react";
import { dismissToast, useToast } from "../hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  type ToastProps,
} from "./toast";
import { cn } from "../lib/utils";
import {
  buildToastReport,
  copyTextToClipboard,
  describeCurrentScreen,
  type ToastReportVariant,
} from "../lib/toast-report";

/**
 * Aparência de cada variante e por quanto tempo ela fica na tela.
 *
 * O toaster desenha o fundo aqui em vez de deixar para o `cva` do Toast porque
 * ele precisa da mesma decisão em dois outros lugares: a duração e o botão de
 * fechar em cor legível sobre o fundo escolhido.
 *
 * Erro fica mais tempo: é o único que pede uma ação de quem lê.
 */
const VARIANT_STYLE = {
  default: {
    className: "bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-white",
    duration: 3000,
  },
  destructive: {
    className: "bg-red-600 hover:bg-red-700 border-red-700 text-white",
    duration: 5000,
  },
  warning: {
    className: "bg-amber-500 hover:bg-amber-600 border-amber-600 text-amber-950",
    duration: 4000,
  },
} as const;

type ToastVariant = keyof typeof VARIANT_STYLE;

/**
 * Tempo mínimo que o toast ainda fica na tela depois do clique que o copiou.
 *
 * Sem isso o toast de sucesso (3s) costuma sumir junto com o clique, e quem
 * copiou fica sem saber se copiou.
 */
const RETENCAO_APOS_COPIA_MS = 3000;

/**
 * Um toast na fila, como `useToast` o devolve.
 *
 * `title`/`description`/`action` são redeclarados porque `ToastProps` herda os
 * atributos do `<li>` do Radix, onde `title` é uma string do HTML — aqui eles
 * aceitam nó React.
 */
type ToastItemProps = Omit<ToastProps, "title"> & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactElement;
  error?: unknown;
  appVersion?: string;
};

/** O que a marca d'água mostra: nada, a confirmação, ou a falha da cópia. */
type EstadoDaCopia = "idle" | "copiado" | "falhou";

function ToastItem({
  id,
  title,
  description,
  action,
  variant,
  className,
  error,
  appVersion,
  onClick,
  duration,
  ...props
}: ToastItemProps) {
  const [open, setOpen] = useState(true);
  const [copia, setCopia] = useState<EstadoDaCopia>("idle");

  const estilo = VARIANT_STYLE[(variant as ToastVariant) ?? "default"] ?? VARIANT_STYLE.default;

  // O `duration` do chamador vale mais que o padrão da variante — é o que o PDV
  // usa para segurar uma lista de faltas por mais tempo. Ele deixa de ir para o
  // Radix e passa a alimentar a contagem daqui: com dois cronômetros, o do Radix
  // fechava o toast no meio da retenção do clique e a cópia não dava tempo de
  // ser vista.
  const duracao = typeof duration === "number" && duration > 0 ? duration : estilo.duration;

  // O relatório copia o que está NA TELA, lendo o texto do DOM: `title` e
  // `description` aceitam nó React, e várias telas mandam JSX em vez de string.
  const tituloRef = useRef<HTMLDivElement>(null);
  const descricaoRef = useRef<HTMLDivElement>(null);

  // A barra de progresso é pintada direto no DOM: um setState por quadro
  // rerenderizaria a árvore 60 vezes por segundo para mover um retângulo.
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Quem FECHA o toast é este `setTimeout`, não o quadro de animação.
  //
  // O `requestAnimationFrame` só roda quando a página é pintada: numa aba em
  // segundo plano ele simplesmente não é chamado. Enquanto o Radix mantinha o
  // cronômetro dele, isso não aparecia — ele fechava o toast por baixo. Agora
  // que a contagem daqui é a única, prender o fechamento ao quadro deixaria o
  // toast para sempre na tela do caixa que voltou de outra aba. O quadro ficou
  // só com a barra, que é enfeite e pode parar sem consequência.
  const pausadoRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fimRef = useRef<number>(0);

  // A contagem mora em ref, e não em variável do efeito, porque o clique que
  // copia rerenderiza o item — e ela precisa continuar de onde estava para o
  // "no mínimo 3 segundos" ser mínimo de verdade, e não um recomeço.
  const totalRef = useRef<number>(duracao);
  const restanteRef = useRef<number>(duracao);

  const agendarFechamento = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    if (pausadoRef.current || !Number.isFinite(restanteRef.current)) return;

    fimRef.current = Date.now() + restanteRef.current;
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
      setTimeout(() => dismissToast(id), 500);
    }, restanteRef.current);
  }, [id]);

  /** Sobra de tempo agora, esteja a contagem correndo ou parada. */
  const restanteAgora = () =>
    pausadoRef.current ? restanteRef.current : Math.max(0, fimRef.current - Date.now());

  useEffect(() => {
    agendarFechamento();

    let animFrameId: number;
    const pintarBarra = () => {
      if (progressBarRef.current) {
        const proporcao = restanteAgora() / totalRef.current;
        progressBarRef.current.style.width = `${Math.max(0, Math.min(1, proporcao)) * 100}%`;
      }
      animFrameId = requestAnimationFrame(pintarBarra);
    };
    animFrameId = requestAnimationFrame(pintarBarra);

    return () => {
      cancelAnimationFrame(animFrameId);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [agendarFechamento]);

  const copiar = useCallback(async () => {
    const relatorio = buildToastReport({
      variant: (variant as ToastReportVariant | null) ?? "default",
      title: tituloRef.current?.textContent,
      description: descricaoRef.current?.textContent,
      error,
      screen: describeCurrentScreen(),
      appVersion,
    });

    // Estica a contagem ANTES de esperar a área de transferência: em aba sem
    // foco a promessa demora, e o toast não pode sumir no meio da espera.
    restanteRef.current = Math.max(restanteAgora(), RETENCAO_APOS_COPIA_MS);
    totalRef.current = Math.max(totalRef.current, restanteRef.current);
    agendarFechamento();

    setCopia((await copyTextToClipboard(relatorio)) ? "copiado" : "falhou");
  }, [variant, error, appVersion, agendarFechamento]);

  return (
    <Toast
      open={open}
      onOpenChange={(val) => {
        setOpen(val);
        if (!val) setTimeout(() => dismissToast(id), 500);
      }}
      variant={variant}
      // O Radix mantém um cronômetro próprio (5s por padrão, ou o `duration` que
      // o chamador passasse) e fechava o toast por baixo do nosso. Com
      // `Infinity` a contagem acima é a única — sem isso, o toast esticado pelo
      // clique ainda sumiria na hora do cronômetro do Radix.
      duration={Infinity}
      // Ponteiro, e não mouse: em tela de toque o `mouseenter` sintético fica
      // grudado depois do toque e o toast não voltaria a contar nunca — no PDV,
      // que é touchscreen, tocar para copiar deixaria o aviso preso na tela.
      onPointerEnter={(evento) => {
        if (evento.pointerType !== "mouse" || pausadoRef.current) return;
        restanteRef.current = restanteAgora();
        pausadoRef.current = true;
        agendarFechamento();
      }}
      onPointerLeave={(evento) => {
        if (evento.pointerType !== "mouse" || !pausadoRef.current) return;
        pausadoRef.current = false;
        agendarFechamento();
      }}
      onClick={(evento) => {
        onClick?.(evento);
        // O X e um eventual botão de ação são alvos próprios: copiar no caminho
        // deles faria duas coisas com um clique que pediu só uma.
        if ((evento.target as HTMLElement).closest("button, a, [toast-close]")) return;
        void copiar();
      }}
      className={cn(
        "cursor-pointer select-none transition-all duration-300 ease-out pt-3 pb-6 pr-8 relative overflow-hidden",
        estilo.className,
        className,
      )}
      {...props}
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="grid gap-1 flex-1 pr-8">
          {title && (
            <ToastTitle ref={tituloRef} className="font-bold">
              {title}
            </ToastTitle>
          )}
          {description && (
            <ToastDescription ref={descricaoRef} className="text-xs font-medium opacity-90">
              {description}
            </ToastDescription>
          )}
        </div>
      </div>
      {action}

      <ToastClose className="right-1 opacity-60 hover:opacity-100 hover:bg-black/10 focus:ring-current" />

      {/* Só um sinal de que dá para clicar — quem copia é o toast inteiro, então
          isto não é um segundo alvo e não recebe evento. */}
      {copia === "idle" && (
        <Copy
          aria-hidden
          className="pointer-events-none absolute bottom-2 right-2 h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-60"
        />
      )}

      {copia !== "idle" && (
        <div
          role="status"
          // O borrão é o que faz a marca d'água ler como marca d'água: só
          // escurecer deixa a frase do toast competindo com a palavra "Copiado"
          // no mesmo peso, e o olho não sabe qual das duas ler.
          //
          // Sem `animate-in fade-in-0` de propósito: a confirmação começa em
          // `opacity: 0` e só chega a 1 se a animação rodar. Onde ela não roda
          // — timeline travada, `prefers-reduced-motion`, aba em segundo plano
          // no instante do clique — a marca d'água fica invisível e o clique
          // parece não ter feito nada. Confirmação de ação não pode depender de
          // animação.
          className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-black/55 text-white backdrop-blur-[2px]"
        >
          {copia === "copiado" ? (
            <ClipboardCheck className="h-6 w-6" />
          ) : (
            <TriangleAlert className="h-6 w-6" />
          )}
          <span className="text-base font-bold uppercase tracking-widest">
            {copia === "copiado" ? "Copiado" : "Falha ao copiar"}
          </span>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10">
        <div ref={progressBarRef} className="h-full bg-black/25" style={{ width: "100%" }} />
      </div>
    </Toast>
  );
}

/**
 * Fila de toasts dos três apps.
 *
 * @param appVersion Versão do build (`import.meta.env.VITE_APP_VERSION`), que
 *   entra no relatório copiado. Vem por prop porque este pacote é folha do
 *   grafo e o `tsconfig` dele não carrega os tipos do Vite — ver o README.
 */
export function Toaster({ appVersion }: { appVersion?: string } = {}) {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} {...toast} appVersion={appVersion} />
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
