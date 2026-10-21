import * as React from "react"

import { cn } from "@/lib/utils"
import { claseCampo } from "@/components/ui/input"

/** Igual que `Input`, pero crece con el texto (`field-sizing-content`) desde tres líneas. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(claseCampo, "field-sizing-content h-auto min-h-24 py-2.5 leading-relaxed", className)}
      {...props}
    />
  )
}

export { Textarea }
