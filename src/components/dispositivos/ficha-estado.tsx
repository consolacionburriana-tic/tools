'use client';

// La ficha de un alumno en Dispositivos: todo lo que no cabe en la fila (qué iPad del cole se
// le presta, la firma, de qué hermano viene, modelo y nº de serie de uno propio, notas) y el
// historial de lo que ha pasado.
import { useEffect, useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import {
  cuotaDe,
  cursosDeCompra,
  llevaCompra,
  MODALIDAD_LABEL,
  MODALIDADES,
  seguroDe,
  TEXTO_SEGURO,
  type Modalidad,
} from '@/lib/dispositivos';
import type { AlumnoDis, LineaHistorial, PanelDispositivos } from '@/lib/dispositivos-server';
import type { Acciones } from './panel';
import { COLOR_MODALIDAD, cuandoYQuien, ESTILO_BOTON, ESTILO_BOTON_PRINCIPAL, ESTILO_CAMPO, pedir } from './comun';

export function FichaEstado({
  alumno: a,
  panel,
  acciones,
  onCerrar,
}: {
  alumno: AlumnoDis;
  panel: PanelDispositivos;
  acciones: Acciones;
  onCerrar: () => void;
}) {
  const e = a.estado;
  const prestamoActual = panel.aparatos.find((x) => x.uso === 'prestamo' && x.titular?.tipo === 'alumno' && x.titular.id === a.id);
  const sustitucion = panel.aparatos.find((x) => x.uso === 'sustitucion' && x.titular?.tipo === 'alumno' && x.titular.id === a.id);

  const [modalidad, setModalidad] = useState<Modalidad | null>(e?.modalidad ?? null);
  const [cursoCompra, setCursoCompra] = useState(e?.cursoCompra ?? '');
  const [aCasa, setACasa] = useState(Boolean(e?.aCasa));
  const [firmadoAt, setFirmadoAt] = useState(e?.firmadoAt ?? '');
  const [hermanoId, setHermanoId] = useState(e?.hermanoId ?? '');
  const [aparatoId, setAparatoId] = useState(prestamoActual?.id ?? '');
  const [modeloId, setModeloId] = useState(e?.modeloId ?? '');
  const [numeroSerie, setNumeroSerie] = useState(e?.numeroSerie ?? '');
  const [notas, setNotas] = useState(e?.notas ?? '');
  const [historial, setHistorial] = useState<LineaHistorial[] | null>(null);

  useEffect(() => {
    let vivo = true;
    pedir<{ lineas: LineaHistorial[] }>(`/api/dispositivos/historial?alumno=${a.id}`)
      .then((r) => vivo && setHistorial(r.lineas))
      .catch(() => vivo && setHistorial([]));
    return () => {
      vivo = false;
    };
  }, [a.id, e?.updatedAt]);

  // Los de préstamo que se le pueden dar: los libres (y en uso), más el que ya tiene.
  const libres = panel.aparatos.filter((x) => x.uso === 'prestamo' && x.estado === 'activo' && (!x.titular || x.id === prestamoActual?.id));
  const modelos = panel.modelos.filter((m) => m.activo || m.id === modeloId);
  const cuota = modalidad ? cuotaDe({ modalidad, cursoCompra: cursoCompra || null, aCasa }, panel.cursoActual) : null;
  const seguro = seguroDe(cursoCompra || null, panel.cursoActual);
  const ocupado = acciones.guardando === a.id;

  async function guardar() {
    const ok = await acciones.guardar(
      modalidad === null
        ? { eduStudentId: a.id, modalidad: null }
        : {
            eduStudentId: a.id,
            modalidad,
            cursoCompra: llevaCompra(modalidad) ? cursoCompra || null : null,
            aCasa: modalidad === 'prestado' ? aCasa : null,
            firmadoAt: modalidad === 'prestado' ? firmadoAt || null : null,
            hermanoId: modalidad === 'hermano' ? hermanoId || null : null,
            aparatoId: modalidad === 'prestado' ? aparatoId || null : undefined,
            modeloId: modalidad === 'prestado' ? null : modeloId || null,
            numeroSerie: modalidad === 'prestado' ? null : numeroSerie.trim() || null,
            notas: notas.trim() || null,
          },
    );
    if (ok) onCerrar();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <div className="space-y-5">
          <div className="space-y-1 pr-8">
            <DialogTitle className="text-lg font-semibold">{a.nombre}</DialogTitle>
            <DialogDescription className="text-sm text-zinc-600 dark:text-zinc-400">
              {a.clase} · iPad
              {sustitucion && ` · ahora con el ${sustitucion.codigo} de sustitución`}
            </DialogDescription>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Cómo lo tiene</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MODALIDADES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={modalidad === m}
                  onClick={() => {
                    haptic.tap();
                    setModalidad(m);
                  }}
                  className={cn(
                    'h-12 cursor-pointer rounded-xl border text-sm transition-colors',
                    modalidad === m ? cn(COLOR_MODALIDAD[m], 'font-semibold') : 'border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800',
                  )}
                >
                  {MODALIDAD_LABEL[m]}
                </button>
              ))}
            </div>
            {modalidad && (
              <button type="button" onClick={() => setModalidad(null)} className="cursor-pointer text-xs text-zinc-500 underline">
                Volver a «sin informar»
              </button>
            )}
          </fieldset>

          {modalidad === 'hermano' && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">De qué hermano viene</span>
              <select
                className={ESTILO_CAMPO}
                value={hermanoId}
                onChange={(ev) => {
                  setHermanoId(ev.target.value);
                  // Hereda el curso de compra del hermano (David, 20-oct-2026).
                  const h = a.hermanos.find((x) => x.id === ev.target.value);
                  if (h?.cursoCompra) setCursoCompra(h.cursoCompra);
                }}
              >
                <option value="">{a.hermanos.length ? 'Elige…' : 'No hay hermanos en la BBDD central'}</option>
                {a.hermanos.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.nombre} · {h.clase}
                    {h.cursoCompra ? ` · comprado ${h.cursoCompra}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          {modalidad && llevaCompra(modalidad) && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Curso de compra{modalidad === 'hermano' ? ' (el del hermano)' : ''}
              </span>
              <select className={ESTILO_CAMPO} value={cursoCompra} onChange={(ev) => setCursoCompra(ev.target.value)}>
                <option value="">No se sabe todavía</option>
                {cursosDeCompra(panel.cursoActual, 10).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="block text-xs text-zinc-500">
                {seguro.estado === 'sin_dato'
                  ? 'Sin el curso de compra no se sabe si el seguro sigue en vigor.'
                  : seguro.estado === 'vigente'
                    ? `Seguro hasta ${seguro.hasta}.`
                    : `${TEXTO_SEGURO[seguro.estado][0].toUpperCase()}${TEXTO_SEGURO[seguro.estado].slice(1)} (cubría hasta ${seguro.hasta}).`}
              </span>
            </label>
          )}

          {modalidad === 'prestado' && (
            <div className="space-y-4 rounded-xl bg-blue-50/60 p-4 dark:bg-blue-500/5">
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">¿Se lo lleva a casa?</legend>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: true, t: 'A casa', d: 'Ha firmado y paga la cuota' },
                    { v: false, t: 'En el cole', d: 'No se lo lleva' },
                  ].map((o) => (
                    <button
                      key={o.t}
                      type="button"
                      aria-pressed={aCasa === o.v}
                      onClick={() => setACasa(o.v)}
                      className={cn(
                        'cursor-pointer rounded-xl border px-3 py-2.5 text-left transition-colors',
                        aCasa === o.v ? 'border-zinc-900 bg-white font-semibold dark:border-zinc-100 dark:bg-zinc-950' : 'border-zinc-300 dark:border-zinc-700',
                      )}
                    >
                      <span className="block text-sm">{o.t}</span>
                      <span className="block text-xs font-normal text-zinc-500">{o.d}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">iPad del cole</span>
                  <select className={ESTILO_CAMPO} value={aparatoId} onChange={(ev) => setAparatoId(ev.target.value)}>
                    <option value="">{libres.length ? 'Sin iPad todavía' : 'No hay iPads de préstamo libres'}</option>
                    {libres.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.codigo}
                        {x.numeroSerie ? ` · ${x.numeroSerie}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Firmado el <span className="font-normal text-zinc-500">(opcional)</span>
                  </span>
                  <input type="date" className={ESTILO_CAMPO} value={firmadoAt} onChange={(ev) => setFirmadoAt(ev.target.value)} />
                </label>
              </div>
              {libres.length === 0 && (
                <button type="button" onClick={() => acciones.irA('cole')} className="cursor-pointer text-xs text-blue-700 underline dark:text-blue-300">
                  Dar de alta iPads de préstamo en «iPads del cole»
                </button>
              )}
            </div>
          )}

          {modalidad && modalidad !== 'prestado' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Modelo <span className="font-normal text-zinc-500">(opcional)</span>
                </span>
                <select className={ESTILO_CAMPO} value={modeloId} onChange={(ev) => setModeloId(ev.target.value)}>
                  <option value="">No se sabe</option>
                  {modelos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.etiqueta}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Nº de serie <span className="font-normal text-zinc-500">(opcional)</span>
                </span>
                <input
                  className={cn(ESTILO_CAMPO, 'uppercase')}
                  value={numeroSerie}
                  onChange={(ev) => setNumeroSerie(ev.target.value.toUpperCase())}
                  autoComplete="off"
                />
              </label>
            </div>
          )}

          {modalidad && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Notas <span className="font-normal text-zinc-500">(opcional)</span>
              </span>
              <input className={ESTILO_CAMPO} value={notas} onChange={(ev) => setNotas(ev.target.value)} placeholder="Pantalla rajada, funda del cole…" />
            </label>
          )}

          {cuota && (
            <p
              className={cn(
                'rounded-xl px-3 py-2 text-sm',
                cuota.aviso
                  ? 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200'
                  : 'bg-zinc-50 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300',
              )}
            >
              {cuota.aviso
                ? `${cuota.aviso}: hasta saberlo no sale en las cuotas.`
                : cuota.concepto
                  ? `Paga ${cuota.importe} € al ${cuota.concepto === 'mensual' ? 'mes' : 'año'} · ${cuota.motivo}`
                  : `No paga nada · ${cuota.motivo}`}
            </p>
          )}

          <div className="flex gap-2">
            <button type="button" className={cn(ESTILO_BOTON, 'flex-1')} onClick={onCerrar}>
              Cancelar
            </button>
            <button type="button" className={cn(ESTILO_BOTON_PRINCIPAL, 'flex-1')} onClick={() => void guardar()} disabled={ocupado}>
              {ocupado && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
            </button>
          </div>

          <div className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              <History className="h-3.5 w-3.5" /> Historial
            </p>
            {historial === null ? (
              <p className="text-sm text-zinc-400">Cargando…</p>
            ) : historial.length === 0 ? (
              <p className="text-sm text-zinc-500">Todavía no ha pasado nada.</p>
            ) : (
              <ul className="space-y-1.5">
                {historial.map((h, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-zinc-900 dark:text-zinc-100">{h.texto}</span>
                    <span className="block text-xs text-zinc-500">{cuandoYQuien(h.at, h.porNombre)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
