'use client';

// «Números del cole»: la tabla de recuentos por clase, curso y etapa. Ficha: docs/24-numeros.md
//
// El servidor manda los recuentos por clase ya recortados para quien mira; aquí se hace todo
// lo demás (subtotales, %, pestañas, «lo básico», copiar, imprimir) sin volver a la red.
//
// Pensada para quien no se lleva bien con las pantallas (David, 29-sep-2026: «que no sea muy
// compleja»): se entra viendo lo básico, cada control dice en palabras lo que hace, no hay
// selector de formatos (tres botones: copiar, WhatsApp, imprimir) y tocar un número hace
// siempre lo mismo: enseñar quiénes son.
import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Eye, Hand, Image as ImageIcon, Loader2, Lock, Printer, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { copiarTexto } from '@/components/alumnado/copiable';
import { Historico } from '@/components/numeros/historico';
import { haptic } from '@/lib/haptics';
import { tablaAImagen } from '@/lib/numeros-imagen';
import {
  aHTML,
  aTSV,
  celda,
  clavePapeles,
  columnasVisibles,
  construirTabla,
  COOKIE_PREFERENCIAS,
  escribirLista,
  ETAPA_NOMBRE,
  ETAPAS_ORDEN,
  euros,
  g,
  listaDeColumna,
  llamaLaAtencion,
  nombreClase,
  nombreEnFrase,
  pestanas as construirPestanas,
  sumar,
  tablaCopiable,
  type Columna,
  type DatosNumeros,
  type FilaTabla,
  type Lista,
  type PermisosNumeros,
  type PestanaId,
  type Preferencias,
} from '@/lib/numeros';
import type { Etapa } from '@/lib/cursos';

// Un color por pestaña (en el punto, el borde y la barra) y uno por etapa: poquito, en su sitio.
const COLOR: Record<PestanaId, { punto: string; activo: string; barra: string; hex: string }> = {
  resumen: { punto: 'bg-blue-600 dark:bg-blue-400', activo: 'border-blue-600 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-500/10', barra: 'bg-blue-600 dark:bg-blue-400', hex: '#2563eb' },
  familias: { punto: 'bg-teal-600 dark:bg-teal-400', activo: 'border-teal-600 bg-teal-50/70 dark:border-teal-400 dark:bg-teal-500/10', barra: 'bg-teal-600 dark:bg-teal-400', hex: '#0d9488' },
  banco: { punto: 'bg-green-600 dark:bg-green-400', activo: 'border-green-600 bg-green-50/70 dark:border-green-400 dark:bg-green-500/10', barra: 'bg-green-600 dark:bg-green-400', hex: '#16a34a' },
  materiales: { punto: 'bg-amber-600 dark:bg-amber-400', activo: 'border-amber-600 bg-amber-50/70 dark:border-amber-400 dark:bg-amber-500/10', barra: 'bg-amber-600 dark:bg-amber-400', hex: '#d97706' },
  proteccion: { punto: 'bg-violet-600 dark:bg-violet-400', activo: 'border-violet-600 bg-violet-50/70 dark:border-violet-400 dark:bg-violet-500/10', barra: 'bg-violet-600 dark:bg-violet-400', hex: '#7c3aed' },
  licencias: { punto: 'bg-sky-600 dark:bg-sky-400', activo: 'border-sky-600 bg-sky-50/70 dark:border-sky-400 dark:bg-sky-500/10', barra: 'bg-sky-600 dark:bg-sky-400', hex: '#0284c7' },
  perfil: { punto: 'bg-pink-600 dark:bg-pink-400', activo: 'border-pink-600 bg-pink-50/70 dark:border-pink-400 dark:bg-pink-500/10', barra: 'bg-pink-600 dark:bg-pink-400', hex: '#db2777' },
  datos: { punto: 'bg-red-600 dark:bg-red-400', activo: 'border-red-600 bg-red-50/70 dark:border-red-400 dark:bg-red-500/10', barra: 'bg-red-600 dark:bg-red-400', hex: '#dc2626' },
};

