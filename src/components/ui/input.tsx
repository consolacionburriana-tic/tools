import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/**
 * La receta de campo de la app: 44 px, borde zinc-300 y foco azul. La letra es de 16 px en el
 * móvil para que Safari no haga zoom al tocar el campo; desde `sm`, 15 px.
 * Úsala tal cual también en `<select>` nativos (`selector.tsx`) para que todo mida igual.
 */
export const claseCampo =
  "h-11 w-full min-w-0 rounded-xl border border-zinc-300 bg-white px-3 text-base text-zinc-900 transition-colors outline-none placeholder:text-zinc-400 focus-visible:border-blue-500 focus-visible:ring-3 focus-visible:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:opacity-60 aria-invalid:border-red-500 aria-invalid:ring-3 aria-invalid:ring-red-500/20 sm:text-[15px] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:disabled:bg-zinc-900"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        claseCampo,
        "file:mr-3 file:inline-flex file:h-8 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:text-sm file:font-medium file:text-zinc-700 dark:file:bg-zinc-800 dark:file:text-zinc-200",
        className
      )}
      {...props}
    />
  )
}

export { Input }
