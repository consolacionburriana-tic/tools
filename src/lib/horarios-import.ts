// Adaptador de importación de horarios (helpers puros, sin IO). Ficha: docs/07-horarios.md
//
// ─── Qué formato se importa y por qué ────────────────────────────────────────
//
// El colegio tiene hoy CUATRO ficheros de horarios y no dicen lo mismo:
//
//   1. "Horario general del colegio" (.xlsx)  — una matriz profe × franja de TODO el
//      centro, pero la celda solo trae el GRUPO ('2PRIA'): ni materia ni aula. A cambio,
//      sus tres primeras filas son LAS TRES REJILLAS reales (infantil, primaria, ESO) con
//      sus horas día a día. Se usa para eso —sembrar rejillas— y como red de seguridad
//      para comprobar cobertura, no como fuente de los horarios.
//   2. "Horarios Primaria Sept/Junio" (.xlsx) — export de Educamos "HORARIO DE CLASE" y
//      "HORARIO DE PROFESOR", una hoja por clase y por profe. Celda 'MATERIA - PROFE'.
//      Es el periodo corto de septiembre/junio (4 sesiones + recreo).
//   3. "Horarios Inf. y Prim." (.docx)        — el MISMO export de Educamos, pero del
//      periodo ordinario y **con aula**: 'EFI1 - SDOM0 - Poli2'. Es el más completo.
//   4. El mismo, en .pdf                      — para imprimir. No se parsea.
//
// **El adaptador apunta al bloque "HORARIO DE CLASE" de Educamos** (2 y 3), porque es el
// único formato que trae materia, profe y aula, y porque su estructura lógica es IDÉNTICA
// en .xlsx y en .docx: un título, una fila de días, filas 'De HH:MM a HH:MM' y, al final,
// las leyendas. Por eso este fichero no lee ficheros: recibe una **cuadrícula de texto**
// (`string[][]`) que produce quien sepa abrir cada formato (SheetJS para xlsx, extracción
// de tablas para docx) y la normaliza. Un formato nuevo = un lector nuevo, no un
// importador nuevo.
//
// ─── La leyenda es la que desambigua ─────────────────────────────────────────
//
// Una celda es 'MATERIA - PROFE' o 'MATERIA - PROFE - AULA', y por regex no hay forma
// honesta de saber si 'POLI' es un profe o un aula. Pero cada bloque trae al final sus
// propias leyendas ('Profesores:', 'Aulas:', 'Materias:'), así que se resuelve MIRÁNDOLAS,
// no adivinando. Lo que no esté en ninguna leyenda se reporta como incidencia en vez de
// colarse mal.

import { type TipoTramo } from '@/lib/horarios';

/** Una celda ya interpretada: lo que se convertirá en asignación + sesión. */
export interface SesionImportada {
  dia: number; // 1 = lunes … 5 = viernes
  orden: number; // posición del tramo dentro del día (incluye recreos y comedor)
  horaInicio: string;
  horaFin: string;
  tipoTramo: TipoTramo;
  /** Grupos a los que va. En un horario de clase es siempre el del título del bloque. */
  grupos: { curso: string; letra: string | null }[];
  materiaCodigo: string | null;
  profeCodigos: string[];
  aulaCodigo: string | null;
  actividadCodigo: string; // 'clase' | 'apoyo_pt' | 'apoyo_al'
  /** El texto original de la celda. Se guarda siempre: es lo que se enseña al revisar. */
  crudo: string;
}

/** Lo que sale de UNA celda: puede haber más de una cosa a la misma hora. */
export type CeldaSesion = Pick<
  SesionImportada,
  'materiaCodigo' | 'profeCodigos' | 'aulaCodigo' | 'actividadCodigo' | 'crudo'
>;

export interface Leyendas {
  materias: Map<string, string>;
  profes: Map<string, string>;
  aulas: Map<string, string>;
}

export interface Incidencia {
  tipo: 'codigo_desconocido' | 'celda_ilegible' | 'sin_tramos' | 'grupo_ilegible' | 'dato_personal';
  detalle: string;
  crudo?: string;
}

export interface TramoImportado {
  orden: number;
  horaInicio: string;
  horaFin: string;
  tipo: TipoTramo;
}

export interface ResultadoBloque {
  clase: { codigo: string; curso: string; letra: string | null; nombre: string } | null;
  /** Las filas de horas del bloque, recreos y comedor incluidos: ES la rejilla de la clase. */
  tramos: TramoImportado[];
  sesiones: SesionImportada[];
  leyendas: Leyendas;
  incidencias: Incidencia[];
  /** Texto suelto que no encaja en la cuadrícula ("Taller …: lunes 16:15, 1 sesión mensual"). */
  notas: string[];
}

