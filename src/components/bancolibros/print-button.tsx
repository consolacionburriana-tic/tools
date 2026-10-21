'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

// El diálogo de imprimir del navegador = "Guardar como PDF" en iPad/desktop.
export function PrintButton() {
  return (
    <Button onClick={() => window.print()} className="print:hidden">
      <Printer aria-hidden /> Imprimir o guardar en PDF
    </Button>
  );
}
