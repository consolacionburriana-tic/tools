import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * El botón de la app (guía: docs/diseno.md). 44 px de alto, para el dedo en el iPad.
 *
 * - `default`: la acción principal, en azul. Una por pantalla o por tarjeta.
 * - `outline`: la secundaria (Cancelar, Exportar…). `ghost`: la terciaria, sin caja.
 * - `destructive`: borrar o quitar, en contorno rojo. `destructive-solid`, en rojo relleno,
 *   solo para el «sí» de una confirmación.
 * - Tamaños: `default` (44), `sm` (40, filas y barras densas), `lg` (48, barra fija de abajo),
 *   `icon` (44) e `icon-sm` (40). Un botón de solo icono lleva `aria-label`.
 *
 * Para un enlace con aspecto de botón: `buttonVariants()` en el `className` del `Link`.
 * `cargando` lo desactiva y pone la ruedecita delante mientras se guarda.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-transparent text-sm font-semibold whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-invalid:border-red-500 aria-invalid:ring-3 aria-invalid:ring-red-500/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800",
        outline:
          "border-zinc-300 bg-white font-medium text-zinc-800 hover:bg-zinc-50 active:bg-zinc-100 aria-expanded:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:active:bg-zinc-700 dark:aria-expanded:bg-zinc-800",
        secondary:
          "bg-zinc-100 font-medium text-zinc-800 hover:bg-zinc-200 active:bg-zinc-300 aria-expanded:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 dark:active:bg-zinc-600",
        ghost:
          "font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 active:bg-zinc-200 aria-expanded:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:active:bg-zinc-700",
        destructive:
          "border-red-200 bg-white text-red-700 hover:bg-red-50 active:bg-red-100 focus-visible:ring-red-500/30 dark:border-red-900/70 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-500/10 dark:active:bg-red-500/20",
        "destructive-solid":
          "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500/40",
        link: "h-auto! px-0! font-medium text-blue-700 underline-offset-4 hover:underline dark:text-blue-400",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-10 px-3.5",
        lg: "h-12 px-5 text-base",
        icon: "size-11",
        "icon-sm": "size-10",
        // Solo para las piezas de shadcn que los traen de serie (input-group, calendar):
        // en las pantallas, nada por debajo de 40 px.
        xs: "h-7 gap-1 rounded-lg px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        "icon-xs": "size-7 rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  cargando = false,
  disabled,
  children,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & { cargando?: boolean }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      {...props}
    >
      {cargando && <Loader2 className="animate-spin" />}
      {children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