const DIAS_CABECERA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/** 'De 09:00 a 09:45' → { horaInicio: '09:00', horaFin: '09:45' }. */
export function parsearRangoHoras(texto: string): { horaInicio: string; horaFin: string } | null {
  const m = /(\d{1,2})[:.](\d{2})\s*(?:a|-|–|hasta)\s*(\d{1,2})[:.](\d{2})/i.exec(texto ?? '');
  if (!m) return null;
  const dos = (n: string) => n.padStart(2, '0');
  return { horaInicio: `${dos(m[1])}:${m[2]}`, horaFin: `${dos(m[3])}:${m[4]}` };
}

/**
 * '2PRIA' → curso '2PRI', letra 'A' · '3INFB' → '3INF' + 'B' · '1ESOA' → '1ESO' + 'A'.
 * Los códigos del centro son <nivel><etapa><letra>, con la letra opcional.
 */
export function parsearCodigoGrupo(codigo: string): { curso: string; letra: string | null } | null {
  const c = (codigo ?? '').trim().toUpperCase();
  const m = /^(\d+\s*[ºO]?\s*(?:INF|PRI|ESO|BACH|CFGM|CFGS|PPDC|PDC))\s*([A-Z])?$/.exec(c.replace(/\s+/g, ''));
  if (!m) return null;
  return { curso: m[1].replace(/[ºO](?=[A-Z])/, ''), letra: m[2] ?? null };
}

/** '1PRIA: 1º EP-A' → el código, el grupo y el nombre bonito. */
export function parsearTituloClase(
  texto: string,
): { codigo: string; curso: string; letra: string | null; nombre: string } | null {
  const m = /^\s*([0-9A-ZÑ]{3,10})\s*:\s*(.+?)\s*$/i.exec(texto ?? '');
  if (!m) return null;
  const grupo = parsearCodigoGrupo(m[1]);
  if (!grupo) return null;
  return { codigo: m[1].toUpperCase(), curso: grupo.curso, letra: grupo.letra, nombre: m[2] };
}

/**
 * Las leyendas del pie del bloque: 'MVER0: MARÍA VICTORIA VERNIA JULIÁN'.
 * Llegan como una lista de líneas ya aplanadas, con los encabezados incluidos.
 */
export function parsearLeyendas(lineas: readonly string[]): Leyendas {
  const leyendas: Leyendas = { materias: new Map(), profes: new Map(), aulas: new Map() };
  let actual: keyof Leyendas | null = null;
  for (const linea of lineas) {
    const t = (linea ?? '').trim();
    if (!t) continue;
    const cabecera = norm(t).replace(/:$/, '');
    if (cabecera === 'materias') { actual = 'materias'; continue; }
    if (cabecera === 'profesores' || cabecera === 'profesorado') { actual = 'profes'; continue; }
    if (cabecera === 'aulas' || cabecera === 'espacios') { actual = 'aulas'; continue; }
    if (!actual) continue;
    const m = /^([^:]{1,20}):\s*(.+)$/.exec(t);
    if (!m) continue;
    // En el horario de PROFESOR la materia lleva el grupo pegado ('LCO5: Valencià … - 5PRIA').
    const valor = actual === 'materias' ? m[2].replace(/\s*-\s*[0-9A-ZÑ]{3,8}\s*$/i, '').trim() : m[2].trim();
    leyendas[actual].set(m[1].trim().toUpperCase(), valor);
  }
  return leyendas;
}

/**
 * Raíz del código de una materia: `EFI1`, `EFI3` y `EFI5` son **la misma** Educación Física
 * en tres cursos. El número final es el curso, no parte de la identidad.
 *
 * OJO: se quitan solo los dígitos del FINAL. `LCO3` (Valencià) y `LC03` (Lectura, con un
 * cero) conviven en el fichero real y son materias distintas; recortar por otro sitio las
 * fusionaría y sería un error de verdad.
 */
export function raizMateria(codigo: string): string {
  return (codigo ?? '').trim().toUpperCase().replace(/\d+$/, '') || (codigo ?? '').trim().toUpperCase();
}

