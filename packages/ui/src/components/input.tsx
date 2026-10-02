import * as React from "react";

import { cn } from "../lib/utils";

/**
 * Campo numérico sem as setinhas de incremento, nos três apps.
 *
 * Com o campo focado, o navegador soma ou subtrai um passo a cada giro da
 * roda do mouse. No pagamento dividido do PDV, rolar a lista de formas de
 * pagamento com o cursor sobre o valor alterava o valor sem o operador perceber
 * (pedido do dono, 02/10/2026). O giro tira o foco do campo, e a roda volta a
 * rolar a tela; digitar continua igual.
 */
const NUMBER_WITHOUT_SPINNER =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onWheel, ...props }, ref) => {
    const isNumber = type === "number";

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          isNumber && NUMBER_WITHOUT_SPINNER,
          className,
        )}
        onWheel={
          isNumber
            ? (event) => {
                event.currentTarget.blur();
                onWheel?.(event);
              }
            : onWheel
        }
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
