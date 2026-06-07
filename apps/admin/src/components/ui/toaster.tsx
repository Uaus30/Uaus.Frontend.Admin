import { useState, useEffect, useRef } from "react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { Copy, Check } from "lucide-react"

function ToastItem({ id, title, description, action, variant, ...props }: any) {
  const [open, setOpen] = useState(true)
  const [copied, setCopied] = useState(false)
  const { dismiss } = useToast()

  const isError = variant === "destructive"
  const duration = isError ? 5000 : 3000

  // 1. Manage timer state and DOM progress bar directly to avoid React re-renders
  const progressBarRef = useRef<HTMLDivElement>(null)
  const isPausedRef = useRef(false)
  const lastTickRef = useRef<number>(0)

  useEffect(() => {
    let timeLeft = duration
    isPausedRef.current = false
    lastTickRef.current = Date.now()

    let animFrameId: number

    const tick = () => {
      const now = Date.now()
      const delta = now - lastTickRef.current
      lastTickRef.current = now

      if (!isPausedRef.current) {
        timeLeft -= delta
        const percentage = Math.max(0, (timeLeft / duration) * 100)
        
        if (progressBarRef.current) {
          progressBarRef.current.style.width = `${percentage}%`
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

    return () => {
      cancelAnimationFrame(animFrameId)
    }
  }, [duration, id])

  const handleMouseEnter = () => {
    isPausedRef.current = true
  }

  const handleMouseLeave = () => {
    lastTickRef.current = Date.now()
    isPausedRef.current = false
  }

  // 2. Extract and format API error details if available
  const rawError = props.errorData ?? props.error
  const getApiError = () => {
    if (!rawError) return null
    // ApiError typically wraps details in payload or data
    const data = rawError.payload !== undefined ? rawError.payload : rawError.data
    if (data && typeof data === "object") return data
    if (typeof rawError === "object") {
      if (("Id" in rawError && "Message" in rawError) || ("id" in rawError && "message" in rawError)) {
        return rawError
      }
    }
    return null
  }

  const apiError = getApiError()
  const displayTitle = title
  const displayDescription = apiError ? (apiError.Message ?? apiError.message ?? description) : description

  // 3. Handle copy logic
  const getCopyText = () => {
    const method = rawError?.method ?? (rawError && typeof rawError === "object" && "method" in rawError ? rawError.method : "")
    const verbPrefix = method ? `[${String(method).toUpperCase()}] ` : ""
    const currentPath = typeof window !== "undefined" ? window.location.pathname : ""

    const copyData: Record<string, any> = {
      title: title || "Erro",
      message: displayDescription || description,
      route: `${verbPrefix}${currentPath}`,
      timestamp: new Date().toISOString(),
    }

    if (apiError) {
      copyData.errorId = apiError.Id ?? apiError.id ?? ""
      copyData.code = apiError.Code ?? apiError.code ?? ""
    } else if (rawError && "status" in rawError) {
      copyData.code = rawError.status
    }

    try {
      return JSON.stringify(copyData, null, 2)
    } catch (_) {
      return [title, displayDescription || description].filter(Boolean).join(": ")
    }
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    const text = getCopyText()
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleToastClick = () => {
    if (isError) {
      const text = getCopyText()
      void navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Toast
      open={open}
      onOpenChange={(val) => {
        setOpen(val)
        if (!val) setTimeout(() => dismiss(id), 500)
      }}
      variant={variant}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleToastClick}
      className={cn(
        "cursor-pointer select-none transition-all duration-300 ease-out pt-3 pb-6 pr-8 relative overflow-hidden",
        isError
          ? "bg-red-600 hover:bg-red-700 border-red-700 text-white"
          : "bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-white",
        copied && "ring-2 ring-white/50"
      )}
      {...props}
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="grid gap-1 flex-1 pr-8">
          {displayTitle && <ToastTitle className="text-white font-bold">{displayTitle}</ToastTitle>}
          {displayDescription && (
            <ToastDescription className="text-white/90 text-xs font-medium">{displayDescription}</ToastDescription>
          )}
        </div>
      </div>
      {action}

      {isError && (
        <button
          onClick={handleCopy}
          className="absolute right-1 top-9 rounded-md p-1 text-red-300 opacity-0 transition-opacity hover:text-red-50 hover:bg-white/10 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-400 group-hover:opacity-100 transition-colors"
          title="Copiar mensagem de erro"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
          </button>
      )}

      <ToastClose className="right-1 text-white/60 hover:text-white hover:bg-white/10 focus:ring-white/40" />

      {/* Progress bar at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
        <div
          ref={progressBarRef}
          className="h-full bg-white/45"
          style={{ width: "100%" }}
        />
      </div>
    </Toast>
  )
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function (toast) {
        return <ToastItem key={toast.id} {...toast} />
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
