'use client';

// Licencias del profesorado (Fase 5b de docs/11-licencias-v2.md). Se usan MUY poco —unas pocas
// por curso—, así que esto no es la hoja de cálculo del alumnado sino lo más corto posible:
// «pego las licencias y pam, esta para este profe, esta para este» (David). Arriba se pega y se
// reparte; abajo queda lo anotado, con el código copiable de un toque y el botón de mandárselo.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ClipboardPaste, Copy, Loader2, Mail, Search, Trash2, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import {
  analizarPegadoProfes,
  filtrarProfes,
  type ConflictoCodigo,
  type LicenciaProfeFila,
  type ProfeOpcion,
} from '@/lib/licencias-profes';

const URL_API = '/api/licencias/admin/licencias/profes';

async function post(body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(URL_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) toast.error((data.error as string) ?? 'No se ha podido');
  return { ok: res.ok, data };
}

/** Un botón con el profe puesto; al tocarlo, un buscador. Sirve igual para iPad que con teclado. */
function SelectorProfe({
  profes,
  valor,
  onElegir,
  disabled,
}: {
  profes: ProfeOpcion[];
  valor: string | null;
  onElegir: (id: string | null) => void;
  disabled?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [termino, setTermino] = useState('');
  const actual = profes.find((p) => p.id === valor);
  const encontrados = useMemo(() => filtrarProfes(profes, termino).slice(0, 8), [profes, termino]);

  const elegir = (id: string | null) => {
    haptic.tap();
    onElegir(id);
    setAbierto(false);
    setTermino('');
  };

  if (!abierto) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAbierto(true)}
        className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-lg px-2 py-1 text-left text-sm disabled:opacity-50 ${
          actual
            ? 'bg-blue-50 text-blue-800 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-200'
            : 'border border-dashed border-zinc-300 text-zinc-400 hover:border-zinc-400 dark:border-zinc-600'
        }`}
      >
        <UserRound className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{actual?.nombre ?? 'Elegir profe…'}</span>
      </button>
    );
  }

  return (
    <div className="relative w-64 max-w-full">
      <div className="flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-2 dark:border-blue-700 dark:bg-zinc-900">
        <Search className="h-3.5 w-3.5 text-zinc-400" />
        <input
          autoFocus
          value={termino}
          onChange={(e) => setTermino(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setAbierto(false);
            if (e.key === 'Enter' && encontrados[0]) elegir(encontrados[0].id);
          }}
          placeholder="Busca por nombre o correo"
          className="w-full bg-transparent py-1 text-sm outline-none"
        />
        <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" className="text-zinc-400">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        {encontrados.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => elegir(p.id)}
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              {p.nombre}
              {p.email && <span className="block text-[11px] text-zinc-400">{p.email}</span>}
            </button>
          </li>
        ))}
        {encontrados.length === 0 && <li className="px-3 py-1.5 text-sm text-zinc-400">Nadie con ese nombre</li>}
        {valor && (
          <li className="border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => elegir(null)}
              className="block w-full px-3 py-1.5 text-left text-xs text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Quitar el profe
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

function fecha(d: string) {
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function EnviosProfes() {
  const [filas, setFilas] = useState<LicenciaProfeFila[]>([]);
  const [profes, setProfes] = useState<ProfeOpcion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState('');
  const [libro, setLibro] = useState('');
  /** Profe elegido para cada código pegado (sin clave = sin profe todavía). */
  const [reparto, setReparto] = useState<Record<string, string | null>>({});
  const [conflictos, setConflictos] = useState<ConflictoCodigo[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(URL_API);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'No se han podido cargar');
        return;
      }
      setFilas(data.filas ?? []);
      setProfes(data.profes ?? []);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const pegado = useMemo(() => analizarPegadoProfes(texto), [texto]);
  const conProfe = pegado.codigos.filter((c) => reparto[c]).length;

  async function guardar() {
    if (pegado.codigos.length === 0) return;
    setOcupado('guardar');
    try {
      const { ok, data } = await post({
        accion: 'guardar',
        items: pegado.codigos.map((codigo) => ({ codigo, eduTeacherId: reparto[codigo] ?? null })),
        libro: libro.trim() || null,
      });
      if (!ok) return;
      const creadas = Number(data.creadas ?? 0);
      const choques = (data.conflictos as ConflictoCodigo[]) ?? [];
      setConflictos(choques);
      if (creadas) {
        haptic.success();
        toast.success(`${creadas} licencia(s) anotadas`);
      }
      if (choques.length) {
        haptic.warning();
        toast.warning(`${choques.length} código(s) ya estaban en la campaña: no se han tocado`);
      }
      setTexto('');
      setReparto({});
      await cargar();
    } finally {
      setOcupado(null);
    }
  }

  async function editar(fila: LicenciaProfeFila, eduTeacherId: string | null) {
    setOcupado(fila.id);
    try {
      const { ok } = await post({ accion: 'editar', id: fila.id, eduTeacherId });
      if (ok) await cargar();
    } finally {
      setOcupado(null);
    }
  }

  async function enviar(fila: LicenciaProfeFila) {
    const aviso = fila.enviadoAt
      ? `Ya se le mandó el ${fecha(fila.enviadoAt)} a ${fila.enviadoA}.\n\n¿Mandárselo otra vez a ${fila.email}?`
      : `¿Mandar el código ${fila.codigo} a ${fila.profe} (${fila.email})?`;
    if (!confirm(aviso)) return;
    setOcupado(fila.id);
    try {
      const { ok } = await post({ accion: 'enviar', id: fila.id });
      if (ok) {
        haptic.success();
        toast.success(`Enviada a ${fila.email}`);
        await cargar();
      } else haptic.warning();
    } finally {
      setOcupado(null);
    }
  }

  async function quitar(fila: LicenciaProfeFila) {
    if (!confirm(`¿Quitar la licencia ${fila.codigo}${fila.profe ? ` de ${fila.profe}` : ''}? No se puede deshacer.`)) return;
    setOcupado(fila.id);
    try {
      const { ok } = await post({ accion: 'borrar', ids: [fila.id] });
      if (ok) {
        toast.success('Quitada');
        await cargar();
      }
    } finally {
      setOcupado(null);
    }
  }

  async function copiar(codigo: string) {
    try {
      await navigator.clipboard.writeText(codigo);
      haptic.tap();
      toast.success('Código copiado');
    } catch {
      toast.error('No se ha podido copiar: selecciónalo a mano');
    }
  }

  if (cargando) {
    return (
      <p className="flex items-center gap-2 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Pegar y repartir ── */}
      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <ClipboardPaste className="h-4 w-4" /> Anotar licencias de profes
          </p>
          <p className="text-xs text-zinc-500">
            Pega los códigos (uno por línea, o la columna del Excel), dile a cada uno de quién es y guarda. Si aún
            no sabes de quién es, guárdalo sin profe y se lo pones luego.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={4}
            placeholder={'XQXN1YG7\nCGJC-CDAF-S9S4-UWRR'}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <label className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Libro (opcional)</span>
            <input
              value={libro}
              onChange={(e) => setLibro(e.target.value)}
              maxLength={120}
              placeholder="Inglés 3ºESO · guía docente"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
            <span className="block text-[11px] text-zinc-400">Sale en el correo al profe. Vale para todos los pegados.</span>
          </label>
        </div>

        {pegado.repetidos.length > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Venían repetidos y se quedan una vez: {pegado.repetidos.map((r) => `${r.codigo} (×${r.veces})`).join(', ')}
          </p>
        )}

        {pegado.codigos.length > 0 && (
          <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
            {pegado.codigos.map((codigo) => (
              <div key={codigo} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
                <code className="min-w-[10rem] font-mono text-sm">{codigo}</code>
                <span className="text-zinc-300">→</span>
                <SelectorProfe
                  profes={profes}
                  valor={reparto[codigo] ?? null}
                  onElegir={(id) => setReparto((r) => ({ ...r, [codigo]: id }))}
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto text-xs text-zinc-500">
            {pegado.codigos.length === 0
              ? 'Nada pegado todavía'
              : `${pegado.codigos.length} código(s) · ${conProfe} con profe`}
          </p>
          <button
            type="button"
            disabled={pegado.codigos.length === 0 || ocupado !== null}
            onClick={() => void guardar()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {ocupado === 'guardar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Guardar
          </button>
        </div>

        {conflictos.length > 0 && (
          <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="font-semibold">Estos no se han guardado porque ya estaban en la campaña:</p>
            <ul className="mt-1 list-disc pl-4">
              {conflictos.map((c) => (
                <li key={c.codigo}>
                  <code className="font-mono">{c.codigo}</code> {c.donde}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Lo anotado ── */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {filas.length === 0 ? (
          <p className="p-6 text-center text-sm text-zinc-500">Todavía no hay ninguna licencia de profe anotada.</p>
        ) : (
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-800/50">
              <tr>
                <th className="px-3 py-2">Profe</th>
                <th className="px-3 py-2">Libro</th>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} className="border-t border-zinc-100 align-middle dark:border-zinc-800">
                  <td className="px-3 py-1.5">
                    <SelectorProfe
                      profes={profes}
                      valor={f.eduTeacherId}
                      disabled={ocupado === f.id}
                      onElegir={(id) => void editar(f, id)}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300">{f.libro || '—'}</td>
                  <td className="px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() => void copiar(f.codigo)}
                      title="Copiar el código"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2 py-1 font-mono text-sm hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                    >
                      {f.codigo} <Copy className="h-3 w-3 text-zinc-400" />
                    </button>
                  </td>
                  <td className="px-3 py-1.5 text-xs">
                    {f.enviadoAt ? (
                      <span className="text-emerald-600 dark:text-emerald-400" title={f.enviadoA ?? undefined}>
                        Enviada {fecha(f.enviadoAt)}
                      </span>
                    ) : (
                      <span className="text-zinc-400">Sin enviar</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right">
                    <button
                      type="button"
                      disabled={!f.eduTeacherId || !f.email || ocupado !== null}
                      onClick={() => void enviar(f)}
                      title={!f.eduTeacherId ? 'Primero elige el profe' : !f.email ? 'Este profe no tiene correo' : undefined}
                      className="mr-1 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-40 dark:text-blue-400 dark:hover:bg-blue-950"
                    >
                      {ocupado === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                      {f.enviadoAt ? 'Reenviar' : 'Enviar al profe'}
                    </button>
                    <button
                      type="button"
                      disabled={ocupado !== null}
                      onClick={() => void quitar(f)}
                      aria-label="Quitar"
                      className="inline-flex items-center rounded-lg p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