/** Nombre normalizado para comparar ('Educació Física' ≠ 'Educación Física', pero 'English' = 'ENGLISH'). */
export function normalizarNombreMateria(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const RE_RECREO = /^(recreo|patio|esbarjo)$/i;
const RE_COMEDOR = /^(comedor|menjador)$/i;

/**
 * Interpreta una celda del horario de una CLASE.
 *
 * Formas reales vistas en los ficheros del colegio:
 *   'LEN1 - MVER0'              materia + profe
 *   'EFI1 - SDOM0 - Poli2'      materia + profe + aula
 *   'MAT1 - RMOG0\nMVER0'       DOS profes en la misma hora (salto de línea)
 *   'Recreo' / 'Comedor'        el tramo no es de clase
 *   'PT- MAPI' · 'AL 5º y 6º'   apoyo de PT/AL, en texto libre (ver nota abajo)
 *
 * `leyendas` es la del propio bloque y es lo que decide si un código suelto es profe o
 * aula. Sin leyenda no se inventa: se devuelve como incidencia.
 */
/**
 * Interpreta una celda del horario de una CLASE. Devuelve una LISTA porque una misma hora
 * puede llevar varias cosas.
 *
 * Formas reales vistas en los ficheros del colegio:
 *   'LEN1 - MVER0'                materia + profe
 *   'EFI1 - SDOM0 - Poli2'        materia + profe + aula
 *   'MAT1 - RMOG0\nMVER0'         DOS profes en la misma hora (la 2ª línea continúa)
 *   'MAT1 - MVER0\nPT- MAPI'      una clase Y un apoyo a la vez → DOS sesiones
 *   'Recreo' / 'Comedor'          el tramo no es de clase
 *   'PT- MAPI' · 'AL 5º y 6º'     apoyo de PT/AL, en texto libre
 *
 * `leyendas` es la del propio bloque y es lo que decide si un código suelto es profe o
 * aula. Sin leyenda no se inventa: se devuelve como incidencia.
 */
export function parsearCeldaClase(
  crudo: string,
  leyendas: Leyendas,
): { sesiones: CeldaSesion[]; incidencias: Incidencia[] } {
  const texto = (crudo ?? '').trim();
  const incidencias: Incidencia[] = [];
  if (!texto) return { sesiones: [], incidencias };
  if (RE_RECREO.test(texto) || RE_COMEDOR.test(texto)) return { sesiones: [], incidencias };

  const sesiones: CeldaSesion[] = [];
  const lineas = texto.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);

  for (const linea of lineas) {
    const apoyo = /^(PT|AL)\b[\s.\-–]*(.*)$/i.exec(linea);
    if (apoyo) {
      const resto = apoyo[2].trim();
      const codigoProfe = resto.toUpperCase();
      const esProfe = leyendas.profes.has(codigoProfe);
      // Estas celdas son texto libre y sucio ('PT. 1ºB', 'AL 4 AÑOS B', 'AL Aitana'). Se
      // reconoce la ACTIVIDAD y se conserva el crudo, pero no se saca de ahí ni el grupo
      // ni el alumno: a quién afecta un apoyo se mete a mano (`hor_apoyos`).
      if (resto && !esProfe && /[a-záéíóúñ]/.test(resto) && resto.split(/\s+/).length <= 2 && !/^\d/.test(resto)) {
        incidencias.push({
          tipo: 'dato_personal',
          detalle: 'La celda de apoyo parece llevar el nombre de un alumno; no se importa como dato, solo como texto de la sesión',
          crudo: linea,
        });
      }
      sesiones.push({
        materiaCodigo: null,
        profeCodigos: esProfe ? [codigoProfe] : [],
        aulaCodigo: null,
        actividadCodigo: apoyo[1].toUpperCase() === 'PT' ? 'apoyo_pt' : 'apoyo_al',
        crudo: linea,
      });
      continue;
    }

    const partes = linea.split(/\s*[-–]\s*/).map((p) => p.trim()).filter(Boolean);
    if (partes.length === 0) continue;
    const primera = partes[0].toUpperCase();

    // Una línea que es SOLO códigos sueltos continúa la entrada anterior: es el segundo
    // profe que entra a la misma hora ('MAT1 - RMOG0' + salto + 'MVER0'). Si en cambio
    // empieza por una materia conocida o por PT/AL, es una entrada NUEVA en el mismo hueco
    // (una clase y un apoyo a la vez), y eso son dos sesiones, no una fusionada.
    const esContinuacion =
      sesiones.length > 0 && partes.every((p) => leyendas.profes.has(p.toUpperCase()) || leyendas.aulas.has(p.toUpperCase()));
    if (esContinuacion) {
      const ultima = sesiones[sesiones.length - 1];
      for (const p of partes) {
        const cod = p.toUpperCase();
        if (leyendas.profes.has(cod)) ultima.profeCodigos.push(cod);
        else ultima.aulaCodigo = cod;
      }
      ultima.crudo = `${ultima.crudo}\n${linea}`;
      continue;
    }

    if (!leyendas.materias.has(primera)) {
      incidencias.push({ tipo: 'codigo_desconocido', detalle: `Materia '${partes[0]}' no está en la leyenda del bloque`, crudo: linea });
    }
    const sesion: CeldaSesion = {
      materiaCodigo: primera,
      profeCodigos: [],
      aulaCodigo: null,
      actividadCodigo: 'clase',
      crudo: linea,
    };
    for (const p of partes.slice(1)) {
      const cod = p.toUpperCase();
      if (leyendas.profes.has(cod)) sesion.profeCodigos.push(cod);
      else if (leyendas.aulas.has(cod)) sesion.aulaCodigo = cod;
      else incidencias.push({ tipo: 'codigo_desconocido', detalle: `'${p}' no está ni en profesores ni en aulas de la leyenda`, crudo: linea });
    }
    sesiones.push(sesion);
  }

  return { sesiones, incidencias };
}

