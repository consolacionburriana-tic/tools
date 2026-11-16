// Tareas por correo (docs/34-paleta-y-tareas-por-correo.md): lee los correos reenviados a
// `tic+tarea@…` y los convierte en tarjetas de Tableros.
//
//   · Quien reenvía es quien crea la tarjeta, y tiene que estar en algún equipo de Tableros (si no,
//     el correo se marca «Tableros/Sin equipo» y no se hace nada).
//   · El asunto admite lo mismo que la paleta de ⌘K: `Proyector 3ºB @amparo viernes !alta #mant`.
//   · El cuerpo va a la descripción, y la tarjeta enlaza al correo original.
//   · Un correo hecho se etiqueta «Tableros/En tablero» y ya no se vuelve a leer.
//
// Se mira el buzón al usar /gestion (como mucho cada 2 minutos, `revisarSiToca`) y una vez al día
// por cron. Necesita en la delegación de dominio el scope `gmail.modify` sobre ese buzón.
import { google, type gmail_v1 } from 'googleapis';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { COLEGIO } from '@/lib/colegio';
import { esErrorDeDelegacion, googleConfigurado, jwtGoogle, mensajeDe } from '@/lib/google-sa';
import { hoyEnEspana } from '@/lib/oratorios';
import { elegirPersona, elegirTablero, interpretarTarea } from '@/lib/paleta';
import { direccionTareas, enlaceCorreo, limpiarAsunto, remitente, textoDelCorreo } from '@/lib/tareas-correo';
import { crearTareaRapida, destinosTarea } from '@/lib/tareas-rapidas-server';

const SCOPE = 'https://www.googleapis.com/auth/gmail.modify';
const ETIQUETA_HECHA = 'Tableros/En tablero';
const ETIQUETA_SIN_EQUIPO = 'Tableros/Sin equipo';
const CADA_MS = 2 * 60 * 1000;

/** El buzón que se lee (`TAREAS_BUZON`; por defecto, el de TIC). */
export function buzonTareas(): string {
  return (process.env.TAREAS_BUZON || COLEGIO.correoTic).trim().toLowerCase();
}

export function direccionDeTareas(): string {
  return direccionTareas(buzonTareas());
}

function gmail(): gmail_v1.Gmail {
  return google.gmail({ version: 'v1', auth: jwtGoogle(SCOPE, buzonTareas()) });
}

async function idEtiqueta(g: gmail_v1.Gmail, nombre: string, cache: Map<string, string>): Promise<string> {
  const ya = cache.get(nombre);
  if (ya) return ya;
  const { data } = await g.users.labels.list({ userId: 'me' });
  for (const l of data.labels ?? []) if (l.name && l.id) cache.set(l.name, l.id);
  if (cache.has(nombre)) return cache.get(nombre)!;
  const creada = await g.users.labels.create({ userId: 'me', requestBody: { name: nombre, labelListVisibility: 'labelShow', messageListVisibility: 'show' } });
  cache.set(nombre, creada.data.id!);
  return creada.data.id!;
}

export interface ResultadoCorreos {
  creadas: number;
  sinEquipo: number;
  errores: string[];
}

/** Lee el buzón y crea las tarjetas pendientes. */
export async function procesarCorreosDeTareas(): Promise<ResultadoCorreos> {
  const r: ResultadoCorreos = { creadas: 0, sinEquipo: 0, errores: [] };
  if (!googleConfigurado()) return r;
  const g = gmail();
  const etiquetas = new Map<string, string>();
  const direccion = direccionDeTareas();
  const { data } = await g.users.messages.list({
    userId: 'me',
    q: `to:${direccion} newer_than:30d -label:"${ETIQUETA_HECHA}" -label:"${ETIQUETA_SIN_EQUIPO}"`,
    maxResults: 25,
  });
  const hoy = hoyEnEspana();
  for (const { id } of data.messages ?? []) {
    if (!id) continue;
    try {
      const { data: m } = await g.users.messages.get({ userId: 'me', id, format: 'full' });
      const cab = (n: string) => m.payload?.headers?.find((h) => h.name?.toLowerCase() === n)?.value ?? '';
      const de = remitente(cab('from'));
      const destinos = de && de.email.endsWith(`@${COLEGIO.dominio}`) ? await destinosTarea(de.email) : [];
      if (!de || destinos.length === 0) {
        await g.users.messages.modify({ userId: 'me', id, requestBody: { addLabelIds: [await idEtiqueta(g, ETIQUETA_SIN_EQUIPO, etiquetas)] } });
        r.sinEquipo++;
        continue;
      }
      const asunto = limpiarAsunto(cab('subject'));
      const t = interpretarTarea(`t ${asunto}`, hoy);
      const destino = elegirTablero(destinos, t.tablero) ?? destinos[0];
      const responsables = t.menciones.flatMap((p) => {
        const persona = elegirPersona(destino.miembros, p);
        return persona ? [persona.email] : [];
      });
      const cuerpo = textoDelCorreo(m.payload);
      const msgId = cab('message-id');
      await crearTareaRapida(
        {
          tableroId: destino.id,
          titulo: t.titulo || `Correo de ${de.nombre ?? de.email}`,
          responsables,
          prioridad: t.prioridad,
          vence: t.vence,
          descripcion: [`Reenviado por ${de.nombre ?? de.email} a ${direccion}.`, cuerpo].filter(Boolean).join('\n\n'),
          enlaces: msgId ? [{ url: enlaceCorreo(msgId), titulo: 'Correo original (en tu Gmail)' }] : [],
        },
        { email: de.email, nombre: de.nombre },
      );
      await g.users.messages.modify({ userId: 'me', id, requestBody: { addLabelIds: [await idEtiqueta(g, ETIQUETA_HECHA, etiquetas)] } });
      r.creadas++;
    } catch (e) {
      r.errores.push(mensajeDe(e));
      console.error('Tareas por correo:', mensajeDe(e));
    }
  }
  return r;
}

let ultimaVez = 0;

/**
 * Mira el buzón si hace más de 2 minutos que nadie lo ha mirado (en esta instancia y en todas: el
 * turno se coge en `cfg_ajustes` con un UPDATE atómico, así dos peticiones a la vez no procesan
 * dos veces el mismo correo). Pensado para llamarse en un `after()`: nunca lanza.
 */
export async function revisarSiToca(): Promise<void> {
  if (!googleConfigurado() || Date.now() - ultimaVez < CADA_MS) return;
  ultimaVez = Date.now();
  try {
    const turno = await db.execute(sql`
      insert into cfg_ajustes (clave, valor, updated_at) values ('tareas-correo-turno', '{}'::jsonb, now())
      on conflict (clave) do update set updated_at = now()
        where cfg_ajustes.updated_at < now() - interval '2 minutes'
      returning clave`);
    if (turno.rows.length === 0) return;
    await procesarCorreosDeTareas();
  } catch (e) {
    // Sin el scope en la delegación, no se insiste hasta dentro de una hora (y se avisa una vez).
    if (esErrorDeDelegacion(e)) {
      ultimaVez = Date.now() + 58 * 60 * 1000;
      console.warn(`Tareas por correo: falta el scope ${SCOPE} en la delegación de dominio para ${buzonTareas()}`);
      return;
    }
    console.error('Tareas por correo:', mensajeDe(e));
  }
}
