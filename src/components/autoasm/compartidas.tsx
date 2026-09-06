'use client';

// Las cuentas de los iPads compartidos. No son personas: no vienen de Educamos ni tienen
// NIA, y por eso el sync no las toca. Se heredan del CSV del curso pasado y desde aquí se
// añaden, se quitan y se ve en qué clase están matriculadas.

import { useMemo, useState } from 'react';
import { Plus, Tablet, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cabecerasDe, type FilaCsv } from '@/lib/autoasm';
import { darDeBaja, limpiarArchivos, type ProyectoAsm } from '@/lib/autoasm-construir';
import { num } from '@/components/autoasm/paleta';

/** Números que ya están usados con ese prefijo, para seguir la serie sin pisar nada. */
function siguienteNumero(ids: string[], prefijo: string): number {
  const usados = ids
    .map((id) => id.match(new RegExp(`^${prefijo}(\\d+)$`, 'i')))
    .filter(Boolean)
    .map((m) => Number(m![1]));
  return usados.length === 0 ? 1 : Math.max(...usados) + 1;
}

export function PanelCompartidas({
  proyecto,
  onGuardar,
}: {
  proyecto: ProyectoAsm;
  onGuardar: (p: ProyectoAsm) => { ok: boolean; error?: string };
}) {
  const [abierto, setAbierto] = useState(false);
  const [anadiendo, setAnadiendo] = useState(false);

  const cuentas = useMemo(
    () => proyecto.archivos.students.filter((f) => proyecto.compartidas.includes(f.person_id)),
    [proyecto],
  );
  const grupos = useMemo(
    () => [...new Set(cuentas.map((c) => c.grade_level).filter(Boolean))],
    [cuentas],
  );

  function anadir(datos: { prefijo: string; nombre: string; grupo: string; cuantas: number }) {
    const { locationId, passwordPolicy, dominio } = proyecto.opciones;
    const ids = proyecto.archivos.students.map((f) => f.person_id);
    let n = siguienteNumero(ids, datos.prefijo);
    const nuevas: FilaCsv[] = [];
    const compartidas = [...proyecto.compartidas];

    for (let i = 0; i < datos.cuantas; i++, n++) {
      const personId = `${datos.prefijo}${n}`;
      if (ids.includes(personId)) continue;
      const valores: FilaCsv = {
        person_id: personId,
        first_name: `${datos.nombre} ${n}`,
        last_name: `${datos.nombre.split(' ').map((p) => p[0] ?? '').join('').toUpperCase()}${n}`,
        grade_level: datos.grupo,
        email_address: `${personId}@${dominio}`,
        sis_username: personId,
        password_policy: passwordPolicy,
        location_id: locationId,
      };
      nuevas.push(Object.fromEntries(cabecerasDe('students').map((campo) => [campo, valores[campo] ?? ''])));
      compartidas.push(personId);
    }

    if (nuevas.length === 0) {
      toast.info('No había ninguna que crear.');
      return;
    }
    const archivos = { ...proyecto.archivos, students: [...proyecto.archivos.students, ...nuevas] };
    haptic.success();
    onGuardar({ ...proyecto, archivos: limpiarArchivos(archivos, proyecto.archivados), compartidas, actualizado: new Date().toISOString() });
    toast.success(`${nuevas.length} cuentas compartidas creadas. Matricúlalas en su clase desde "Clases".`);
    setAnadiendo(false);
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button type="button" onClick={() => setAbierto((v) => !v)} className="flex w-full items-center justify-between gap-2 p-4 text-left">
        <span className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          <Tablet className="h-4 w-4 text-zinc-400" /> Cuentas de iPad compartido
        </span>
        <span className="text-xs text-zinc-500">
          {cuentas.length === 0 ? 'ninguna' : `${num(cuentas.length)}${grupos.length > 0 ? ` · ${grupos.join(', ')}` : ''}`}
        </span>
      </button>

      {abierto && (
        <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">
            El sync de la BBDD central no las toca ni las archiva nunca: solo se tocan aquí.
          </p>

          {cuentas.length > 0 && (
            <ul className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {cuentas.map((cuenta) => (
                <li key={cuenta.person_id} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-900 dark:text-zinc-100">{cuenta.first_name}</span>
                    <span className="block truncate font-mono text-[11px] text-zinc-400">{cuenta.person_id} · {cuenta.grade_level}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm(`Quitar ${cuenta.person_id} del fichero. En ASM desaparece esa cuenta compartida. ¿Seguimos?`)) return;
                      onGuardar(darDeBaja(proyecto, cuenta.person_id));
                      haptic.warning();
                    }}
                    className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                    aria-label={`Quitar ${cuenta.person_id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {anadiendo ? (
            <form
              className="mt-3 grid gap-3 sm:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault();
                const datos = new FormData(e.currentTarget);
                anadir({
                  prefijo: String(datos.get('prefijo') ?? '').trim().toLowerCase(),
                  nombre: String(datos.get('nombre') ?? '').trim(),
                  grupo: String(datos.get('grupo') ?? '').trim(),
                  cuantas: Math.min(60, Math.max(1, Number(datos.get('cuantas') ?? 1))),
                });
              }}
            >
              <label className="block">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Identificador</span>
                <input name="prefijo" required defaultValue="aluprimaria" className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Nombre visible</span>
                <input name="nombre" required defaultValue="Alu Primaria" className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Grupo</span>
                <input name="grupo" required defaultValue={grupos[0] ?? 'Primaria Compartido'} list="grupos-compartidos" className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
                <datalist id="grupos-compartidos">
                  {grupos.map((g) => <option key={g} value={g} />)}
                </datalist>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Cuántas</span>
                <input name="cuantas" type="number" min={1} max={60} defaultValue={5} className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
              </label>
              <div className="sm:col-span-4">
                <button type="submit" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">
                  Crear cuentas
                </button>
                <button type="button" onClick={() => setAnadiendo(false)} className="ml-2 min-h-11 rounded-xl px-3 text-sm text-zinc-500">
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAnadiendo(true)}
              className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-zinc-200 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Plus className="h-4 w-4" /> Añadir cuentas
            </button>
          )}
        </div>
      )}
    </div>
  );
}
