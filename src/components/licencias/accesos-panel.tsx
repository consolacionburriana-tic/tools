'use client';

import { useState } from 'react';
import { Download, KeyRound, RefreshCw, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import type { EstadoAccesos } from '@/lib/licencias-server';
import { Aviso } from '@/components/ui/aviso';
import { Button, buttonVariants } from '@/components/ui/button';
import { Cifra, Cifras } from '@/components/ui/cifra';
import { useConfirmar } from '@/components/ui/confirmar';
import { SkeletonKpis } from '@/components/ui/skeleton';

type Estado = EstadoAccesos;

export function AccesosPanel({ inicial, diasValidez }: { inicial: Estado; diasValidez: number }) {
  // El estado inicial lo calcula la página en el servidor; aquí solo se refresca tras actuar.
  const [estado, setEstado] = useState<Estado | null>(inicial);
  const [busy, setBusy] = useState(false);
  const [revocando, setRevocando] = useState(false);
  const { confirmar, dialogo } = useConfirmar();

  async function cargar() {
    try {
      const r = await fetch('/api/licencias/admin/accesos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'estado' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setEstado(d);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo consultar el estado');
    }
  }

  async function generar() {
    setBusy(true);
    try {
      const r = await fetch('/api/licencias/admin/accesos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'generar', diasValidez }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      haptic.success();
      toast.success(`${d.nuevos} enlaces nuevos · ${d.reutilizados} reutilizados`);
      await cargar();
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'No se pudieron generar');
    } finally {
      setBusy(false);
    }
  }

  async function revocar() {
    const si = await confirmar({
      titulo: '¿Anular todos los enlaces de licencias?',
      descripcion: 'Los que ya se enviaron dejarán de funcionar. Después habrá que generar y reenviar.',
      boton: 'Anular todos los enlaces',
      palabra: 'ANULAR',
    });
    if (!si) return;
    setRevocando(true);
    try {
      const r = await fetch('/api/licencias/admin/accesos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'revocar' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(`${d.revocados} enlaces anulados`);
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron anular');
    } finally {
      setRevocando(false);
    }
  }

  const faltan = estado ? estado.familias - estado.conEnlace : 0;

  return (
    <div className="space-y-4">
      {!estado ? (
        <SkeletonKpis />
      ) : (
        <>
          <Cifras>
            <Cifra etiqueta="Familias con correo" valor={estado.familias} />
            <Cifra etiqueta="Con enlace" valor={estado.conEnlace} />
            <Cifra etiqueta="Sin enlace" valor={faltan} nota={faltan > 0 ? 'Genéralos abajo' : undefined} />
            <Cifra etiqueta="Ya lo han usado" valor={estado.usados} />
          </Cifras>

          <div className="flex flex-wrap gap-2">
            <Button onClick={generar} cargando={busy}>
              {!busy && <KeyRound aria-hidden />}
              Generar los enlaces que falten
            </Button>
            <a href="/api/licencias/admin/accesos/export" className={buttonVariants({ variant: 'outline' })}>
              <Download aria-hidden /> CSV con los enlaces
            </a>
            <Button variant="ghost" onClick={() => void cargar()}>
              <RefreshCw aria-hidden /> Actualizar
            </Button>
          </div>

          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Generar es <strong>idempotente</strong>: reutiliza los enlaces que ya existen (los correos enviados siguen
            funcionando) y solo crea los que falten. Los nuevos caducan a los {diasValidez} días. No hace falta venir
            aquí antes de un envío: la pantalla de <strong>Correos</strong> genera lo que falte al enviar.
          </p>

          {estado.alumnosSinCorreo.length > 0 && (
            <Aviso tono="aviso" titulo={`${estado.alumnosSinCorreo.length} alumnos sin correo de tutor en Educamos`}>
              <p>
                Estas familias no reciben enlace: hay que avisarlas por otra vía (o completar su correo en Educamos y
                volver a sincronizar).
              </p>
              <ul className="mt-2 max-h-48 overflow-y-auto">
                {estado.alumnosSinCorreo.map((a, i) => (
                  <li key={i}>
                    {a.curso} · {a.apellidos}, {a.nombre}
                  </li>
                ))}
              </ul>
            </Aviso>
          )}

          {estado.alumnosSinEnlaceCentral > 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {estado.alumnosSinEnlaceCentral} alumnos de la campaña no están enlazados a la BBDD central: sin enlace a
              `edu_students` no se les puede localizar el tutor (se arregla sincronizando alumnos).
            </p>
          )}

          <div className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <Button variant="destructive" size="sm" onClick={revocar} cargando={revocando}>
              {!revocando && <ShieldOff aria-hidden />}
              Anular todos los enlaces
            </Button>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Solo si sospechas que un enlace se ha compartido donde no debía. Después habrá que generar y reenviar.
            </p>
          </div>
        </>
      )}
      {dialogo}
    </div>
  );
}
