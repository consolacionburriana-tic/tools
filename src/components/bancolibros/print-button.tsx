'use client';

import { Printer } from 'lucide-react';

// El diálogo de imprimir del navegador = "Guardar como PDF" en iPad/desktop.
export function PrintButton() {
  return (
    <div className="mb-4 flex justify-end print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
      >
        <Printer className="h-4 w-4" /> Imprimir / guardar PDF
      </button>
    </div>
  );
}
