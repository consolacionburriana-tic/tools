"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-zinc-950/30 duration-150 supports-backdrop-filter:backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 dark:bg-black/60",
        className
      )}
      {...props}
    />
  )
}

/**
 * - `centrado` (por defecto): la ventana en medio de la pantalla.
 * - `hoja`: en el móvil sube desde abajo y respeta la barra de inicio del iPhone; desde `sm`
 *   es igual que la centrada. Para fichas y detalles que se abren con el dedo.
 */
const VARIANTE = {
  centrado:
    "top-1/2 left-1/2 max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl sm:max-w-md data-open:zoom-in-95 data-closed:zoom-out-95",
  hoja:
    "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl pb-[max(1.25rem,env(safe-area-inset-bottom))] data-open:slide-in-from-bottom data-closed:slide-out-to-bottom sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:pb-5 sm:data-open:slide-in-from-bottom-0 sm:data-open:zoom-in-95 sm:data-closed:slide-out-to-bottom-0 sm:data-closed:zoom-out-95",
} as const

function DialogContent({
  className,
  children,
  showCloseButton = true,
  variante = "centrado",
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  variante?: keyof typeof VARIANTE
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-variante={variante}
        className={cn(
          "fixed z-50 grid max-h-[calc(100dvh-2rem)] w-full gap-4 overflow-y-auto overscroll-contain border border-zinc-200 bg-white p-5 text-sm text-zinc-700 shadow-xl duration-150 outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
          VARIANTE[variante],
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2.5 right-2.5 text-zinc-500"
                size="icon-sm"
              />
            }
          >
            <XIcon className="size-5" />
            <span className="sr-only">Cerrar</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  )
}

/** Los botones de abajo: el principal a la derecha (en el móvil, arriba y a todo lo ancho). */
function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-5 -mb-5 flex flex-col-reverse gap-2 border-t border-zinc-100 bg-zinc-50/80 px-5 py-4 sm:flex-row sm:justify-end dark:border-zinc-800 dark:bg-zinc-950/40",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Cerrar
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "pr-10 text-lg leading-snug font-semibold text-zinc-900 dark:text-zinc-100",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-zinc-500 dark:text-zinc-400 *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-zinc-900 dark:*:[a]:hover:text-zinc-100",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
