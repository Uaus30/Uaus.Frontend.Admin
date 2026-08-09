import { cn } from "../lib/utils"

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  dotClassName?: string;
}

function Spinner({ className, dotClassName, ...props }: SpinnerProps) {
  return (
    <>
      <style>{`
        @keyframes three-dots-scale {
          0%, 100% {
            transform: scale(0.6);
            opacity: 0.35;
          }
          50% {
            transform: scale(1.25);
            opacity: 1;
          }
        }
        .animate-three-dots {
          animation: three-dots-scale 1.4s infinite ease-in-out both;
        }
      `}</style>
      <div
        role="status"
        aria-label="Loading"
        className={cn("flex items-center justify-center gap-2", className)}
        {...props}
      >
        <span
          className={cn("h-2.5 w-2.5 rounded-full bg-primary animate-three-dots", dotClassName)}
          style={{ animationDelay: "-0.32s" }}
        ></span>
        <span
          className={cn("h-2.5 w-2.5 rounded-full bg-primary animate-three-dots", dotClassName)}
          style={{ animationDelay: "-0.16s" }}
        ></span>
        <span
          className={cn("h-2.5 w-2.5 rounded-full bg-primary animate-three-dots", dotClassName)}
        ></span>
      </div>
    </>
  )
}

export { Spinner }


