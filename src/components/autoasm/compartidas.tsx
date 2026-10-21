'use client';

// Las cuentas de los iPads compartidos. No son personas: no vienen de Educamos ni tienen
// NIA, y por eso el sync no las toca. Se heredan del CSV del curso pasado y desde aquí se
// añaden, se quitan y se ve en qué clase están matriculadas.

import { useMemo, useState } from 'react';
import { Plus, Tablet, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { ConfirmarEnLinea } from '@/components/ui/confirmar';
import { Input } from '@/components/ui/input';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Plegable } from '@/components/autoasm/entrega';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cabecerasDe, type FilaCsv } from '@/lib/autoasm';
import { darDeBaja, limpiarArchivos, regenerarMatriculas, type ProyectoAsm } from '@/lib/autoasm-construir';
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
    const conAlumnado = { ...proyecto.archivos, students: [...proyecto.archivos.students, ...nuevas] };
    // Si el grupo elegido ya es la regla de alguna clase de compartidos (lo normal: el
    // desplegable sugiere justo esos), rehacer matrículas las mete solas ahí. Si el grupo
    // es nuevo y ninguna clase lo pide todavía, esto no hace nada — se avisa igual.
    const { filas: rosters, altas } = regenerarMatriculas(conAlumnado, proyecto.reglas, proyecto.archivados);
    const archivos = limpiarArchivos({ ...conAlumnado, rosters }, proyecto.archivados);
    haptic.success();
    onGuardar({ ...proyecto, archivos, compartidas, actualizado: new Date().toISOString() });
    toast.success(
      altas > 0
        ? `${nuevas.length} cuentas compartidas creadas y matriculadas en su clase.`
        : `${nuevas.length} cuentas compartidas creadas. Ninguna clase pide el grupo "${datos.grupo}" todavía: matricúlalas a mano desde "Clases".`,
    );
    setAnadiendo(false);
  }

  return (
    <Tarjeta>
      <Plegable
        abierto={abierto}
        onClick={() => setAbierto((v) => !v)}
        icono={<Tablet />}
        titulo="Cuentas de iPad compartido"
        resumen={cuentas.length === 0 ? 'Ninguna' : `${num(cuentas.length)}${grupos.length > 0 ? ` · ${grupos.join(', ')}` : ''}`}
      />

      {abierto && (
        <div className="space-y-3 border-t border-zinc-100 p-4 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            El sync de la BBDD central no las toca ni las archiva nunca: solo se tocan aquí.
          </p>

          {cuentas.length > 0 && (
            <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {cuentas.map((cuenta) => (
                <li key={cuenta.person_id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-900 dark:text-zinc-100">{cuenta.first_name}</span>
                    <span className="block truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
                      {cuenta.person_id} · {cuenta.grade_level}
                    </span>
                  </span>
                  <ConfirmarEnLinea
                    etiqueta="Quitar"
                    icono={<Trash2 />}
                    variante="ghost"
                    pregunta={`¿Quitar ${cuenta.person_id}? En ASM desaparece esa cuenta compartida.`}
                    confirmar="Sí, quitar"
                    onConfirmar={() => {
                      onGuardar(darDeBaja(proyecto, cuenta.person_id));
                      haptic.warning();
                    }}
                  />
                </li>
              ))}
            </ul>
          )}

          {anadiendo ? (
            <form
              className="grid gap-3 sm:grid-cols-4"
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
              <Campo etiqueta="Identificador" id="comp-prefijo">
                <Input id="comp-prefijo" name="prefijo" required defaultValue="aluprimaria" autoCapitalize="none" />
              </Campo>
              <Campo etiqueta="Nombre visible" id="comp-nombre">
                <Input id="comp-nombre" name="nombre" required defaultValue="Alu Primaria" />
              </Campo>
              <Campo etiqueta="Grupo" id="comp-grupo">
                <Input id="comp-grupo" name="grupo" required defaultValue={grupos[0] ?? 'Primaria Compartido'} list="grupos-compartidos" />
                <datalist id="grupos-compartidos">
                  {grupos.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </Campo>
              <Campo etiqueta="Cuántas" id="comp-cuantas">
                <Input id="comp-cuantas" name="cuantas" type="number" min={1} max={60} defaultValue={5} />
              </Campo>
              <div className="flex flex-wrap gap-2 sm:col-span-4">
                <Button type="submit">Crear cuentas</Button>
                <Button type="button" variant="ghost" onClick={() => setAnadiendo(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="outline" onClick={() => setAnadiendo(true)}>
              <Plus /> Añadir cuentas
            </Button>
          )}
        </div>
      )}
    </Tarjeta>
  );
}
