// Helpers puros de Evaluaciones (sin IO, testeables). Aquí viven las escalas, los
// presets de preguntas por audiencia, la normalización que permite comparar entre
// cursos y la validación de respuestas que comparten cliente y servidor.
//
// Los presets son EL punto del módulo: crear una evaluación tiene que costar dos clics
// y salir ya casi escrita, con las frases que hay que adaptar marcadas en ámbar.

// ─── Vocabulario ──────────────────────────────────────────────────────────────

// Quién responde el formulario. En la interfaz el concepto se llama SIEMPRE
// "¿Quién responde?"; en código y en la BBDD la columna se sigue llamando `audiencia`.
export const AUDIENCIAS = [
  { value: 'alumnos', label: 'Alumnado', emoji: '🧒' },
  { value: 'profesores', label: 'Profesorado', emoji: '👩🏻‍🏫' },
  { value: 'familias', label: 'Familias', emoji: '👨‍👩‍👧' },
] as const;
export type Audiencia = (typeof AUDIENCIAS)[number]['value'];

export const CATEGORIAS = [
  { value: 'pastoral', label: 'Pastoral', emoji: '✝️', color: 'violet' },
  { value: 'innovacion', label: 'Innovación', emoji: '💡', color: 'amber' },
  { value: 'general', label: 'General', emoji: '🏫', color: 'blue' },
  { value: 'otra', label: 'Otra', emoji: '🏷️', color: 'zinc' },
] as const;
export type Categoria = (typeof CATEGORIAS)[number]['value'];

// Qué se evalúa. Hoy solo se crean actividades; 'asignatura' y 'general' están para
// cuando toque evaluar una materia y a su profe, o pasar una encuesta a familias.
export const TIPOS_OBJETO = [
  { value: 'actividad', label: 'Actividad' },
  { value: 'asignatura', label: 'Asignatura' },
  { value: 'general', label: 'Encuesta general' },
] as const;
export type TipoObjeto = (typeof TIPOS_OBJETO)[number]['value'];

export const ESTADOS = ['borrador', 'abierto', 'cerrado'] as const;
export type Estado = (typeof ESTADOS)[number];

export type TipoPregunta = 'escala' | 'texto' | 'opcion' | 'varias' | 'quiz';

// ─── Escalas ──────────────────────────────────────────────────────────────────

export interface Escala {
  value: string;
  label: string;
  /** Opciones de menor a mayor, con el valor numérico que se guarda. */
  puntos: { valor: number; label: string }[];
}

export const ESCALAS: Escala[] = [
  {
    value: 'nada_mucho',
    label: 'Nada · Poco · Bastante · Mucho',
    puntos: [
      { valor: 1, label: 'Nada' },
      { valor: 2, label: 'Poco' },
      { valor: 3, label: 'Bastante' },
      { valor: 4, label: 'Mucho' },
    ],
  },
  {
    value: '1_5',
    label: 'Del 1 al 5',
    puntos: [1, 2, 3, 4, 5].map((n) => ({ valor: n, label: String(n) })),
  },
  {
    value: 'si_no',
    label: 'Sí / No',
    puntos: [
      { valor: 0, label: 'No' },
      { valor: 1, label: 'Sí' },
    ],
  },
  // Las estrellas son una escala más, no un tipo de pregunta aparte: así las medias,
  // la normalización a 0-100, el CSV y las comparativas entre cursos siguen
  // funcionando sin tocar nada, y se puede pasar de "Nada-Mucho" a estrellas (o al
  // revés) sin perder lo ya respondido.
  {
    value: 'estrellas_5',
    label: '★ Estrellas (1-5)',
    puntos: [1, 2, 3, 4, 5].map((n) => ({ valor: n, label: String(n) })),
  },
  {
    value: 'estrellas_4',
    label: '★ Estrellas (1-4)',
    puntos: [1, 2, 3, 4].map((n) => ({ valor: n, label: String(n) })),
  },
];

/** ¿Esta escala se pinta con estrellitas (o corazones, o lo que toque)? */
export function esEscalaEstrellas(value: string | null | undefined): boolean {
  return (value ?? '').startsWith('estrellas_');
}

/**
 * Estilos de la escala de estrellas. Los cuatro primeros se rellenan de forma
 * acumulativa (tocas la cuarta y se encienden las cuatro); las caritas no, porque lo
 * natural con una cara es elegir UNA, no acumular caras.
 */
