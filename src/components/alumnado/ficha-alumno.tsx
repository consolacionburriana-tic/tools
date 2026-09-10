'use client';

// La ficha de un alumno. El orden de la pantalla ES la decisión de diseño, y va de arriba
// abajo por «cuántas veces al año alguien abre esto para eso»:
//
//  1. QUIÉN ES         · nombre, clase, nº de lista, tutores, edad. La cabecera.
//  2. LO QUE HAY QUE SABER YA · banco de libros, pedido de licencias, AMPA, retrasos…
//     en chips grandes y de color: es la pregunta que se hace en la puerta del aula.
//  3. A QUIÉN LLAMO    · familias, con llamar / WhatsApp / correo / copiar a un toque.
//     Es lo que más se usa y por eso está antes que cualquier identificador.
//  4. IDENTIFICADORES  · NIA, DNI, código… todo copiable. El segundo uso más común.
//  5. FAMILIA Y CASA   · hermanos en el centro y domicilio.
//  6. HISTORIAL        · lo de cada módulo, plegado y en frío.
//
// Los bloques sin datos NO se pintan como tarjeta vacía: desaparecen o se quedan en una
// línea gris. Una ficha de infantil tiene la mitad de secciones que una de 4º de ESO, y
// tiene que verse igual de acabada.

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookMarked,
  Cake,
  ChevronDown,
  ClipboardList,
  Heart,
  Library,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Users,
  X,
} from 'lucide-react';
import { Copiable, CopiarLista, Dato } from '@/components/alumnado/copiable';
import { avisoCumple, colorAvatar, edadEnAnios, iniciales, telefono, whatsapp } from '@/lib/alumnado';
import type { FichaAlumno } from '@/lib/alumnado-server';
import { haptic } from '@/lib/haptics';

const fecha = (iso: string | null | undefined, conAnio = true) => {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', ...(conAnio ? { year: 'numeric' } : {}) });
};

// Comprobado contra los 639 activos: Educamos manda solo 'M' y 'F', y la M es de
// **masculino**, no de mujer. Se deja 'V' por si algún día llega un export con «varón».
const SEXO: Record<string, string> = { M: 'Chico', V: 'Chico', F: 'Chica' };

