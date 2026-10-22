'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Estado, type TonoEstado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { claseTarjeta } from '@/components/ui/tarjeta';
import { BEHAVIORS, CONTEXTS, PRESENT_PEOPLE, REASONS, TIME_SLOTS } from '@/lib/constants';

/** Un registro ya resuelto para leerlo: siglas, clase y quién lo registró, sin ids por medio. */
export interface FichaRegistroData {
  id: string;
  siglas: string;
  clase: string;
  reportDate: string; // yyyy-MM-dd
  registradoPor: string;
  context: string;
  contextNote: string | null;
  timeSlot: string;
  presentPeople: string[];
  presentNames: string | null;
  behaviors: string[];
  involvedWith: string | null;
  situationDescription: string | null;
  antecedents: string | null;
  consequences: string | null;
  redirectActions: string | null;
  reasons: string[];
  reasonOther: string | null;
  effectivenessRating: string | null;
  comments: string | null;
  createdAt: string; // ISO
}

function etiquetaDe<T extends { value: string; label: string }>(arr: readonly T[], val: string): string {
  return arr.find((x) => x.value === val)?.label ?? val;
}

function Bloque({ titulo, children, className }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-1.5', className)}>
      <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">{titulo}</h3>
      {children}
    </section>
  );
}

function Texto({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed whitespace-pre-line text-zinc-800 dark:text-zinc-200">{children}</p>;
}

/** El contenido de la ficha: pensado para leerse de arriba abajo, sin saltos de lado. */
export function FichaRegistro({ f }: { f: FichaRegistroData }) {
  const eff = f.effectivenessRating ? parseFloat(f.effectivenessRating) : null;
  const effTono: TonoEstado = eff == null ? 'neutro' : eff < 2.5 ? 'error' : eff < 3.5 ? 'aviso' : 'ok';
  const dondeCuando = [
    f.context === 'otros' && f.contextNote ? f.contextNote : etiquetaDe(CONTEXTS, f.context),
    etiquetaDe(TIME_SLOTS, f.timeSlot),
  ].join(' · ');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{dondeCuando}</p>
        {eff !== null && (
          <Estado tono={effTono}>
            Efectividad {eff.toFixed(1)} / 5 · {eff < 2.5 ? 'baja' : eff < 3.5 ? 'media' : 'alta'}
          </Estado>
        )}
      </div>

      <Bloque titulo="Conductas observadas">
        <div className="flex flex-wrap gap-1.5">
          {f.behaviors.map((b) => (
            <Etiqueta key={b} className="px-2.5 py-1 text-sm">
              {etiquetaDe(BEHAVIORS, b)}
            </Etiqueta>
          ))}
        </div>
        {f.involvedWith && (
          <p className="pt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Producido con: <span className="font-medium text-zinc-800 dark:text-zinc-200">{f.involvedWith}</span>
          </p>
        )}
      </Bloque>

      {f.presentPeople.length > 0 && (
        <Bloque titulo="Presentes">
          <div className="flex flex-wrap items-center gap-1.5">
            {f.presentPeople.map((p) => (
              <Etiqueta key={p}>{etiquetaDe(PRESENT_PEOPLE, p)}</Etiqueta>
            ))}
            {f.presentNames && <span className="text-xs text-zinc-500 italic dark:text-zinc-400">({f.presentNames})</span>}
          </div>
        </Bloque>
      )}

      {f.situationDescription && (
        <Bloque titulo="Situación problemática">
          <Texto>{f.situationDescription}</Texto>
        </Bloque>
      )}

      {f.antecedents && (
        <Bloque titulo="A · Antecedentes">
          <Texto>{f.antecedents}</Texto>
        </Bloque>
      )}
      {f.consequences && (
        <Bloque titulo="C · Consecuencias">
          <Texto>{f.consequences}</Texto>
        </Bloque>
      )}

      {(f.reasons.length > 0 || f.reasonOther) && (
        <Bloque titulo="¿Por qué crees que lo ha hecho?">
          <div className="flex flex-wrap gap-1.5">
            {f.reasons.map((r) => (
              <Etiqueta key={r}>{etiquetaDe(REASONS, r)}</Etiqueta>
            ))}
          </div>
          {f.reasonOther && <Texto>{f.reasonOther}</Texto>}
        </Bloque>
      )}

      {f.redirectActions && (
        <Bloque titulo="Acciones para reconducir">
          <Texto>{f.redirectActions}</Texto>
        </Bloque>
      )}

      {f.comments && (
        <Bloque titulo="Otros comentarios">
          <Texto>{f.comments}</Texto>
        </Bloque>
      )}
    </div>
  );
}

/**
 * La ficha de un registro en una ventana: sube desde abajo en el móvil y es una ventana normal
 * en pantallas grandes. Si hay varias fichas (el listado), se pasa de una a otra sin cerrar.
 */
export function FichaRegistroModal({
  fichas,
  abierto,
  onCambiar,
}: {
  fichas: FichaRegistroData[];
  /** Id del registro abierto, o null si está cerrada. */
  abierto: string | null;
  onCambiar: (id: string | null) => void;
}) {
  const indice = fichas.findIndex((f) => f.id === abierto);
  const f = indice >= 0 ? fichas[indice] : null;
  // Se recuerda la última ficha para que el contenido no desaparezca durante la animación de cierre
  const [ultima, setUltima] = useState<FichaRegistroData | null>(null);
  if (f && f !== ultima) setUltima(f);
  const mostrada = f ?? ultima;

  return (
    <Dialog open={f !== null} onOpenChange={(o) => !o && onCambiar(null)}>
      <DialogContent variante="hoja" className="sm:max-w-2xl">
        {mostrada && (
          <>
            <div className="space-y-1 pr-10">
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {mostrada.siglas}
                {mostrada.clase && <Etiqueta>{mostrada.clase}</Etiqueta>}
              </DialogTitle>
              <DialogDescription>
                <span className="capitalize">
                  {format(parseISO(mostrada.reportDate), 'EEEE d MMM yyyy', { locale: es })}
                </span>
                {' · '}registrado por {mostrada.registradoPor}
              </DialogDescription>
            </div>

            <div className={cn(claseTarjeta, 'p-4 sm:p-5')}>
              <FichaRegistro f={mostrada} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {fichas.length > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Registro anterior"
                      disabled={indice <= 0}
                      onClick={() => onCambiar(fichas[indice - 1].id)}
                    >
                      <ChevronLeft aria-hidden />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Registro siguiente"
                      disabled={indice < 0 || indice >= fichas.length - 1}
                      onClick={() => onCambiar(fichas[indice + 1].id)}
                    >
                      <ChevronRight aria-hidden />
                    </Button>
                  </>
                )}
              </div>
              <Link
                href={`/gestion/abc/registros/${mostrada.id}`}
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                <ExternalLink aria-hidden /> Abrir página completa (borrar)
              </Link>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
