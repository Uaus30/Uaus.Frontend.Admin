import { useEffect, useRef, useState } from "react"
import { useToast } from "../hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  type ToastProps,
} from "./toast"
import { cn } from "../lib/utils"

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
} as const

type ToastVariant = keyof typeof VARIANT_STYLE

/**
 * Um toast na fila, como `useToast` o devolve.
 *
 * `title`/`description`/`action` são redeclarados porque `ToastProps` herda os
 * atributos do `<li>` do Radix, onde `title` é uma string do HTML — aqui eles
 * aceitam nó React.
 */
type ToastItemProps = Omit<ToastProps, "title"> & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactElement
}

function ToastItem({ id, title, description, action, variant, className, ...props }: ToastItemProps) {
  const [open, setOpen] = useState(true)
  const { dismiss } = useToast()

  const estilo = VARIANT_STYLE[(variant as ToastVariant) ?? "default"] ?? VARIANT_STYLE.default

  // A barra de progresso é animada direto no DOM: um setState por quadro
  // rerenderizaria a árvore 60 vezes por segundo para mover um retângulo.
  const progressBarRef = useRef<HTMLDivElement>(null)
  const isPausedRef = useRef(false)
  const lastTickRef = useRef(0)

  useEffect(() => {
    let timeLeft = estilo.duration
    isPausedRef.current = false
    lastTickRef.current = Date.now()

    let animFrameId: number

    const tick = () => {
      const now = Date.now()
      const delta = now - lastTickRef.current
      lastTickRef.current = now

      if (!isPausedRef.current) {
        timeLeft -= delta
        if (progressBarRef.current) {
          progressBarRef.current.style.width = `${Math.max(0, (timeLeft / estilo.duration) * 100)}%`
        }

        if (timeLeft <= 0) {
          setOpen(false)
          setTimeout(() => dismiss(id), 500)
          return
        }
      }

      animFrameId = requestAnimationFrame(tick)
    }

    animFrameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animFrameId)
  }, [estilo.duration, id, dismiss])

  return (
    <Toast
      open={open}
      onOpenChange={(val) => {
        setOpen(val)
        if (!val) setTimeout(() => dismiss(id), 500)
      }}
      variant={variant}
      onMouseEnter={() => {
        isPausedRef.current = true
      }}
      onMouseLeave={() => {
        lastTickRef.current = Date.now()
        isPausedRef.current = false
      }}
      className={cn(
        "select-none transition-all duration-300 ease-out pt-3 pb-6 pr-8 relative overflow-hidden",
        estilo.className,
        className,
      )}
      {...props}
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="grid gap-1 flex-1 pr-8">
          {title && <ToastTitle className="font-bold">{title}</ToastTitle>}
          {description && (
            <ToastDescription className="text-xs font-medium opacity-90">{description}</ToastDescription>
          )}
        </div>
      </div>
      {action}

      <ToastClose className="right-1 opacity-60 hover:opacity-100 hover:bg-black/10 focus:ring-current" />

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10">
        <div ref={progressBarRef} className="h-full bg-black/25" style={{ width: "100%" }} />
      </div>
    </Toast>
  )
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} {...toast} />
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