export const ESTILOS_ESTRELLA = [
  { value: 'estrella', label: 'Estrellas', icono: 'Star', muestra: '★', acumulativo: true },
  { value: 'corazon', label: 'Corazones', icono: 'Heart', muestra: '♥', acumulativo: true },
  { value: 'fuego', label: 'Fuego', icono: 'Flame', muestra: '🔥', acumulativo: true },
  { value: 'pulgar', label: 'Pulgares', icono: 'ThumbsUp', muestra: '👍', acumulativo: true },
  { value: 'carita', label: 'Caritas', icono: 'Smile', muestra: '🙂', acumulativo: false },
] as const;
export type EstiloEstrella = (typeof ESTILOS_ESTRELLA)[number]['value'];

export const ESTILO_ESTRELLA_POR_DEFECTO: EstiloEstrella = 'estrella';

export function estiloEstrellaDe(valor: string | null | undefined): (typeof ESTILOS_ESTRELLA)[number] {
  return ESTILOS_ESTRELLA.find((e) => e.value === valor) ?? ESTILOS_ESTRELLA[0];
}

/**
 * Caras de la escala de caritas, de peor a mejor. Se reparten sobre el número de
 * puntos que tenga la escala (4 o 5), así que sirven para las dos.
 */
export const CARITAS = ['😖', '😕', '🙂', '😃', '🤩'] as const;

export function caritaPara(indice: number, n: number): string {
  if (n <= 1) return CARITAS[CARITAS.length - 1];
  const pos = Math.round((indice / (n - 1)) * (CARITAS.length - 1));
  return CARITAS[Math.min(CARITAS.length - 1, Math.max(0, pos))];
}

export function escalaDe(value: string | null | undefined): Escala {
  return ESCALAS.find((e) => e.value === value) ?? ESCALAS[0];
}

/**
 * Lleva cualquier escala a 0-100. Es lo que permite comparar una pregunta de
 * Nada-Mucho con una del 1 al 5, o la misma actividad entre dos cursos aunque en
 * el camino se cambiara la escala.
 */
export function aPorcentaje(valor: number, escalaValue: string): number | null {
  const puntos = escalaDe(escalaValue).puntos;
  const min = puntos[0].valor;
  const max = puntos[puntos.length - 1].valor;
  if (max === min) return null;
  if (valor < min || valor > max) return null;
  return ((valor - min) / (max - min)) * 100;
}

/** Media en 0-100 de una lista de valores de una misma escala (null si no hay datos). */
export function mediaPorcentaje(valores: number[], escalaValue: string): number | null {
  const pcts = valores.map((v) => aPorcentaje(v, escalaValue)).filter((p): p is number => p !== null);
  if (pcts.length === 0) return null;
  return pcts.reduce((s, p) => s + p, 0) / pcts.length;
}

/** Media en las unidades de la propia escala (lo que se enseña como "3,2 / 4"). */
export function mediaBruta(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

/** Etiqueta de color para un 0-100: verde bien, ámbar regular, rojo flojo. */
export function tonoDe(pct: number | null): 'bien' | 'regular' | 'flojo' | 'sin' {
  if (pct === null) return 'sin';
  if (pct >= 70) return 'bien';
  if (pct >= 45) return 'regular';
  return 'flojo';
}

// ─── Claves estables ──────────────────────────────────────────────────────────

/**
 * Slug estable de un texto: la clave con la que se compara la misma pregunta entre
 * formularios y entre cursos. Si mañana se retoca la redacción, la clave no cambia
 * (se copia con la pregunta) y la comparativa sigue cuadrando.
 */
export function slugClave(texto: string, max = 48): string {
  const base = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, max)
    .replace(/_+$/, '');
  return base || 'pregunta';
}