/** Celda del horario de un PROFESOR: 'LCO5: 5PRIA' → materia + grupo. */
export function parsearCeldaProfe(
  crudo: string,
): { materiaCodigo: string; curso: string; letra: string | null } | null {
  const texto = (crudo ?? '').trim();
  if (!texto || RE_RECREO.test(texto) || RE_COMEDOR.test(texto)) return null;
  const m = /^([0-9A-ZÑ]{2,8})\s*[:\-–]\s*([0-9A-ZÑ]{3,10})$/i.exec(texto);
  if (!m) return null;
  const grupo = parsearCodigoGrupo(m[2]);
  if (!grupo) return null;
  return { materiaCodigo: m[1].toUpperCase(), curso: grupo.curso, letra: grupo.letra };
}

/** Qué clase de tramo es, mirando la fila entera (si todo el día pone 'Recreo', es recreo). */
function tipoDeFila(celdas: readonly string[]): TipoTramo {
  const conTexto = celdas.map((c) => (c ?? '').trim()).filter(Boolean);
  if (conTexto.length && conTexto.every((c) => RE_RECREO.test(c))) return 'recreo';
  if (conTexto.length && conTexto.every((c) => RE_COMEDOR.test(c))) return 'comedor';
  return 'sesion';
}

/**
 * Normaliza un bloque "HORARIO DE CLASE" completo a la lista canónica de sesiones.
 *
 * `filas` es la cuadrícula del bloque tal cual la devuelve el lector del formato, sin
 * limpiar: se localizan solas la fila de días (la que tiene 'Lunes'…) y las filas de
 * horas. Lo que quede por debajo de la última fila de horas se trata como leyendas y
 * notas — ahí es donde vive el texto suelto tipo "1 sesión mensual", que no cabe en
 * ninguna cuadrícula y se conserva como nota en vez de inventarse una recurrencia.
 */
