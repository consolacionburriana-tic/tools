'use client';

// Coberturas por baja (las sustituciones largas que marca Educamos, o a mano): «Ángela Guillamón sustituye a Alejandro Sánchez».
//
// Mientras una cobertura por baja está vigente, el sistema asume que lo del titular (sus tutorías, a
// quién se avisa, lo que ve en Alumnado y en Puntualidad) es de quien lo sustituye. Nacen de
// Educamos (columnas PROF. SUSTITUTO y PROF. TITULAR, con la vigencia de alta y baja) o se
// apuntan a mano aquí. Se pueden apagar y encender con un toque y llevan fechas opcionales.
//
// Las filas se pintan de las props y, tras cada cambio, se pide al servidor que refresque:
// el estado (vigente, programada, caducada…) lo calcula siempre el servidor con la fecha de hoy.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Download, Plus, UserRoundCog } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Rotulo } from '@/components/ui/rotulo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Selector } from '@/components/ui/selector';
import { Campo } from '@/components/ui/campo';
import { Estado, type TonoEstado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Interruptor } from '@/components/ui/interruptor';
import { ConfirmarEnLinea } from '@/components/ui/confirmar';
import { Vacio } from '@/components/ui/vacio';
import type { EstadoCoberturaBaja } from '@/lib/coberturas-baja';

export interface CoberturaBajaUI {
  id: string;
  sustitutoNombre: string;
  titularNombre: string;
  desde: string | null;
  hasta: string | null;
  activa: boolean;
  origen: 'educamos' | 'manual';
  estado: EstadoCoberturaBaja;
}

export interface ProfeOpcion {
  id: string;
  nombre: string;
}

const ESTADO: Record<EstadoCoberturaBaja, { tono: TonoEstado; texto: string }> = {
  vigente: { tono: 'ok', texto: 'Vigente' },
  programada: { tono: 'info', texto: 'Programada' },
  caducada: { tono: 'neutro', texto: 'Caducada' },
  desactivada: { tono: 'neutro', texto: 'Desactivada' },
};

async function llamar(metodo: 'POST' | 'PATCH' | 'DELETE', cuerpo: unknown, url = '/api/profes/admin/coberturas-baja') {
  const res = await fetch(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar');
  return data;
}

export function CoberturasBajaPanel({ filas, profes }: { filas: CoberturaBajaUI[]; profes: ProfeOpcion[] }) {
  const router = useRouter();
  const vigentes = filas.filter((f) => f.estado === 'vigente').length;
  const [abierto, setAbierto] = useState(vigentes > 0);
  const [leyendo, setLeyendo] = useState(false);

  async function releer() {
    setLeyendo(true);
    try {
      const data = await llamar('POST', {}, '/api/profes/admin/coberturas-baja/educamos');
      const r = data.resumen as { nuevas: number; actualizadas: number; apagadas: number; avisos: string[] };
      const hechos = r.nuevas + r.actualizadas + r.apagadas;
      toast.success(
        hechos === 0
          ? 'Ya estaba todo al día con lo que dice Educamos'
          : `Educamos: ${r.nuevas} nueva(s), ${r.actualizadas} con fechas cambiadas, ${r.apagadas} apagada(s)`,
      );
      r.avisos.slice(0, 3).forEach((a) => toast.warning(a, { duration: 12000 }));
      haptic.success();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
      haptic.warning();
    } finally {
      setLeyendo(false);
    }
  }

  return (
    <Tarjeta as="section">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <UserRoundCog aria-hidden className="h-5 w-5 shrink-0 text-zinc-400" />
        <span className="flex-1">
          <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">Coberturas por baja</span>
          <span className="block text-sm text-zinc-500 dark:text-zinc-400">
            Quién cubre a quién mientras dura: hereda sus tutorías y sus avisos
            {vigentes > 0 ? ` · ${vigentes} vigente(s)` : ''}
          </span>
        </span>
        <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div className="space-y-5 border-t border-zinc-100 px-4 py-4 dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Mientras una cobertura por baja esté <strong>vigente</strong>, quien sustituye es tutor/a de las clases del titular
            (los avisos van a esa persona, no a quien falta). Las que vienen de Educamos se crean y se cierran solas con
            su alta y su baja; apaga con el interruptor las que no valgan, o apunta una a mano abajo.
          </p>

          <div>
            <Rotulo as="h3" className="mb-1.5">Ahora mismo</Rotulo>
            {filas.length === 0 ? (
              <Vacio icono={<UserRoundCog />} titulo="Nadie está cubriendo ninguna baja">
                Si ya has importado el profesorado de Educamos, pulsa «Releer de Educamos» para traer las que ya vienen
                marcadas allí.
              </Vacio>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filas.map((f) => (
                  <FilaCoberturaBaja key={`${f.id}-${f.desde}-${f.hasta}`} fila={f} onCambio={() => router.refresh()} />
                ))}
              </ul>
            )}
            <div className="mt-3">
              <Button type="button" variant="outline" size="sm" cargando={leyendo} onClick={() => void releer()}>
                <Download aria-hidden /> Releer de Educamos
              </Button>
            </div>
          </div>

          <FormularioNueva profes={profes} onCreada={() => router.refresh()} />
        </div>
      )}
    </Tarjeta>
  );
}