/** Hace única una clave dentro de un conjunto ya usado (`ambiente`, `ambiente_2`…). */
export function claveUnica(base: string, usadas: Set<string>): string {
  if (!usadas.has(base)) return base;
  let n = 2;
  while (usadas.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789'; // sin l/I/1 ni o/O/0

function tokenAleatorio(largo: number): string {
  const bytes = new Uint8Array(largo);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('');
}

/** Token público del formulario: `/evaluaciones/ev_xxxx`. */
export function nuevoTokenFormulario(): string {
  return `ev_${tokenAleatorio(16)}`;
}

/**
 * Token de invitación personalizada (`?a=…`). Es opaco a propósito: el alumnado no
 * ve su identificador, y adivinar el de otro es inviable.
 */
export function nuevoTokenInvitacion(): string {
  return tokenAleatorio(20);
}

// ─── Textos por defecto ───────────────────────────────────────────────────────

/**
 * Mini-indicador del pie del formulario, editable por formulario.
 *
 * En profesorado la frase es literal: no se guarda nada. En alumnado y familias se deja
 * la frase seca, sin explicaciones (decisión de David, 2026-08-25): quien responde tiene
 * que sentirse libre para decir lo que piensa, y en pantalla nadie ve nombres.
 */
export const AVISO_ANONIMATO: Record<Audiencia, string> = {
  alumnos: '🔒 Tus respuestas son anónimas.',
  profesores:
    '🔒 Esta evaluación es 100 % anónima: no se guarda quién responde ni se puede saber después.',
  familias: '🔒 Vuestras respuestas son anónimas.',
};

export const MENSAJE_FINAL: Record<Audiencia, string> = {
  alumnos: '¡Gracias! 🙌 Tu opinión nos ayuda a preparar mejor lo siguiente.',
  profesores: 'Gracias por dedicarle un momento. Tu valoración nos ayuda a ajustar las próximas propuestas.',
  familias: '¡Gracias! Vuestra opinión nos ayuda mucho.',
};

export const INTRO_FORM: Record<Audiencia, string> = {
  alumnos:
    'Para seguir mejorando y saber vuestra opinión, tras cada tutoría, actividad… recibiréis un breve formulario de evaluación 🤙🏼',
  profesores: 'Evaluamos lo trabajado para ajustar las próximas propuestas. Se responde en un par de minutos.',
  familias: 'Nos gustaría conocer vuestra opinión. Se responde en un par de minutos.',
};

// ─── Huecos obligatorios ──────────────────────────────────────────────────────

/**
 * Una frase del preset que TERMINA en "…" es un hueco sin rellenar. No es cosmético:
 * el formulario no se puede abrir hasta que no quede ninguno.
 *
 * Por qué: la tentación de mandar la evaluación con el "¿Te ha servido para descubrir
 * algo nuevo?" genérico es enorme, y una pregunta genérica no la contesta nadie con
 * cabeza. Obligando a terminar la frase, la evaluación se personaliza sí o sí.
 *
 * El "…" en medio de una frase no cuenta ("¿Qué cambiarías? o… ¿Qué nos propones?"),
 * solo el del final.
 */
export const MARCA_HUECO = '…';

export function fraseConHueco(texto: string | null | undefined): boolean {
  return (texto ?? '').trim().endsWith(MARCA_HUECO);
}

export interface PreguntaConHuecos {
  id: string;
  texto: string;
  filas: { clave: string; texto: string }[];
}

/** Preguntas (y filas) que todavía tienen huecos sin rellenar, para bloquear la apertura. */
export function huecosPendientes(
  preguntas: PreguntaConHuecos[],
): { questionId: string; texto: string }[] {
  const out: { questionId: string; texto: string }[] = [];
  for (const q of preguntas) {
    if (fraseConHueco(q.texto)) out.push({ questionId: q.id, texto: q.texto });
    for (const f of q.filas) {
      if (fraseConHueco(f.texto)) out.push({ questionId: q.id, texto: f.texto });
    }
  }
  return out;
}

// ─── Presets de preguntas ─────────────────────────────────────────────────────

export interface PreguntaBorrador {
  clave: string;
  texto: string;
  ayuda?: string | null;
  tipo: TipoPregunta;
  escala?: string;
  estilo?: string | null;
  filas?: { clave: string; texto: string }[];
  opciones?: { clave: string; texto: string; correcta?: boolean }[];
  permiteOtra?: boolean;
  obligatoria?: boolean;
  /** true = viene del preset y hay que adaptar la frase antes de enviar. */
  revisar?: boolean;
  feedbackAcierto?: string | null;
  feedbackFallo?: string | null;
}

const fila = (texto: string) => ({ clave: slugClave(texto, 32), texto });

/** Observaciones y sugerencias: la pregunta que David pone SIEMPRE, en las dos audiencias. */
function preguntaObservaciones(nombreActividad: string, audiencia: Audiencia): PreguntaBorrador {
  return audiencia === 'profesores'
    ? {
        clave: 'observaciones',
        texto: `Observaciones y sugerencias — ${nombreActividad}`,
        ayuda: 'Lo que cambiarías, lo que echaste en falta, lo que repetirías.',
        tipo: 'texto',
        obligatoria: false,
      }
    : {
        clave: 'observaciones',
        texto: '🤔 Observaciones y sugerencias · ¿Qué cambiarías? o… ¿Qué nos propones?',
        ayuda: '¡Es importante! Cualquier propuesta es válida, necesitamos escuchar tu opinión, ideas, sueños…',
        tipo: 'texto',
        obligatoria: false,
      };
}

/**
 * Preset de una actividad según a quién se pregunte. Sale ya escrito y con las
 * frases que hay que adaptar marcadas (`revisar`), que es justo el flujo real:
 * duplicar lo de siempre y cambiar dos líneas.
 */
export function presetActividad(nombreActividad: string, audiencia: Audiencia): PreguntaBorrador[] {
  const nombre = nombreActividad.trim() || 'la actividad';

  if (audiencia === 'profesores') {
    return [
      {
        clave: 'objetivos',
        texto: `Objetivos y contenidos — ${nombre}`,
        tipo: 'escala',
        escala: 'nada_mucho',
        revisar: true,
        filas: [
          fila('¿Ha sido interesante poder tener este momento?'),
          // Hueco a propósito, igual que en alumnado: el objetivo se concreta cada vez.
          fila('¿Ha servido para…'),
          fila('¿La propuesta era adecuada para la edad del alumnado?'),
        ],
      },
      {
        clave: 'organizacion',
        texto: `Organización y dinámica propuesta — ${nombre}`,
        tipo: 'escala',
        escala: 'nada_mucho',
        filas: [fila('Duración'), fila('Dinámica propuesta'), fila('Materiales trabajados'), fila('Ambiente')],
      },
      preguntaObservaciones(nombre, 'profesores'),
    ];
  }

  if (audiencia === 'familias') {
    return [
      {
        clave: 'valoracion',
        texto: `✅ ${nombre}`,
        tipo: 'escala',
        escala: 'nada_mucho',
        revisar: true,
        filas: [
          fila('¿Os ha parecido interesante la propuesta?'),
          fila('¿Os ha servido para…'),
          fila('¿La información que recibisteis fue clara y a tiempo?'),
        ],
      },
      preguntaObservaciones(nombre, 'familias'),
    ];
  }

  return [
    {
      clave: 'actividad',
      texto: `✅ Actividad · ${nombre}`,
      tipo: 'escala',
      escala: 'nada_mucho',
      revisar: true,
      filas: [
        // Hueco a propósito: hay que terminar la frase para poder abrir el formulario.
        fila('¿Te ha servido para…'),
        fila('¿Te han gustado las actividades que has realizado?'),
        fila('¿Te ha parecido adecuado el tiempo que has tenido?'),
        fila('¿Te ha gustado el lugar donde la has realizado?'),
      ],
    },
    preguntaObservaciones(nombre, 'alumnos'),
  ];
}

/**
 * Catálogo de preguntas sueltas para añadir en un clic desde el editor. Salen del
 * histórico real de formularios del colegio.
 */
export interface PreguntaCatalogo {
  id: string;
  nombre: string;
  audiencias: Audiencia[];
  pregunta: Omit<PreguntaBorrador, 'clave'> & { clave?: string };
}

export const CATALOGO: PreguntaCatalogo[] = [
  {
    id: 'salir_del_cole',
    nombre: '¿Te ha gustado poder salir del cole?',
    audiencias: ['alumnos'],
    pregunta: {
      texto: '¿Te ha gustado poder salir del cole para hacer la actividad?',
      tipo: 'opcion',
      permiteOtra: true,
      opciones: [
        { clave: 'si', texto: 'Sí, genial' },
        { clave: 'no_sitio', texto: 'No me ha gustado el sitio (explica por qué)' },
      ],
    },
  },
  {
    id: 'donde_convivencia',
    nombre: '¿Dónde te gustaría hacer la convivencia?',
    audiencias: ['alumnos'],
    pregunta: {
      texto: '¿Dónde te gustaría hacer la convivencia? ¿Cómo?',
      ayuda: 'Suéñalo: si se puede, lo intentamos.',
      tipo: 'texto',
      obligatoria: false,
    },
  },
  {
    id: 'organizacion',
    nombre: 'Organización (duración · dinámica · materiales · ambiente)',
    audiencias: ['profesores', 'alumnos'],
    pregunta: {
      texto: 'Organización y dinámica propuesta',
      tipo: 'escala',
      escala: 'nada_mucho',
      filas: [fila('Duración'), fila('Dinámica propuesta'), fila('Materiales trabajados'), fila('Ambiente')],
    },
  },
  {
    id: 'objetivos',
    nombre: 'Objetivos y contenidos',
    audiencias: ['profesores'],
    pregunta: {
      texto: 'Objetivos y contenidos',
      tipo: 'escala',
      escala: 'nada_mucho',
      revisar: true,
      filas: [
        fila('¿Ha sido interesante poder tener este momento?'),
        fila('¿Se han conseguido los objetivos planteados?'),
      ],
    },
  },
  {
    id: 'repetir',
    nombre: '¿Repetirías la actividad el curso que viene?',
    audiencias: ['profesores', 'alumnos'],
    pregunta: { texto: '¿Repetirías esta actividad el curso que viene?', tipo: 'escala', escala: 'si_no' },
  },
  {
    id: 'observaciones',
    nombre: 'Observaciones y sugerencias',
    audiencias: ['alumnos', 'profesores', 'familias'],
    pregunta: {
      texto: '🤔 Observaciones y sugerencias · ¿Qué cambiarías? o… ¿Qué nos propones?',
      ayuda: '¡Es importante! Cualquier propuesta es válida, necesitamos escuchar tu opinión, ideas, sueños…',
      tipo: 'texto',
      obligatoria: false,
    },
  },
  {
    id: 'quiz_rasgos',
    nombre: '🤷 Quiz · ¿de qué te has enterado?',
    audiencias: ['alumnos'],
    pregunta: {
      texto: 'Comprobemos de lo que te has enterado… ¿cuáles son los valores que trabajamos este año? 🤷',
      tipo: 'quiz',
      revisar: true,
      obligatoria: false,
      opciones: [
        { clave: 'a', texto: 'Estar con los más necesitados' },
        { clave: 'b', texto: 'Experiencia de Dios: ser auténticos', correcta: true },
        { clave: 'c', texto: 'Humildad y sencillez: autenticidad' },
        { clave: 'd', texto: 'La caridad es el Amor' },
      ],
      feedbackAcierto: '¡Bien! 🎉 Estabas atento/a.',
      feedbackFallo: 'Casi 😅 Repásalo, que este año va de esto.',
    },
  },
];

/** Materializa una entrada del catálogo como pregunta, con clave única en el bloque. */
export function desdeCatalogo(item: PreguntaCatalogo, usadas: Set<string>): PreguntaBorrador {
  const base = item.pregunta.clave ?? slugClave(item.id);
  return { ...item.pregunta, clave: claveUnica(base, usadas) };
}

// ─── Validación de respuestas ─────────────────────────────────────────────────

export interface PreguntaParaValidar {
  id: string;
  tipo: TipoPregunta;
  escala: string;
  obligatoria: boolean;
  filas: { clave: string; texto: string }[];
  opciones: { clave: string; texto: string }[];
  permiteOtra: boolean;
}

export interface RespuestaCruda {
  questionId: string;
  filaClave?: string | null;
  valorNum?: number | null;
  opcionClave?: string | null;
  valorTexto?: string | null;
}

/**
 * Comprueba que están contestadas las obligatorias. Se usa igual en el cliente (para
 * marcar en rojo antes de enviar) y en el servidor (para no fiarse del cliente).
 * Devuelve los ids de pregunta incompletos.
 */
export function preguntasIncompletas(
  preguntas: PreguntaParaValidar[],
  respuestas: RespuestaCruda[],
): string[] {
  const porPregunta = new Map<string, RespuestaCruda[]>();
  for (const r of respuestas) {
    const lista = porPregunta.get(r.questionId) ?? [];
    lista.push(r);
    porPregunta.set(r.questionId, lista);
  }

  const fallan: string[] = [];
  for (const q of preguntas) {
    if (!q.obligatoria) continue;
    const dadas = porPregunta.get(q.id) ?? [];
    if (q.tipo === 'escala' && q.filas.length > 0) {
      const contestadas = new Set(dadas.filter((r) => r.valorNum !== null && r.valorNum !== undefined).map((r) => r.filaClave));
      if (q.filas.some((f) => !contestadas.has(f.clave))) fallan.push(q.id);
      continue;
    }
    if (q.tipo === 'escala') {
      if (!dadas.some((r) => r.valorNum !== null && r.valorNum !== undefined)) fallan.push(q.id);
      continue;
    }
    if (q.tipo === 'texto') {
      if (!dadas.some((r) => (r.valorTexto ?? '').trim().length > 0)) fallan.push(q.id);
      continue;
    }
    // opcion | varias | quiz
    const conOpcion = dadas.some(
      (r) => !!r.opcionClave || (q.permiteOtra && (r.valorTexto ?? '').trim().length > 0),
    );
    if (!conOpcion) fallan.push(q.id);
  }
  return fallan;
}

/** Quita respuestas que no encajan con la definición de la pregunta (defensa en servidor). */
export function limpiarRespuestas(
  preguntas: PreguntaParaValidar[],
  respuestas: RespuestaCruda[],
): RespuestaCruda[] {
  const porId = new Map(preguntas.map((q) => [q.id, q]));
  const out: RespuestaCruda[] = [];
  for (const r of respuestas) {
    const q = porId.get(r.questionId);
    if (!q) continue;
    const texto = (r.valorTexto ?? '').trim().slice(0, 4000) || null;

    if (q.tipo === 'escala') {
      const valores = escalaDe(q.escala).puntos.map((p) => p.valor);
      if (r.valorNum === null || r.valorNum === undefined || !valores.includes(r.valorNum)) continue;
      const filaClave = q.filas.length > 0 ? r.filaClave ?? null : null;
      if (q.filas.length > 0 && !q.filas.some((f) => f.clave === filaClave)) continue;
      out.push({ questionId: q.id, filaClave, valorNum: r.valorNum });
      continue;
    }
    if (q.tipo === 'texto') {
      if (!texto) continue;
      out.push({ questionId: q.id, valorTexto: texto });
      continue;
    }
    const opcionValida = r.opcionClave && q.opciones.some((o) => o.clave === r.opcionClave);
    if (opcionValida) {
      out.push({ questionId: q.id, opcionClave: r.opcionClave, valorTexto: texto });
      continue;
    }
    if (q.permiteOtra && texto) out.push({ questionId: q.id, opcionClave: 'otra', valorTexto: texto });
  }
  return out;
}

// ─── Variables de correo ──────────────────────────────────────────────────────

export const VARIABLES_CORREO = ['nombre', 'curso', 'titulo', 'enlace', 'curso_escolar'] as const;

export interface VarsCorreoInput {
  nombre: string;
  curso?: string | null;
  titulo: string;
  enlace: string;
  academicYear: string;
}

export function varsDeDestinatario(i: VarsCorreoInput): Record<string, string> {
  return {
    nombre: i.nombre,
    curso: i.curso ?? '',
    titulo: i.titulo,
    enlace: i.enlace,
    curso_escolar: i.academicYear,
  };
}

// ─── Presentación ─────────────────────────────────────────────────────────────

export function claseLabel(c: { curso: string; letra: string | null }): string {
  return c.letra && c.letra !== 'PDC' ? `${c.curso} ${c.letra}` : c.curso;
}

export function categoriaLabel(v: string): string {
  return CATEGORIAS.find((c) => c.value === v)?.label ?? v;
}

export function audienciaLabel(v: string): string {
  return AUDIENCIAS.find((a) => a.value === v)?.label ?? v;
}

/** Curso académico anterior a uno dado: '2025-26' → '2024-25'. */
export function academicYearAnterior(year: string): string {
  const m = year.match(/^(\d{4})-(\d{2})$/);
  if (!m) return year;
  const inicio = Number(m[1]) - 1;
  return `${inicio}-${String((inicio + 1) % 100).padStart(2, '0')}`;
}

/**
 * Primer curso del que hay (o puede haber) evaluaciones. Antes de esto no existe el
 * módulo, así que ofrecer 2022-23 en un selector es ruido puro.
 */
export const PRIMER_CURSO = '2025-26';

function anioInicio(year: string): number | null {
  const m = year.match(/^(\d{4})-(\d{2})$/);
  return m ? Number(m[1]) : null;
}

function formatearCurso(inicio: number): string {
  return `${inicio}-${String((inicio + 1) % 100).padStart(2, '0')}`;
}

/**
 * Cursos del selector, del más nuevo al más viejo: desde el siguiente al actual hasta
 * `PRIMER_CURSO`. Nunca ofrece cursos anteriores a que existiera el módulo.
 */
export function opcionesAcademicYear(actual: string): string[] {
  const desde = anioInicio(PRIMER_CURSO)!;
  const hasta = anioInicio(actual);
  if (hasta === null || hasta < desde) return [PRIMER_CURSO];
  const anios: string[] = [];
  for (let y = hasta + 1; y >= desde; y--) anios.push(formatearCurso(y));
  return anios;
}
