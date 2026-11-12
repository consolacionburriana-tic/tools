'use client';

import { useMemo, useState } from 'react';
import { Loader2, Plus, Search, ShieldAlert, Trash2, UsersRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { MODULE_LABELS, MODULOS_DE_GRUPO, MODULOS_SENSIBLES, moduloDesactivado, type Module } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmarEnLinea } from '@/components/ui/confirmar';
import { Tarjeta, TarjetaCabecera } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';

export interface GrupoVista {
  id: string;
  nombre: string;
  descripcion: string | null;
  modulos: Module[];
  /** Correos de sus miembros, en minúsculas. */
  miembros: string[];
}

export interface PersonaElegible {
  email: string;
  nombre: string | null;
}

/** Lo que guarda la pantalla: el panel avisa al padre para que la vista de personas cambie a la vez. */
type SetGrupos = (fn: (g: GrupoVista[]) => GrupoVista[]) => void;

async function llamar(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch('/api/usuarios/grupos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'No se pudo guardar');
  return data;
}

// Grupos de usuarios: cada grupo da sus módulos a todos sus miembros, ENCIMA de su rol, y se
// puede estar en varios. Lo que da un grupo se da entero (todo el centro). docs/01-auth-roles.md.
export function GruposPanel({
  grupos,
  setGrupos,
  personas,
}: {
  grupos: GrupoVista[];
  setGrupos: SetGrupos;
  personas: PersonaElegible[];
}) {
  const [nuevo, setNuevo] = useState('');
  const [creando, setCreando] = useState(false);

  async function crear() {
    const nombre = nuevo.trim();
    if (!nombre) return;
    setCreando(true);
    try {
      const data = await llamar({ action: 'crear', nombre });
      setGrupos((g) => [...g, data.grupo as GrupoVista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
      setNuevo('');
      haptic.success();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
      haptic.warning();
    } finally {
      setCreando(false);
    }
  }

  return (
    <div className="space-y-3">
      {grupos.length === 0 ? (
        <Vacio icono={<UsersRound />} titulo="Todavía no hay grupos">
          Crea uno (Pastoral, Comunicación…), elige qué módulos da y mete a las personas.
        </Vacio>
      ) : (
        grupos.map((g) => <GrupoTarjeta key={g.id} grupo={g} setGrupos={setGrupos} personas={personas} />)
      )}

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void crear();
        }}
      >
        <Input value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Nombre del grupo nuevo" aria-label="Nombre del grupo nuevo" maxLength={60} />
        <Button type="submit" variant="outline" disabled={creando || !nuevo.trim()}>
          {creando ? <Loader2 aria-hidden className="animate-spin" /> : <Plus aria-hidden />} Crear grupo
        </Button>
      </form>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Un grupo <strong>solo suma</strong>: sus miembros conservan su rol y lo que tuvieran, y además reciben los módulos del
        grupo, enteros (con todo el centro, no solo su etapa). Se puede estar en varios grupos. Para quitarle algo a una
        persona concreta, hazlo desde su fila en «Personas»: lo quitado a mano gana. Los cambios llegan en 15 minutos como
        mucho, sin volver a entrar.
      </p>
    </div>
  );
}

function GrupoTarjeta({ grupo, setGrupos, personas }: { grupo: GrupoVista; setGrupos: SetGrupos; personas: PersonaElegible[] }) {
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const nombrePorEmail = useMemo(() => new Map(personas.map((p) => [p.email, p.nombre])), [personas]);

  const candidatos = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return [];
    return personas
      .filter((p) => !grupo.miembros.includes(p.email))
      .filter((p) => p.email.includes(q) || (p.nombre ?? '').toLowerCase().includes(q))
      .slice(0, 6);
  }, [busqueda, personas, grupo.miembros]);

  /** Cambio optimista + llamada; si falla, se deshace. */
  async function guardar(body: Record<string, unknown>, cambio: (g: GrupoVista) => GrupoVista) {
    setGuardando(true);
    let previo: GrupoVista | undefined;
    setGrupos((gs) =>
      gs.map((g) => {
        if (g.id !== grupo.id) return g;
        previo = g;
        return cambio(g);
      }),
    );
    try {
      await llamar({ id: grupo.id, ...body });
      haptic.tap();
      return true;
    } catch (e) {
      if (previo) setGrupos((gs) => gs.map((g) => (g.id === grupo.id ? previo! : g)));
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
      haptic.warning();
      return false;
    } finally {
      setGuardando(false);
    }
  }

  function alternarModulo(m: Module) {
    const modulos = grupo.modulos.includes(m) ? grupo.modulos.filter((x) => x !== m) : [...grupo.modulos, m];
    return guardar({ action: 'editar', modulos }, (g) => ({ ...g, modulos }));
  }

  function miembro(email: string, dentro: boolean) {
    return guardar({ action: 'miembro', email, dentro }, (g) => ({
      ...g,
      miembros: dentro ? [...g.miembros, email] : g.miembros.filter((e) => e !== email),
    }));
  }

  async function borrar() {
    try {
      await llamar({ action: 'borrar', id: grupo.id });
      setGrupos((gs) => gs.filter((g) => g.id !== grupo.id));
      haptic.success();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
      haptic.warning();
    }
  }

  const visibles = MODULOS_DE_GRUPO.filter((m) => !moduloDesactivado(m));
  const nModulos = grupo.modulos.filter((m) => !moduloDesactivado(m)).length;

  return (
    <Tarjeta as="section" aria-labelledby={`grupo-${grupo.id}`}>
      <TarjetaCabecera
        id={`grupo-${grupo.id}`}
        icono={<UsersRound />}
        titulo={grupo.nombre}
        descripcion={
          <>
            {grupo.miembros.length} {grupo.miembros.length === 1 ? 'persona' : 'personas'} · {nModulos}{' '}
            {nModulos === 1 ? 'módulo' : 'módulos'}
            {grupo.descripcion ? ` · ${grupo.descripcion}` : ''}
          </>
        }
        accion={
          <>
            {guardando && <Loader2 aria-hidden className="h-4 w-4 animate-spin text-zinc-400" />}
            <ConfirmarEnLinea
              etiqueta="Borrar"
              icono={<Trash2 aria-hidden />}
              pregunta={
                <>
                  ¿Borrar el grupo {grupo.nombre}? Sus {grupo.miembros.length} personas pierden los módulos que les daba (lo
                  de su rol y lo dado a mano se queda).
                </>
              }
              confirmar="Sí, borrar el grupo"
              onConfirmar={borrar}
            />
          </>
        }
      />
      <div className="space-y-4 px-4 py-3">
        <div>
          <h3 className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Módulos que da</h3>
          <div className="flex flex-wrap gap-1.5">
            {visibles.map((m) => {
              const activo = grupo.modulos.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  disabled={guardando}
                  onClick={() => void alternarModulo(m)}
                  aria-pressed={activo}
                  className={`inline-flex h-10 items-center gap-1 rounded-lg px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 ${
                    activo
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                  }`}
                >
                  {MODULOS_SENSIBLES.includes(m) && <ShieldAlert aria-label="Con cuidado" className="h-3.5 w-3.5" />}
                  {MODULE_LABELS[m]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Personas</h3>
          {grupo.miembros.length === 0 ? (
            <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">Nadie todavía.</p>
          ) : (
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {grupo.miembros
                .map((email) => ({ email, nombre: nombrePorEmail.get(email) ?? null }))
                .sort((a, b) => (a.nombre ?? a.email).localeCompare(b.nombre ?? b.email, 'es'))
                .map(({ email, nombre }) => (
                  <li
                    key={email}
                    className="inline-flex h-10 items-center gap-1 rounded-full bg-zinc-100 pl-3.5 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                  >
                    <span title={email}>{nombre ?? email}</span>
                    <button
                      type="button"
                      disabled={guardando}
                      onClick={() => void miembro(email, false)}
                      aria-label={`Sacar a ${nombre ?? email} del grupo`}
                      className="inline-flex size-10 items-center justify-center rounded-full text-zinc-500 outline-none hover:text-red-600 focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-zinc-400 dark:hover:text-red-300"
                    >
                      <X aria-hidden className="h-4 w-4" />
                    </button>
                  </li>
                ))}
            </ul>
          )}
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Añadir a alguien: busca por nombre o correo…"
              aria-label={`Añadir a alguien al grupo ${grupo.nombre}`}
              className="pl-9"
            />
          </div>
          {busqueda.trim() && (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {candidatos.length === 0 ? (
                <li className="text-sm text-zinc-500 dark:text-zinc-400">Nadie más con ese nombre.</li>
              ) : (
                candidatos.map((p) => (
                  <li key={p.email}>
                    <Button
                      type="button"
                      variant="suave"
                      size="sm"
                      disabled={guardando}
                      onClick={() => {
                        void miembro(p.email, true);
                        setBusqueda('');
                      }}
                    >
                      <Plus aria-hidden /> {p.nombre ?? p.email}
                    </Button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>
    </Tarjeta>
  );
}