function textoFechas(f: Pick<CoberturaBajaUI, 'desde' | 'hasta'>): string {
  const fmt = (iso: string) => {
    const [a, m, d] = iso.split('-');
    return `${Number(d)}/${Number(m)}/${a}`;
  };
  if (f.desde && f.hasta) return `Del ${fmt(f.desde)} al ${fmt(f.hasta)}`;
  if (f.desde) return `Desde el ${fmt(f.desde)}, sin fecha de fin`;
  if (f.hasta) return `Hasta el ${fmt(f.hasta)}`;
  return 'Sin fechas: mientras esté encendida';
}

function FilaCoberturaBaja({ fila, onCambio }: { fila: CoberturaBajaUI; onCambio: () => void }) {
  const [desde, setDesde] = useState(fila.desde ?? '');
  const [hasta, setHasta] = useState(fila.hasta ?? '');
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const e = ESTADO[fila.estado];

  async function cambiar(cambios: { activa?: boolean; desde?: string | null; hasta?: string | null }) {
    setGuardando(true);
    try {
      await llamar('PATCH', { id: fila.id, ...cambios });
      haptic.success();
      onCambio();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
      haptic.warning();
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    try {
      await llamar('DELETE', { id: fila.id });
      toast.success('Cobertura por baja borrada');
      haptic.success();
      onCambio();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
      haptic.warning();
    }
  }

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-zinc-900 dark:text-zinc-100">
            <strong className="font-semibold">{fila.sustitutoNombre}</strong> sustituye a{' '}
            <strong className="font-semibold">{fila.titularNombre}</strong>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
            <Estado tono={e.tono}>{e.texto}</Estado>
            <span>{textoFechas({ desde: fila.desde, hasta: fila.hasta })}</span>
            <Etiqueta title={fila.origen === 'educamos' ? 'Viene del export de profesorado de Educamos' : 'Apuntada a mano'}>
              {fila.origen === 'educamos' ? 'Educamos' : 'A mano'}
            </Etiqueta>
          </p>
        </div>
        <Interruptor
          etiquetaOculta
          activo={fila.activa}
          disabled={guardando}
          onChange={(activa) => void cambiar({ activa })}
          etiqueta={`${fila.activa ? 'Apagar' : 'Encender'} la cobertura de la baja de ${fila.titularNombre} por ${fila.sustitutoNombre}`}
        />
      </div>

      {editando ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Campo etiqueta="Desde" id={`desde-${fila.id}`} opcional>
            <Input id={`desde-${fila.id}`} type="date" value={desde} onChange={(ev) => setDesde(ev.target.value)} />
          </Campo>
          <Campo etiqueta="Hasta (inclusive)" id={`hasta-${fila.id}`} opcional>
            <Input id={`hasta-${fila.id}`} type="date" value={hasta} onChange={(ev) => setHasta(ev.target.value)} />
          </Campo>
          <div className="flex gap-2">
            <Button
              type="button"
              cargando={guardando}
              onClick={async () => {
                await cambiar({ desde: desde || null, hasta: hasta || null });
                setEditando(false);
              }}
            >
              Guardar fechas
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setEditando(true)}>
            Cambiar fechas
          </Button>
          <ConfirmarEnLinea
            etiqueta="Borrar"
            pregunta={`¿Borrar que ${fila.sustitutoNombre} sustituye a ${fila.titularNombre}?`}
            confirmar="Sí, borrar"
            onConfirmar={borrar}
          />
        </div>
      )}
    </li>
  );
}

function FormularioNueva({ profes, onCreada }: { profes: ProfeOpcion[]; onCreada: () => void }) {
  const [sustitutoId, setSustitutoId] = useState('');
  const [titularId, setTitularId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apuntar(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    if (!sustitutoId || !titularId) return setError('Elige quién sustituye y a quién.');
    setGuardando(true);
    try {
      await llamar('POST', { sustitutoId, titularId, desde: desde || null, hasta: hasta || null });
      toast.success('Cobertura por baja apuntada');
      haptic.success();
      setSustitutoId('');
      setTitularId('');
      setDesde('');
      setHasta('');
      onCreada();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
      haptic.warning();
    } finally {
      setGuardando(false);
    }
  }

  const opciones = profes.map((p) => (
    <option key={p.id} value={p.id}>
      {p.nombre}
    </option>
  ));

  return (
    <form onSubmit={apuntar} className="space-y-3">
      <Rotulo as="h3">Apuntar una a mano</Rotulo>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Sustituye" id="sust-sustituto">
          <Selector id="sust-sustituto" value={sustitutoId} onChange={(e) => setSustitutoId(e.target.value)}>
            <option value="">Elige a quien sustituye…</option>
            {opciones}
          </Selector>
        </Campo>
        <Campo etiqueta="A" id="sust-titular">
          <Selector id="sust-titular" value={titularId} onChange={(e) => setTitularId(e.target.value)}>
            <option value="">Elige a quien falta…</option>
            {opciones}
          </Selector>
        </Campo>
        <Campo etiqueta="Desde" id="sust-desde" opcional ayuda="En blanco: desde ya.">
          <Input id="sust-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </Campo>
        <Campo etiqueta="Hasta (inclusive)" id="sust-hasta" opcional ayuda="En blanco: hasta que la apagues.">
          <Input id="sust-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </Campo>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      <Button type="submit" cargando={guardando}>
        <Plus aria-hidden /> Apuntar cobertura por baja
      </Button>
    </form>
  );
}
