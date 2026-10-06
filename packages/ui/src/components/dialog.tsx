import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "../lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * Celular em pé (abaixo de `sm`): o diálogo vira uma tela, como o cartão das
 * Tarefas — decisão do dono, 06/10/2026. Centralizado, ele tinha a altura do
 * conteúdo e nenhum teto: formulário mais alto que a tela deixava o topo e os
 * botões fora dela, sem como rolar.
 *
 * - `translate-none` não é detalhe: com qualquer `translate` o diálogo vira o
 *   bloco de referência do X `fixed` (ver o botão abaixo), e o X rolaria junto
 *   com o conteúdo.
 * - `content-start`: a grade do diálogo, esticada até a altura da tela,
 *   repartiria a sobra entre as linhas — o título ficaria alto e os botões
 *   soltos no meio.
 * - As entradas `slide-*-0` anulam o deslize diagonal do centro, que numa tela
 *   cheia parece um tranco; fica o esmaecer com o leve zoom.
 *
 * As classes têm o prefixo `max-sm:` e por isso não brigam com as do chamador
 * (`max-w-3xl`, `max-h-[90vh]`, `rounded-2xl`): no celular estas valem, do `sm`
 * para cima valem as dele.
 */
const MOBILE_FULL_SCREEN =
  "max-sm:inset-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-none max-sm:content-start max-sm:rounded-none max-sm:border-0 max-sm:data-[state=open]:slide-in-from-left-0 max-sm:data-[state=open]:slide-in-from-top-0 max-sm:data-[state=closed]:slide-out-to-left-0 max-sm:data-[state=closed]:slide-out-to-top-0";

/** O X da tela cheia: fixo no canto, com 40px de toque, visível depois de rolar. */
const MOBILE_CLOSE =
  "max-sm:fixed max-sm:right-2 max-sm:top-2 max-sm:z-10 max-sm:flex max-sm:h-10 max-sm:w-10 max-sm:items-center max-sm:justify-center max-sm:rounded-full max-sm:bg-background/80 max-sm:opacity-100 max-sm:backdrop-blur-sm";

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  /**
   * Ocupar a tela inteira no celular em pé (o padrão). `false` mantém a caixa
   * centralizada — para o que não é formulário, como a foto ampliada da loja.
   */
  fullScreenOnMobile?: boolean;
};

const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  ({ className, children, fullScreenOnMobile = true, ...props }, ref) => (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          // `max-h-dvh` + `overflow-y-auto` valem em toda largura: sem teto, o que
          // passasse da altura da janela ficava fora dela, inalcançável.
          "fixed left-[50%] top-[50%] z-50 grid max-h-dvh w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          fullScreenOnMobile && MOBILE_FULL_SCREEN,
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className={cn(
            "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
            fullScreenOnMobile && MOBILE_CLOSE,
          )}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  ),
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

/**
 * Alinhado à esquerda também no celular, e com folga à direita para o X de 40px
 * da tela cheia: centralizado, um título comprido passava por baixo dele. São
 * 48px porque é onde o X termina — e o cabeçalho de quem usa `p-0` com o próprio
 * respiro (`px-5`, `px-6`) encosta na borda da tela.
 */
const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-left max-sm:pr-12", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

/**
 * Empilhados no celular, os botões ganham `gap-2` (antes encostavam um no
 * outro). Só abaixo de `sm`: em cima continua o `space-x-2`, e quem já passa
 * `gap-*` próprio não muda no computador.
 */
const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse max-sm:gap-2 sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