const PUNTO_ETAPA: Record<Etapa, string> = {
  EI: 'bg-[#d97316] dark:bg-[#d4772c]',
  EP: 'bg-[#2563eb] dark:bg-[#4f80ee]',
  ESO: 'bg-[#0e9f6e] dark:bg-[#1f9f6d]',
  BACH: 'bg-[#475569] dark:bg-[#94a3b8]',
};
const FONDO_ETAPA: Record<Etapa, string> = {
  EI: 'bg-orange-50 dark:bg-orange-500/10',
  EP: 'bg-blue-50 dark:bg-blue-500/10',
  ESO: 'bg-emerald-50 dark:bg-emerald-500/10',
  BACH: 'bg-slate-100 dark:bg-slate-500/10',
};

interface Props {
  datos: DatosNumeros;
  permisos: PermisosNumeros;
  /** Etapas de un tutor (se le avisa arriba); vacío si ve todo el cole. */
  etapasPropias: Etapa[];
  preferencias: Preferencias;
  puedeFoto: boolean;
}

function guardarPreferencias(p: Preferencias) {
  try {
    document.cookie = `${COOKIE_PREFERENCIAS}=${encodeURIComponent(JSON.stringify(p))}; path=/gestion/numeros; max-age=31536000; samesite=lax`;
  } catch {
    // Sin cookies: la próxima vez sale como siempre, que tampoco es grave.
  }
}

/** Texto con **negritas** a trozos, sin HTML. */
function ConNegritas({ texto }: { texto: string }) {
  return (
    <>
      {texto.split('**').map((t, i) =>
        i % 2 ? (
          <b key={i} className="font-semibold text-zinc-900 dark:text-zinc-100">
            {t}
          </b>
        ) : (
          <span key={i}>{t}</span>
        ),
      )}
    </>
  );
}