export function normalizarBloqueClase(filas: readonly (readonly string[])[]): ResultadoBloque {
  const incidencias: Incidencia[] = [];
  const limpias = filas.map((f) => f.map((c) => (c ?? '').toString()));

  let clase: ResultadoBloque['clase'] = null;
  for (const f of limpias) {
    for (const c of f) {
      const t = parsearTituloClase(c);
      if (t) { clase = t; break; }
    }
    if (clase) break;
  }

  // Fila de días: la que más nombres de día contiene, y en qué columna cae cada uno.
  let filaDias = -1;
  let columnaDia: number[] = [];
  limpias.forEach((f, i) => {
    const cols = DIAS_CABECERA.map((d) => f.findIndex((c) => norm(c) === d));
    const encontrados = cols.filter((c) => c >= 0).length;
    if (encontrados > columnaDia.filter((c) => c >= 0).length) { filaDias = i; columnaDia = cols; }
  });

  const sesiones: SesionImportada[] = [];
  const tramos: TramoImportado[] = [];
  let ultimaFilaHoras = filaDias;
  let orden = 0;

  if (filaDias >= 0 && clase) {
    // Leyendas primero: hacen falta para interpretar las celdas.
    const pie: string[] = [];
    for (let i = filaDias + 1; i < limpias.length; i++) {
      if (parsearRangoHoras(limpias[i][0] ?? '')) continue;
      pie.push(...limpias[i].filter((c) => c.trim()));
    }
    const leyendas = parsearLeyendas(pie);

    for (let i = filaDias + 1; i < limpias.length; i++) {
      const fila = limpias[i];
      const rango = parsearRangoHoras(fila[0] ?? '');
      if (!rango) continue;
      ultimaFilaHoras = i;
      orden++;
      const celdasDelDia = columnaDia.map((col) => (col >= 0 ? (fila[col] ?? '') : ''));
      const tipoTramo = tipoDeFila(celdasDelDia);
      tramos.push({ orden, horaInicio: rango.horaInicio, horaFin: rango.horaFin, tipo: tipoTramo });

      celdasDelDia.forEach((celda, idx) => {
        if (columnaDia[idx] < 0) return;
        const { sesiones: enLaCelda, incidencias: incs } = parsearCeldaClase(celda, leyendas);
        incidencias.push(...incs);
        for (const s of enLaCelda) {
          sesiones.push({
            dia: idx + 1,
            orden,
            horaInicio: rango.horaInicio,
            horaFin: rango.horaFin,
            tipoTramo,
            grupos: [{ curso: clase!.curso, letra: clase!.letra }],
            ...s,
          });
        }
      });
    }

    const notas = limpias
      .slice(ultimaFilaHoras + 1)
      .flatMap((f) => f.filter((c) => c.trim()))
      // Fuera: entradas de leyenda ('LEN1: Lengua…'), sus cabeceras, y cualquier cosa que
      // tenga pinta de celda suelta ('LEN1 - MVER0'), que a veces se cuela al aplanar.
      .filter((t) => !/^[^:]{1,20}:\s*.+$/.test(t) && !/^(materias|profesores|aulas|espacios):?$/i.test(norm(t)))
      .filter((t) => !/^[0-9A-ZÑ]{2,8}\s*[-–]\s*[0-9A-ZÑ]{2,8}/i.test(t))
      .filter((t) => t.length > 8);

    if (orden === 0) incidencias.push({ tipo: 'sin_tramos', detalle: `El bloque de ${clase.codigo} no tiene ninguna fila de horas` });
    return { clase, tramos, sesiones, leyendas, incidencias, notas };
  }

  if (!clase) incidencias.push({ tipo: 'grupo_ilegible', detalle: 'No se ha encontrado el título de clase del bloque (p. ej. "1PRIA: 1º EP-A")' });
  if (filaDias < 0) incidencias.push({ tipo: 'sin_tramos', detalle: 'No se ha encontrado la fila de días del bloque' });
  return { clase, tramos, sesiones, leyendas: { materias: new Map(), profes: new Map(), aulas: new Map() }, incidencias, notas: [] };
}

// ─── Rejillas desde el "Horario general del colegio" ──────────────────────────

export interface RejillaImportada {
  nombre: string;
  tramos: { diaSemana: number; orden: number; horaInicio: string; horaFin: string }[];
}

/**
 * Las filas de cabecera del "Horario general" son, literalmente, las rejillas del centro:
 * una fila por etapa y, en cada una, las horas de los cinco días seguidas.
 *
 *   'Primaria 2026-2027' | 09:00\n09:45 | 09:45\n10:30 | … (lunes) | … (martes) | …
 *
 * Los días NO ocupan el mismo número de columnas en todas las etapas (en ESO el lunes
 * tiene 9 sesiones y el martes 7), así que el corte por día no se puede hacer contando
 * columnas: se hace **detectando el reinicio de la hora** — cuando una hora de inicio es
 * anterior a la anterior, ha empezado un día nuevo. Es lo único que aguanta las tres
 * rejillas reales del colegio con el mismo código.
 */
export function parsearRejillaDeFila(fila: readonly string[]): RejillaImportada | null {
  const nombre = (fila[0] ?? '').toString().trim();
  if (!nombre) return null;
  const horas = fila
    .slice(1)
    .map((c) => (c ?? '').toString().trim())
    .map((c) => {
      const m = /^(\d{1,2})[:.](\d{2})\s*[\n\r/-]\s*(\d{1,2})[:.](\d{2})$/.exec(c);
      return m ? { horaInicio: `${m[1].padStart(2, '0')}:${m[2]}`, horaFin: `${m[3].padStart(2, '0')}:${m[4]}` } : null;
    });

  const tramos: RejillaImportada['tramos'] = [];
  let dia = 0;
  let orden = 0;
  let anterior = '';
  for (const h of horas) {
    if (!h) continue;
    if (h.horaInicio <= anterior) { dia++; orden = 0; } // se ha reiniciado la hora: día nuevo
    else if (dia === 0) dia = 1;
    if (dia === 0) dia = 1;
    orden++;
    anterior = h.horaInicio;
    if (dia > 5) break;
    tramos.push({ diaSemana: dia, orden, horaInicio: h.horaInicio, horaFin: h.horaFin });
  }
  return tramos.length ? { nombre, tramos } : null;
}
