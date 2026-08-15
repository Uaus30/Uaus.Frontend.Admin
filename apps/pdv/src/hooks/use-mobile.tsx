import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

/**
 * Consumido por `packages/ui/src/components/sidebar.tsx`, que importa
 * `@/hooks/use-mobile` — o alias resolve no `src` de cada app que usa o pacote,
 * então este arquivo precisa existir aqui mesmo sem import direto no PDV.
 */
function subscribe(onChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

export function useIsMobile() {
  // useSyncExternalStore em vez de useEffect + setState: o valor certo já sai no
  // primeiro render (antes havia um paint com `false` até o efeito rodar), e não
  // há estado espelhando algo que o browser já sabe responder.
  return React.useSyncExternalStore(
    subscribe,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false,
  )
}