export function FichaAlumnoPanel({
  ficha,
  cargando,
  onCerrar,
  onIrA,
}: {
  ficha: FichaAlumno | null;
  cargando: boolean;
  onCerrar: () => void;
  onIrA: (id: string) => void;
}) {
  if (cargando && !ficha) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Abriendo la ficha…
      </div>
    );
  }
  if (!ficha) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 px-6 text-center">
        <Users className="h-8 w-8 text-zinc-300 dark:text-zinc-700" />
        <p className="text-sm text-zinc-400">Elige un alumno de la lista para ver su ficha.</p>
      </div>
    );
  }

  const edad = edadEnAnios(ficha.fechaNacimiento);
  const cumple = avisoCumple(ficha.fechaNacimiento);
  const correosFamilia = ficha.familiares.filter((f) => !f.fallecido).flatMap((f) => f.correos);

  return (
    <div className={`space-y-3 ${cargando ? 'opacity-60 transition-opacity' : ''}`}>
      {/* ── 1 · Quién es ─────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold ${colorAvatar(ficha.id)}`}
        >
          {iniciales(ficha.nombre, ficha.apellidos)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="min-w-0 text-lg font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
              <Copiable valor={ficha.completo} etiqueta="nombre completo" className="-ml-1.5" multilinea>
                {ficha.completo}
              </Copiable>
            </h2>
            <button
              type="button"
              onClick={onCerrar}
              className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 lg:hidden dark:hover:bg-zinc-800"
              aria-label="Cerrar la ficha"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-zinc-500">
            <span className="font-medium text-zinc-700 dark:text-zinc-200">{ficha.clase}</span>
            {ficha.numero !== null && <span className="text-zinc-400">nº {ficha.numero}</span>}
            {edad !== null && <span>· {edad} años</span>}
            {ficha.sexo && SEXO[ficha.sexo] && <span>· {SEXO[ficha.sexo]}</span>}
          </p>
          {ficha.tutores.length > 0 && (
            <p className="mt-0.5 text-xs text-zinc-400">
              Tutor/a: {ficha.tutores.map((t) => t.nombre).join(' · ')}
              {ficha.tutorPersonal && ficha.tutores.length > 1 && (
                <span className="text-zinc-500"> · personal: {ficha.tutorPersonal}</span>
              )}
            </p>
          )}
          {cumple && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-lg bg-pink-50 px-2 py-0.5 text-xs font-medium text-pink-700 dark:bg-pink-950/40 dark:text-pink-300">
              <Cake className="h-3 w-3" /> {cumple}
            </p>
          )}
        </div>
      </div>

      {/* ── 2 · Lo que hay que saber ya ──────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        <Chip
          tono={ficha.bancoLibros ? 'verde' : 'gris'}
          icono={<Library className="h-3.5 w-3.5" />}
          texto={ficha.bancoLibros ? 'Banco de libros' : 'Sin banco de libros'}
          detalle={ficha.banco ? `lote ${ficha.banco.lote}${ficha.banco.entregado ? ' · entregado' : ' · sin entregar'}` : undefined}
        />
        {ficha.licencias?.participa && (
          <Chip
            tono={ficha.licencias.pedidoHecho ? 'azul' : 'ambar'}
            icono={<BookMarked className="h-3.5 w-3.5" />}
            texto={ficha.licencias.pedidoHecho ? 'Licencias pedidas' : 'Licencias pendientes'}
            detalle={
              ficha.licencias.pedidoHecho
                ? [ficha.licencias.total && `${ficha.licencias.total} €`, ficha.licencias.pagadoAt && 'pagado']
                    .filter(Boolean)
                    .join(' · ') || undefined
                : ficha.licencias.campana
            }
          />
        )}
        {ficha.ampa && <Chip tono="violeta" icono={<Heart className="h-3.5 w-3.5" />} texto="AMPA" />}
        {ficha.familiaNumerosa && <Chip tono="violeta" texto="Familia numerosa" />}
        {ficha.hijoDeEmpleado && <Chip tono="violeta" texto="Hijo/a de empleado" />}
        {ficha.puntualidad && (
          <Chip
            tono={ficha.puntualidad.consecuenciasPendientes > 0 ? 'rojo' : 'ambar'}
            icono={<AlertTriangle className="h-3.5 w-3.5" />}
            texto={`${ficha.puntualidad.retrasos} retraso${ficha.puntualidad.retrasos === 1 ? '' : 's'}`}
            detalle={
              ficha.puntualidad.consecuenciasPendientes > 0
                ? `${ficha.puntualidad.consecuenciasPendientes} consecuencia(s) sin cumplir`
                : undefined
            }
          />
        )}
        {ficha.abc.informes > 0 && (
          <Chip
            tono="teal"
            icono={<ClipboardList className="h-3.5 w-3.5" />}
            texto={`${ficha.abc.informes} registro(s) ABC`}
            detalle={fecha(ficha.abc.ultimo) ?? undefined}
          />
        )}
        {ficha.apoyos.length > 0 && <Chip tono="teal" texto={`Apoyo (${ficha.apoyos.map((a) => a.modalidad).join(', ')})`} />}
      </div>

      {/* ── 3 · A quién llamo ────────────────────────────────────────── */}
      <Tarjeta
        titulo="Contacto de la familia"
        accion={<CopiarLista valores={correosFamilia} etiqueta="Copiar correos" />}
      >
        {ficha.familiares.length === 0 ? (
          <p className="text-sm text-zinc-400">No hay familiares registrados en la BBDD central.</p>
        ) : (
          <div className="space-y-2.5">
            {ficha.familiares.map((f) => (
              <Familiar key={f.id} familiar={f} />
            ))}
          </div>
        )}
        {(ficha.telEmergencia || ficha.moviles.length > 0 || ficha.email) && (
          <div className="mt-3 space-y-0.5 border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Del alumno</p>
            {ficha.telEmergencia && <Telefono etiqueta="Emergencias" valor={ficha.telEmergencia} />}
            {ficha.moviles.map((m, i) => (
              <Telefono key={m} etiqueta={`Móvil${ficha.moviles.length > 1 ? ` ${i + 1}` : ''}`} valor={m} />
            ))}
            {ficha.email && <Correo etiqueta="Correo" valor={ficha.email} />}
            {ficha.emailGoogle && ficha.emailGoogle !== ficha.email && (
              <Correo etiqueta="Correo Google" valor={ficha.emailGoogle} />
            )}
          </div>
        )}
      </Tarjeta>

      {/* ── 4 · Identificadores ──────────────────────────────────────── */}
      <Tarjeta titulo="Identificadores">
        <Dato etiqueta="NIA" valor={ficha.nia} mono />
        <Dato etiqueta="DNI" valor={ficha.dni} mono />
        <Dato etiqueta="Nombre legal" valor={ficha.legal !== ficha.completo ? ficha.legal : null} />
        <Dato etiqueta="Nacimiento" valor={ficha.fechaNacimiento ?? undefined}>
          {fecha(ficha.fechaNacimiento)}
        </Dato>
        <Dato etiqueta="Tarjeta sanitaria" valor={ficha.tarjetaSanitaria} mono />
        <Dato etiqueta="Código" valor={ficha.codigo} mono />
        <Dato etiqueta="Matrícula" valor={ficha.matricula} mono />
      </Tarjeta>

      {/* ── 5 · Familia y casa ───────────────────────────────────────── */}
      {(ficha.hermanos.length > 0 || ficha.domicilio) && (
        <Tarjeta titulo="Familia y domicilio">
          {ficha.hermanos.length > 0 && (
            <div className="mb-2">
              <p className="mb-1 text-xs text-zinc-400">
                {ficha.hermanos.length === 1 ? 'Hermano/a en el centro' : `${ficha.hermanos.length} hermanos en el centro`}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ficha.hermanos.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => {
                      haptic.tap();
                      onIrA(h.id);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  >
                    {h.completo} <span className="text-zinc-400">{h.clase}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {ficha.domicilio && (
            <div className="flex items-baseline justify-between gap-2">
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-zinc-400">
                <MapPin className="h-3 w-3" /> Domicilio
              </span>
              <Copiable
                valor={ficha.domicilio.completo}
                etiqueta="domicilio"
                className="min-w-0 text-right text-sm text-zinc-800 dark:text-zinc-100"
              >
                <span className="block truncate">{ficha.domicilio.calle}</span>
              </Copiable>
            </div>
          )}
          {ficha.domicilio?.poblacion && (
            <p className="text-right text-xs text-zinc-400">{ficha.domicilio.poblacion}</p>
          )}
          {(ficha.lugarNacimiento || ficha.nacionalidad) && (
            <p className="mt-1.5 border-t border-zinc-100 pt-1.5 text-xs text-zinc-400 dark:border-zinc-800">
              Nacido/a en {[ficha.lugarNacimiento, ficha.provinciaNacimiento, ficha.paisNacimiento].filter(Boolean).join(', ')}
              {ficha.nacionalidad && ` · nacionalidad ${ficha.nacionalidad.toLowerCase()}`}
            </p>
          )}
        </Tarjeta>
      )}

      {/* ── 6 · Historial, en frío ───────────────────────────────────── */}
      <Historial ficha={ficha} />
    </div>
  );
}

// ─── Piezas ───────────────────────────────────────────────────────────────────

const TONOS = {
  verde: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  azul: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900',
  ambar: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  rojo: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900',
  violeta: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900',
  teal: 'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-900',
  gris: 'bg-zinc-100 text-zinc-500 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700',
} as const;

function Chip({
  tono,
  texto,
  detalle,
  icono,
}: {
  tono: keyof typeof TONOS;
  texto: string;
  detalle?: string;
  icono?: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset ${TONOS[tono]}`}
    >
      {icono}
      {texto}
      {detalle && <span className="font-normal opacity-70">· {detalle}</span>}
    </span>
  );
}

export function Tarjeta({
  titulo,
  accion,
  children,
}: {
  titulo: string;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-3.5 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{titulo}</h3>
        {accion}
      </div>
      {children}
    </section>
  );
}

const PARENTESCO: Record<string, string> = { MADRE: 'Madre', PADRE: 'Padre', OTROS: 'Otro familiar', 'TUTOR LEGAL': 'Tutor legal' };

function Familiar({ familiar }: { familiar: FichaAlumno['familiares'][number] }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-2.5 dark:bg-zinc-800/50">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <Copiable valor={familiar.nombre} etiqueta="nombre" className="-ml-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {familiar.nombre}
        </Copiable>
        <span className="text-xs text-zinc-400">
          {familiar.parentesco ? (PARENTESCO[familiar.parentesco] ?? familiar.parentesco.toLowerCase()) : 'familiar'}
        </span>
        {familiar.guardaCustodia && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            guarda y custodia
          </span>
        )}
        {familiar.recibeInformacion === false && (
          <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
            no recibe información
          </span>
        )}
      </div>

      {familiar.fallecido ? (
        // Educamos marca al tutor fallecido y hay uno en el listado real. No se le ofrecen
        // botones de llamar ni de escribir: que la app invite a llamar a alguien que ha
        // muerto es exactamente el tipo de fallo que no se puede permitir.
        <p className="mt-1 text-xs italic text-zinc-400">Marcado como fallecido en Educamos.</p>
      ) : (
        <div className="mt-1 space-y-0.5">
          {familiar.telefonos.map((t) => (
            <Telefono key={`${t.etiqueta}-${t.valor}`} etiqueta={t.etiqueta} valor={t.valor} />
          ))}
          {familiar.correos.map((c) => (
            <Correo key={c} etiqueta="Correo" valor={c} />
          ))}
          {familiar.telefonos.length === 0 && familiar.correos.length === 0 && (
            <p className="text-xs italic text-zinc-400">Sin teléfono ni correo en la BBDD.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Teléfono: el número copia al tocarlo, y al lado los dos gestos que se hacen con él. */
function Telefono({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const tel = telefono(valor);
  if (!tel) return null;
  const wa = whatsapp(valor);
  return (
    <div className="flex min-w-0 items-center justify-between gap-1">
      <span className="shrink-0 text-xs text-zinc-400">{etiqueta}</span>
      <div className="flex min-w-0 items-center gap-0.5">
        <Copiable valor={tel.texto} etiqueta={etiqueta} mono className="text-sm text-zinc-800 dark:text-zinc-100" />
        {tel.tel && (
          <a
            href={`tel:${tel.tel}`}
            title="Llamar"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
          >
            <Phone className="h-3.5 w-3.5" />
          </a>
        )}
        {wa && (
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noreferrer"
            title="WhatsApp"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-950 dark:hover:text-emerald-300"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

function Correo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-1">
      <span className="shrink-0 text-xs text-zinc-400">{etiqueta}</span>
      <div className="flex min-w-0 items-center gap-0.5">
        <Copiable valor={valor} etiqueta={etiqueta} className="min-w-0 text-sm text-zinc-800 dark:text-zinc-100" />
        <a
          href={`mailto:${valor}`}
          title="Escribir"
          className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
        >
          <Mail className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

const ESTADO_LIBRO: Record<string, string> = {
  nuevo: 'Nuevo',
  mb: 'Muy bueno',
  b: 'Bueno',
  r: 'Regular',
  m: 'Malo',
  mojado: 'Mojado',
};

/**
 * El historial va plegado: son datos de consulta, no de decisión rápida, y desplegado
 * empujaría el contacto fuera de la pantalla en un iPad. Se abre solo si hay algo dentro.
 */
function Historial({ ficha }: { ficha: FichaAlumno }) {
  const [abierto, setAbierto] = useState(false);
  const bloques = useMemo(() => {
    const b: { titulo: string; contenido: React.ReactNode }[] = [];
    if (ficha.licencias?.participa && ficha.licencias.libros.length > 0) {
      b.push({
        titulo: `Licencias · ${ficha.licencias.campana}`,
        contenido: (
          <ul className="space-y-0.5">
            {ficha.licencias.libros.map((l, i) => (
              <li key={`${l.cod}-${i}`} className="flex gap-2 text-xs">
                <span className="font-mono text-zinc-400">{l.cod}</span>
                <span className="min-w-0 flex-1 text-zinc-700 dark:text-zinc-200">{l.nombre ?? l.asignatura ?? '—'}</span>
                {l.banco && <span className="text-emerald-600 dark:text-emerald-400">banco</span>}
              </li>
            ))}
          </ul>
        ),
      });
    }
    if (ficha.banco) {
      b.push({
        titulo: `Banco de libros · lote ${ficha.banco.lote}`,
        contenido: (
          <div className="space-y-1 text-xs">
            <p className="text-zinc-500">
              {ficha.banco.entregado ? 'Entregado' : 'Sin entregar'} · doc. inicio{' '}
              {ficha.banco.docInicio ? 'sí' : 'no'} · doc. fin {ficha.banco.docFin ? 'sí' : 'no'}
            </p>
            {ficha.banco.notas && <p className="text-zinc-500 italic">{ficha.banco.notas}</p>}
            {ficha.banco.libros.length > 0 ? (
              <ul className="space-y-0.5">
                {ficha.banco.libros.map((l) => (
                  <li key={l.nombre} className="flex gap-2">
                    <span className="min-w-0 flex-1 text-zinc-700 dark:text-zinc-200">{l.nombre}</span>
                    {l.estado && <span className="text-zinc-500">{ESTADO_LIBRO[l.estado] ?? l.estado}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-zinc-400">Los libros del lote aún no están valorados.</p>
            )}
          </div>
        ),
      });
    }
    if (ficha.puntualidad) {
      b.push({
        titulo: 'Puntualidad',
        contenido: (
          <p className="text-xs text-zinc-500">
            {ficha.puntualidad.retrasos} retraso(s) este curso, {ficha.puntualidad.minutosTotales} min en total,{' '}
            {ficha.puntualidad.justificados} justificado(s). Último: {fecha(ficha.puntualidad.ultimo) ?? '—'}.
          </p>
        ),
      });
    }
    if (ficha.salidas.length > 0) {
      b.push({
        titulo: 'Salidas',
        contenido: (
          <ul className="space-y-0.5 text-xs">
            {ficha.salidas.map((s, i) => (
              <li key={`${s.nombre}-${i}`} className="flex gap-2">
                <span className="min-w-0 flex-1 text-zinc-700 dark:text-zinc-200">{s.nombre}</span>
                <span className="text-zinc-400">{fecha(s.fecha) ?? ''}</span>
                <span className={s.estado === 'no_va' ? 'text-zinc-400' : 'text-emerald-600 dark:text-emerald-400'}>
                  {s.estado === 'no_va' ? 'no va' : 'apuntado'}
                </span>
                {s.justificante && <span className="text-zinc-500">{s.justificante}</span>}
              </li>
            ))}
          </ul>
        ),
      });
    }
    if (ficha.apoyos.length > 0) {
      b.push({
        titulo: 'Apoyos',
        contenido: (
          <ul className="space-y-0.5 text-xs text-zinc-600 dark:text-zinc-300">
            {ficha.apoyos.map((a, i) => (
              <li key={i}>
                {a.modalidad === 'dentro' ? 'Dentro del aula' : 'Fuera del aula'}
                {a.notas ? ` · ${a.notas}` : ''}
              </li>
            ))}
          </ul>
        ),
      });
    }
    if (ficha.extraSinColocar.length > 0) {
      b.push({
        titulo: 'Otros datos del export',
        contenido: (
          <dl className="space-y-0.5 text-xs">
            {ficha.extraSinColocar.map((e) => (
              <div key={e.clave} className="flex justify-between gap-2">
                <dt className="text-zinc-400">{e.clave}</dt>
                <dd className="text-zinc-700 dark:text-zinc-200">{e.valor}</dd>
              </div>
            ))}
          </dl>
        ),
      });
    }
    return b;
  }, [ficha]);

  if (bloques.length === 0) {
    return (
      <p className="px-1 pb-2 text-xs text-zinc-400">
        Todavía no hay historial de módulos para este alumno (ni retrasos, ni salidas, ni valoración de libros).
      </p>
    );
  }

  return (
    <section className="rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <button
        type="button"
        onClick={() => {
          haptic.tap();
          setAbierto((a) => !a);
        }}
        className="flex w-full items-center gap-2 p-3.5 text-left"
      >
        <h3 className="flex-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Historial <span className="font-normal text-zinc-400">· {bloques.length} bloque(s)</span>
        </h3>
        <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto && (
        <div className="space-y-3 border-t border-zinc-100 p-3.5 dark:border-zinc-800">
          {bloques.map((b) => (
            <div key={b.titulo}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{b.titulo}</p>
              {b.contenido}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Atajo de teclado global: Esc cierra la ficha. `onEscape` tiene que venir estable (un
 * `useCallback`), que es como lo pasa el panel.
 */
export function useEscape(activo: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!activo) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [activo, onEscape]);
}