function Segmentos<T extends string>({
  opciones,
  valor,
  onChange,
  etiqueta,
  grande,
}: {
  opciones: readonly (readonly [T, string])[];
  valor: T;
  onChange: (v: T) => void;
  etiqueta: string;
  grande?: boolean;
}) {
  return (
    <div role="group" aria-label={etiqueta} className="inline-flex flex-wrap gap-0.5 rounded-xl border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
      {opciones.map(([v, l]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === valor}
          onClick={() => onChange(v)}
          className={`cursor-pointer whitespace-nowrap rounded-[10px] ${grande ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-[13.5px]'} transition-colors ${
            v === valor
              ? 'bg-white font-semibold text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/** Una etiqueta delante de un grupo de botones: «Ver por», «De». */
function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">{etiqueta}</span>
      {children}
    </div>
  );
}

interface Pedida {
  titulo: string;
  donde: string;
  lista: Lista;
  ambito: string;
  total: number;
}

export function NumerosPanel({ datos, permisos, etapasPropias, preferencias, puedeFoto }: Props) {
  const [vista, setVista] = useState<'hoy' | 'historico'>('hoy');
  const [prefs, setPrefs] = useState<Preferencias>(preferencias);
  const [etapa, setEtapa] = useState<'todo' | Etapa>('todo');
  const [papelCole, setPapelCole] = useState(true);
  const [materialId, setMaterialId] = useState<string | null>(datos.materiales[0]?.id ?? null);
  const [sel, setSel] = useState<string | null>(null);
  const [copiada, setCopiada] = useState<string | null>(null);
  const [imagen, setImagen] = useState<{ url: string; mensaje: string } | null>(null);
  const [pedida, setPedida] = useState<Pedida | null>(null);

  const cambiar = (p: Partial<Preferencias>) => {
    const nuevas = { ...prefs, ...p };
    setPrefs(nuevas);
    guardarPreferencias(nuevas);
  };

  const soloUnaEtapa = etapasPropias.length > 0 || etapa !== 'todo';
  const papel: 'cole' | 'etapa' = soloUnaEtapa || !papelCole ? 'etapa' : 'cole';
  const hayLicencias = permisos.licencias && datos.campana !== null;

  const todas = useMemo(
    () => construirPestanas({ permisos, materiales: datos.materiales, materialId, papel, hayLicencias }),
    [permisos, datos.materiales, materialId, papel, hayLicencias],
  );
  const pestana = todas.find((p) => p.id === prefs.pestana) ?? todas[0];
  const color = COLOR[pestana.id];
  const columnas = columnasVisibles(pestana, prefs.basico);
  // Con lo básico no hay porcentajes: un número es lo que se busca.
  const modo = prefs.basico ? 'n' : prefs.modo;

  const filasClase = useMemo(
    () => (etapa === 'todo' ? datos.filas : datos.filas.filter((f) => f.etapa === etapa)),
    [datos.filas, etapa],
  );
  const tabla = useMemo(() => construirTabla(filasClase, prefs.nivel), [filasClase, prefs.nivel]);
  const filaFrase = tabla.find((f) => f.clave === sel) ?? tabla[tabla.length - 1];
  const frase = filaFrase ? pestana.frase(nombreEnFrase(filaFrase), filaFrase.v) : '';
  const atencion = useMemo(
    () => llamaLaAtencion(pestana.id, filasClase, { papel, materialId, materiales: datos.materiales }),
    [pestana.id, filasClase, papel, materialId, datos.materiales],
  );

  const etapasHay = ETAPAS_ORDEN.filter((e) => datos.filas.some((f) => f.etapa === e));
  const total = sumar(datos.filas);
  const fecha = new Date(datos.generadoAt);
  const fechaLarga = fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' });
  const deQuien = etapa === 'todo' ? (etapasPropias.length ? etapasPropias.map((e) => ETAPA_NOMBRE[e]).join(' y ') : 'todo el cole') : ETAPA_NOMBRE[etapa];
  const subtitulo = `Consolación Burriana · ${deQuien} · ${fechaLarga}`;

  async function copiarValor(texto: string, clave: string) {
    if (await copiarTexto(texto)) {
      haptic.tap();
      setCopiada(clave);
      setTimeout(() => setCopiada((c) => (c === clave ? null : c)), 1400);
    }
  }

  const copiable = () => tablaCopiable(pestana.titulo, subtitulo, prefs.nivel, columnas, tabla, modo);

  async function copiarTabla() {
    const t = copiable();
    const tsv = aTSV(t);
    try {
      // Con las dos versiones: la hoja de cálculo reparte en celdas y el correo o el Doc
      // conservan la tabla con su formato. Un botón para todo.
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([aHTML(t)], { type: 'text/html' }),
          'text/plain': new Blob([tsv], { type: 'text/plain' }),
        }),
      ]);
    } catch {
      if (!(await copiarTexto(tsv))) return toast.error('No se pudo copiar');
    }
    haptic.success();
    toast.success('Tabla copiada. Pégala en Excel, en Drive, en un correo o en un documento.');
  }

  async function paraWhatsapp() {
    const t = copiable();
    const blob = await tablaAImagen(t, color.hex);
    if (!blob) return toast.error('No se pudo hacer la imagen');
    const fichero = new File([blob], `${pestana.titulo}.png`, { type: 'image/png' });
    // En el iPad (pantalla táctil) lo cómodo es «Compartir» → WhatsApp; en el ordenador, al
    // portapapeles para pegar en WhatsApp Web.
    const tactil = window.matchMedia?.('(pointer: coarse)').matches;
    if (tactil && navigator.canShare?.({ files: [fichero] })) {
      try {
        await navigator.share({ files: [fichero], title: pestana.titulo });
        haptic.success();
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      haptic.success();
      toast.success('Imagen copiada. Ve a WhatsApp y pégala en el chat.');
    } catch {
      setImagen({
        url: URL.createObjectURL(blob),
        mensaje: 'Mantén pulsada la imagen para copiarla o guardarla, y luego mándala por WhatsApp.',
      });
    }
  }

  function abrirLista(fila: FilaTabla, col: Columna, valor: number) {
    const lista = listaDeColumna(pestana.id, col.id, { papel, materialId: materialId ?? datos.materiales[0]?.id ?? null });
    if (!lista) return;
    setPedida({
      titulo: col.sub ? `${col.titulo} ${col.sub}` : col.titulo,
      donde: nombreEnFrase(fila),
      lista,
      ambito: fila.clave,
      total: valor,
    });
  }

  const materialActual = datos.materiales.find((m) => m.id === materialId) ?? datos.materiales[0];
  const kpis: { etiqueta: string; valor: number; sub: string; punto: string; barra?: [number, number] }[] = [
    { etiqueta: 'Alumnos', valor: g(total, 'alumnos'), sub: `${datos.filas.length} clases`, punto: COLOR.resumen.punto },
    {
      etiqueta: 'Familias',
      valor: g(total, clavePapeles(etapasPropias.length ? 'etapa' : 'cole')),
      sub: 'un papel por familia',
      punto: COLOR.familias.punto,
    },
    {
      etiqueta: 'Banco de libros',
      valor: g(total, 'banco.si'),
      sub: `de ${g(total, 'banco.alumnos')} que pueden`,
      punto: COLOR.banco.punto,
      barra: [g(total, 'banco.si'), g(total, 'banco.alumnos')],
    },
    { etiqueta: 'AMPA', valor: g(total, 'ampa'), sub: 'alumnos de familias socias', punto: COLOR.banco.punto },
  ];
  if (materialActual && g(total, `mat.${materialActual.id}.van`)) {
    const van = g(total, `mat.${materialActual.id}.van`);
    kpis.push({
      etiqueta: `${materialActual.nombre} pagado`,
      valor: g(total, `mat.${materialActual.id}.pagado`),
      sub: `de ${van}`,
      punto: COLOR.materiales.punto,
      barra: [g(total, `mat.${materialActual.id}.pagado`), van],
    });
  }
  if (hayLicencias) {
    kpis.push({
      etiqueta: 'Pedidos de licencias',
      valor: g(total, 'lic.pedidos'),
      sub: `de ${g(total, 'lic.alumnos')} · ${euros(g(total, 'lic.importe'))}`,
      punto: COLOR.licencias.punto,
      barra: [g(total, 'lic.pedidos'), g(total, 'lic.alumnos')],
    });
  }

  const nombrePrimera = prefs.nivel === 'etapas' ? 'Etapa' : prefs.nivel === 'cursos' ? 'Curso' : 'Clase';
  const boton =
    'inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors';

  return (
    <div className="space-y-5 print:space-y-3">
      {/* Para imprimir: A4 y los colores de las filas tal cual. */}
      <style>{'@media print { @page { size: A4; margin: 12mm } body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact } }'}</style>

      {/* Cabecera: qué es, de cuándo, y Hoy | Histórico */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 print:text-xl">
            Números del cole<span className="hidden print:inline"> · {pestana.titulo}</span>
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Curso {datos.academicYear} · <span className="print:hidden">datos de las{' '}
            {fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })} de hoy</span>
            <span className="hidden print:inline">{deQuien} · {fechaLarga}</span>
          </p>
        </div>
        <div className="print:hidden">
          <Segmentos
            etiqueta="Vista"
            grande
            opciones={[
              ['hoy', 'Hoy'],
              ['historico', 'Cómo ha ido cambiando'],
            ]}
            valor={vista}
            onChange={setVista}
          />
        </div>
      </div>

      {etapasPropias.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-zinc-800 dark:border-emerald-900/60 dark:bg-emerald-500/10 dark:text-zinc-200 print:hidden">
          <Eye className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
          <p>
            <b className="font-semibold">
              Estás viendo {etapasPropias.map((e) => ETAPA_NOMBRE[e]).join(' y ')}, tu etapa.
            </b>{' '}
            {datos.filas.length} clases, {g(total, 'alumnos')} alumnos. Lo de las otras etapas no te sale.
          </p>
        </div>
      )}

      {/* Las cifras del cole, de un vistazo */}
      <section aria-label="El cole de un vistazo" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 print:hidden">
        {kpis.map((k) => (
          <div key={k.etiqueta} className="flex flex-col gap-0.5 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <i className={`h-2 w-2 shrink-0 rounded-full ${k.punto}`} />
              {k.etiqueta}
            </span>
            <span className="text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-100">
              {k.valor.toLocaleString('es-ES')}
            </span>
            <span className="text-xs text-zinc-400">{k.sub}</span>
            {k.barra && k.barra[1] > 0 && (
              <span className="mt-1 h-[3px] overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <span className={`block h-full ${k.punto}`} style={{ width: `${Math.min(100, (k.barra[0] * 100) / k.barra[1])}%` }} />
              </span>
            )}
          </div>
        ))}
      </section>

      {vista === 'historico' ? (
        <Historico permisos={permisos} puedeFoto={puedeFoto} etapasPropias={etapasPropias} />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
          {/* Pestañas: qué se cuenta */}
          <div role="tablist" className="flex gap-0.5 overflow-x-auto border-b border-zinc-200 px-2 pt-2 dark:border-zinc-800 print:hidden">
            {todas.map((p) => {
              const activa = p.id === pestana.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={activa}
                  onClick={() => {
                    cambiar({ pestana: p.id });
                    setSel(null);
                  }}
                  className={`-mb-px flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-t-xl border-b-2 px-3 py-2.5 text-[14px] transition-colors ${
                    activa
                      ? `${COLOR[p.id].activo} font-semibold text-zinc-900 dark:text-zinc-100`
                      : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                  }`}
                >
                  <i className={`h-[7px] w-[7px] rounded-full ${COLOR[p.id].punto}`} />
                  {p.titulo}
                </button>
              );
            })}
          </div>

          {/* Cómo verlo, y qué hacer con ello */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-3 py-3 dark:border-zinc-800 print:hidden">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
              <Campo etiqueta="Ver por">
                <Segmentos
                  etiqueta="Ver por"
                  opciones={[
                    ['etapas', 'Etapa'],
                    ['cursos', 'Curso'],
                    ['clases', 'Clase'],
                  ]}
                  valor={prefs.nivel}
                  onChange={(v) => {
                    cambiar({ nivel: v });
                    setSel(null);
                  }}
                />
              </Campo>
              {etapasHay.length > 1 && (
                <Campo etiqueta="De">
                  <Segmentos
                    etiqueta="De"
                    opciones={[['todo', 'Todo el cole'] as const, ...etapasHay.map((e) => [e, ETAPA_NOMBRE[e]] as const)]}
                    valor={etapa}
                    onChange={(v) => {
                      setEtapa(v);
                      setSel(null);
                    }}
                  />
                </Campo>
              )}
              <button
                type="button"
                aria-pressed={!prefs.basico}
                onClick={() => cambiar({ basico: !prefs.basico })}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[13.5px] transition-colors ${
                  !prefs.basico
                    ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-500/10 dark:text-blue-200'
                    : 'border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                }`}
              >
                <span className={`relative h-[18px] w-[30px] rounded-full transition-colors ${!prefs.basico ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                  <span className={`absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${!prefs.basico ? 'translate-x-3' : ''}`} />
                </span>
                Ver más datos
              </button>
              {!prefs.basico && (
                <Segmentos
                  etiqueta="Números o porcentajes"
                  opciones={[
                    ['n', 'Números'],
                    ['p', 'Porcentajes'],
                  ]}
                  valor={prefs.modo}
                  onChange={(v) => cambiar({ modo: v })}
                />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={copiarTabla} className={`${boton} border-blue-600 bg-blue-600 text-white hover:bg-blue-700`}>
                <Copy className="h-4 w-4" /> Copiar tabla
              </button>
              <button
                type="button"
                onClick={paraWhatsapp}
                className={`${boton} border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800`}
              >
                <ImageIcon className="h-4 w-4" /> WhatsApp
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className={`${boton} border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800`}
              >
                <Printer className="h-4 w-4" /> Imprimir
              </button>
            </div>
          </div>

          <Aviso
            pestana={pestana.id}
            total={sumar(filasClase)}
            soloUnaEtapa={soloUnaEtapa}
            papelCole={papelCole}
            setPapelCole={setPapelCole}
            materiales={datos.materiales}
            materialId={materialActual?.id ?? null}
            setMaterialId={setMaterialId}
            campana={datos.campana}
          />

          <p className="flex items-center gap-2 px-3.5 pt-3 text-[13px] text-zinc-500 dark:text-zinc-400 print:hidden">
            <Hand className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Toca un número para ver quiénes son.
          </p>

          {/* La tabla */}
          <div className="max-h-[70vh] overflow-auto print:max-h-none print:overflow-visible">
            <table className="w-full border-separate border-spacing-0 text-[14px] tabular-nums print:text-[11px]">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-20 min-w-40 border-b border-zinc-200 bg-white px-3 py-2 text-left align-bottom text-[12px] font-semibold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 print:static print:min-w-0">
                    {nombrePrimera}
                  </th>
                  {columnas.map((c) => (
                    <th
                      key={c.id}
                      title={c.candado ?? c.porque}
                      className="sticky top-0 z-10 whitespace-nowrap border-b border-zinc-200 bg-white px-3 py-2 text-right align-bottom text-[12px] font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 print:static"
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.candado && <Lock className="h-3 w-3 text-zinc-400 print:hidden" />}
                        {c.titulo}
                      </span>
                      {c.sub && <span className="block font-normal text-zinc-400">{c.sub}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabla.map((f) => (
                  <FilaVista
                    key={f.clave}
                    fila={f}
                    columnas={columnas}
                    modo={modo}
                    seleccionada={sel === f.clave}
                    onSeleccionar={() => setSel(f.clave)}
                    onAbrir={(c, v) => abrirLista(f, c, v)}
                    tieneLista={(c) => listaDeColumna(pestana.id, c.id, { papel, materialId }) !== null}
                    barra={color.barra}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Debajo: la frase y lo que llama la atención */}
          <div className="grid border-t border-zinc-200 md:grid-cols-2 dark:border-zinc-800 print:block print:border-0">
            <div className="space-y-2 border-b border-zinc-200 p-4 md:border-b-0 md:border-r dark:border-zinc-800 print:border-0 print:px-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 print:hidden">
                Una frase para pegar · toca el nombre de una fila para cambiarla
              </p>
              <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-[14.5px] leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 print:border-0 print:bg-transparent print:p-0 print:text-[12px]">
                {frase}
              </p>
              <button
                type="button"
                onClick={() => copiarValor(frase, 'frase')}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 print:hidden"
              >
                {copiada === 'frase' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                {copiada === 'frase' ? 'Copiada' : 'Copiar la frase'}
              </button>
            </div>
            <div className="space-y-2 p-4 print:hidden">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Lo que llama la atención</p>
              {atencion.length ? (
                <ul className="space-y-1.5 text-[13.5px] text-zinc-600 dark:text-zinc-400">
                  {atencion.map((t) => (
                    <li key={t} className="flex gap-2">
                      <i className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${color.punto}`} />
                      <span>
                        <ConNegritas texto={t} />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-zinc-400">Nada raro con este filtro.</p>
              )}
            </div>
          </div>
        </section>
      )}

      <p className="text-xs text-zinc-400 print:mt-2">
        Contado al abrir la página, con el alumnado activo de la BBDD central. <span className="print:hidden">Números del cole.</span>
      </p>

      {pedida && <QuienesSon pedida={pedida} onCerrar={() => setPedida(null)} />}

      {imagen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Imagen de la tabla"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            URL.revokeObjectURL(imagen.url);
            setImagen(null);
          }}
        >
          <div className="max-h-full max-w-3xl space-y-3 overflow-auto rounded-2xl bg-white p-4 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{imagen.mensaje}</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- es un blob local, no una imagen optimizable */}
            <img src={imagen.url} alt="La tabla como imagen" className="max-w-full rounded-lg border border-zinc-200" />
            <button
              type="button"
              onClick={() => {
                URL.revokeObjectURL(imagen.url);
                setImagen(null);
              }}
              className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilaVista({
  fila,
  columnas,
  modo,
  seleccionada,
  onSeleccionar,
  onAbrir,
  tieneLista,
  barra,
}: {
  fila: FilaTabla;
  columnas: Columna[];
  modo: 'n' | 'p';
  seleccionada: boolean;
  onSeleccionar: () => void;
  onAbrir: (c: Columna, valor: number) => void;
  tieneLista: (c: Columna) => boolean;
  barra: string;
}) {
  const grupo = fila.tipo !== 'clase' && !(fila.tipo === 'curso' && !fila.nombre.startsWith('Total'));
  const fondo =
    fila.tipo === 'total'
      ? 'bg-zinc-100 dark:bg-zinc-800'
      : fila.tipo === 'etapa' && fila.etapa
        ? FONDO_ETAPA[fila.etapa]
        : fila.tipo === 'curso' && grupo
          ? 'bg-zinc-50 dark:bg-zinc-900/60'
          : 'bg-white dark:bg-zinc-900';
  const anillo = seleccionada ? 'shadow-[inset_0_1px_0_#2563eb,inset_0_-1px_0_#2563eb] print:shadow-none' : '';
  return (
    <tr className={`${fondo} break-inside-avoid`}>
      <td
        className={`sticky left-0 z-[1] cursor-pointer border-b border-zinc-200 px-3 py-2 dark:border-zinc-800 print:static print:py-1 ${fondo} ${
          seleccionada ? 'shadow-[inset_3px_0_0_#2563eb,inset_0_1px_0_#2563eb,inset_0_-1px_0_#2563eb] print:shadow-none' : ''
        } ${fila.tipo === 'clase' ? 'pl-8 text-zinc-600 dark:text-zinc-400' : grupo ? 'font-semibold text-zinc-900 dark:text-zinc-100' : 'text-zinc-800 dark:text-zinc-200'}`}
        onClick={onSeleccionar}
      >
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          {fila.tipo !== 'clase' && fila.tipo !== 'total' && fila.etapa && (
            <i className={`h-2 w-2 shrink-0 rounded-full ${PUNTO_ETAPA[fila.etapa]}`} />
          )}
          {fila.nombre}
        </span>
      </td>
      {columnas.map((c) => {
        const cel = celda(c, fila, modo);
        const abre = !cel.vacia && (cel.valor ?? 0) > 0 && tieneLista(c);
        const tono =
          cel.vacia || !cel.valor
            ? 'text-zinc-400 dark:text-zinc-600'
            : c.tono === 'rojo'
              ? 'font-semibold text-red-600 dark:text-red-400'
              : c.tono === 'ambar'
                ? 'font-semibold text-amber-600 dark:text-amber-400'
                : '';
        return (
          <td
            key={c.id}
            className={`whitespace-nowrap border-b border-zinc-200 px-3 py-2 text-right dark:border-zinc-800 print:py-1 ${anillo} ${grupo ? 'font-semibold' : ''} ${tono} ${
              abre ? 'cursor-pointer hover:bg-blue-50 hover:text-blue-700 hover:underline hover:underline-offset-2 dark:hover:bg-blue-500/10 dark:hover:text-blue-300' : ''
            }`}
            onClick={abre ? () => onAbrir(c, cel.valor ?? 0) : undefined}
            title={abre ? 'Ver quiénes son' : undefined}
          >
            {cel.texto}
            {!cel.vacia && modo === 'n' && c.barra && cel.pct !== null && fila.tipo !== 'clase' && (
              <span className="ml-1.5 text-[11.5px] font-normal text-zinc-400">{Math.round(cel.pct)} %</span>
            )}
            {!cel.vacia && c.barra && cel.pct !== null && (
              <span className="mt-1 block h-[3px] overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800 print:hidden">
                <span className={`block h-full ${barra}`} style={{ width: `${Math.min(100, cel.pct)}%` }} />
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

interface AlumnoQuien {
  id: string;
  nombre: string;
  curso: string;
  letra: string | null;
}

/** La lista de «quiénes son», con su ficha en Alumnado a un toque. */
function QuienesSon({ pedida, onCerrar }: { pedida: Pedida; onCerrar: () => void }) {
  const [estado, setEstado] = useState<{ cargando: boolean; alumnos: AlumnoQuien[] | null; error: boolean }>({
    cargando: true,
    alumnos: null,
    error: false,
  });
  const [copiada, setCopiada] = useState(false);

  useEffect(() => {
    let vivo = true;
    const q = new URLSearchParams({ lista: escribirLista(pedida.lista), ambito: pedida.ambito });
    fetch(`/api/numeros/quienes?${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { alumnos: AlumnoQuien[] }) => vivo && setEstado({ cargando: false, alumnos: j.alumnos, error: false }))
      .catch(() => vivo && setEstado({ cargando: false, alumnos: null, error: true }));
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', esc);
    return () => {
      vivo = false;
      window.removeEventListener('keydown', esc);
    };
  }, [pedida, onCerrar]);

  const alumnos = estado.alumnos ?? [];
  const varias = new Set(alumnos.map((a) => `${a.curso}|${a.letra}`)).size > 1;

  async function copiar() {
    const texto = alumnos.map((a) => (varias ? `${a.nombre}\t${nombreClase(a.curso, a.letra)}` : a.nombre)).join('\n');
    if (await copiarTexto(texto)) {
      haptic.tap();
      setCopiada(true);
      setTimeout(() => setCopiada(false), 1400);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Quiénes son" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4 print:hidden" onClick={onCerrar}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div>
            <p className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Users className="h-3.5 w-3.5" /> Quiénes son
            </p>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {pedida.titulo} · {pedida.donde}
            </h2>
            <p className="text-sm text-zinc-500">
              {estado.cargando ? `${pedida.total} alumnos` : `${alumnos.length} ${alumnos.length === 1 ? 'alumno' : 'alumnos'}`}
            </p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="cursor-pointer rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {estado.cargando ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
            </div>
          ) : estado.error ? (
            <p className="p-6 text-sm text-red-600">No se pudo sacar la lista. Vuelve a probar.</p>
          ) : alumnos.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">No hay nadie.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {alumnos.map((a) => (
                <li key={a.id}>
                  <a
                    href={`/gestion/alumnado?alumno=${a.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-[14.5px] text-zinc-800 hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-blue-500/10"
                  >
                    <span>{a.nombre}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-zinc-400">
                      {varias && nombreClase(a.curso, a.letra)}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <span className="text-xs text-zinc-400">Toca un nombre para abrir su ficha</span>
          <button
            type="button"
            onClick={copiar}
            disabled={!alumnos.length}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {copiada ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiada ? 'Copiada' : 'Copiar la lista'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Aviso({
  pestana,
  total,
  soloUnaEtapa,
  papelCole,
  setPapelCole,
  materiales,
  materialId,
  setMaterialId,
  campana,
}: {
  pestana: PestanaId;
  total: ReturnType<typeof sumar>;
  soloUnaEtapa: boolean;
  papelCole: boolean;
  setPapelCole: (v: boolean) => void;
  materiales: DatosNumeros['materiales'];
  materialId: string | null;
  setMaterialId: (id: string) => void;
  campana: DatosNumeros['campana'];
}) {
  const caja = 'flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-200 px-3.5 py-2.5 text-[13px] dark:border-zinc-800 print:hidden';
  if (pestana === 'familias') {
    return (
      <div className={`${caja} bg-teal-50/60 text-zinc-700 dark:bg-teal-500/5 dark:text-zinc-300`}>
        <p className="min-w-60 flex-1">
          Cuántos papeles hacen falta para dar <b className="font-semibold">uno por familia, al hermano mayor</b>.
        </p>
        {!soloUnaEtapa && (
          <Campo etiqueta="El papel es para">
            <Segmentos
              etiqueta="El papel es para"
              opciones={[
                ['cole', 'Todo el cole'],
                ['etapa', 'Cada etapa por separado'],
              ]}
              valor={papelCole ? 'cole' : 'etapa'}
              onChange={(v) => setPapelCole(v === 'cole')}
            />
          </Campo>
        )}
      </div>
    );
  }
  if (pestana === 'banco' && g(total, 'banco.fuera') > 0) {
    return (
      <div className={`${caja} bg-amber-50 text-zinc-800 dark:bg-amber-500/10 dark:text-zinc-200`}>
        <p>
          <b className="font-semibold">{g(total, 'banco.fuera')} alumnos tienen el banco marcado en un curso que no lo tiene</b>{' '}
          (Infantil o 1º-2º EP). Aquí no cuentan; se desmarcan desde Alumnado.
        </p>
      </div>
    );
  }
  if (pestana === 'materiales' && materiales.length > 1) {
    return (
      <div className={`${caja} bg-amber-50/60 dark:bg-amber-500/5`}>
        <Campo etiqueta="Material">
          <Segmentos
            etiqueta="Material"
            opciones={materiales.map((m) => [m.id, m.nombre] as const)}
            valor={materialId ?? materiales[0].id}
            onChange={setMaterialId}
          />
        </Campo>
      </div>
    );
  }
  if (pestana === 'licencias' && campana) {
    return (
      <div className={`${caja} bg-sky-50/60 text-zinc-700 dark:bg-sky-500/5 dark:text-zinc-300`}>
        <p>
          <Lock className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
          {campana.nombre} · solo lo ven TIC, secretaría y dirección, mientras la campaña esté abierta.
        </p>
      </div>
    );
  }
  return null;
}
