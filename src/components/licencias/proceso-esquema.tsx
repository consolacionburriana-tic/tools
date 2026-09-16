'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BookMarked,
  CheckCircle2,
  ChevronRight,
  Download,
  Gift,
  Mail,
  PiggyBank,
  RefreshCw,
  Send,
  TriangleAlert,
  Users,
} from 'lucide-react';

type Paso = {
  n: number;
  titulo: string;
  donde: string;
  boton?: string;
  href?: string;
  que: string;
  ojo?: string;
};

type Fase = {
  id: string;
  titulo: string;
  resumen: string;
  icono: React.ReactNode;
  // Clases fijas y completas: Tailwind no ve los nombres construidos por interpolación.
  color: { chip: string; chipOn: string; punto: string; borde: string; suave: string };
  pasos: Paso[];
};

const AZUL = {
  chip: 'text-blue-700 dark:text-blue-300',
  chipOn: 'bg-blue-600 text-white',
  punto: 'bg-blue-600',
  borde: 'border-blue-200 dark:border-blue-500/30',
  suave: 'bg-blue-50 dark:bg-blue-500/10',
};
const AMBAR = {
  chip: 'text-amber-700 dark:text-amber-300',
  chipOn: 'bg-amber-500 text-white',
  punto: 'bg-amber-500',
  borde: 'border-amber-200 dark:border-amber-500/30',
  suave: 'bg-amber-50 dark:bg-amber-500/10',
};
const MORADO = {
  chip: 'text-purple-700 dark:text-purple-300',
  chipOn: 'bg-purple-600 text-white',
  punto: 'bg-purple-600',
  borde: 'border-purple-200 dark:border-purple-500/30',
  suave: 'bg-purple-50 dark:bg-purple-500/10',
};
const VERDE = {
  chip: 'text-emerald-700 dark:text-emerald-300',
  chipOn: 'bg-emerald-600 text-white',
  punto: 'bg-emerald-600',
  borde: 'border-emerald-200 dark:border-emerald-500/30',
  suave: 'bg-emerald-50 dark:bg-emerald-500/10',
};

const FASES: Fase[] = [
  {
    id: 'preparar',
    titulo: 'Preparar la campaña',
    resumen: 'Dejar el catálogo y el alumnado al día antes de abrir a las familias.',
    icono: <RefreshCw className="h-4 w-4" />,
    color: AZUL,
    pasos: [
      {
        n: 1,
        titulo: 'Poner al día el catálogo de libros',
        donde: 'Sincronizar',
        boton: 'Google Sheets → Libros (catálogo)',
        href: '/gestion/licencias/sincronizar',
        que: 'Lee la pestaña «BBDD Libros» del Excel y actualiza los libros de la campaña: precios, ISBN, idioma y si es del banco de libros.',
        ojo: 'Los libros que ya no estén en el Excel se desactivan, nunca se borran, para no romper pedidos ya hechos.',
      },
      {
        n: 2,
        titulo: 'Poner al día el alumnado',
        donde: 'Sincronizar',
        boton: 'BBDD central → Alumnos',
        href: '/gestion/licencias/sincronizar',
        que: 'Trae de la base de datos central quién está matriculado, en qué clase y si es del banco de libros.',
        ojo: 'Tiene vista previa: enseña altas, bajas y cambios ANTES de escribir nada. Si un alumno con pedido confirmado cambia de curso o de banco, avisa.',
      },
      {
        n: 3,
        titulo: 'Repasar packs y fecha de cierre',
        donde: 'Packs / itinerarios · cabecera del panel',
        href: '/gestion/licencias/packs',
        que: 'Los packs agrupan los libros en el formulario para que la familia se aclare. La fecha de cierre cierra la campaña sola a las 23:59 de ese día.',
      },
      {
        n: 4,
        titulo: 'Generar los enlaces de las familias',
        donde: 'Enlaces de familias',
        boton: 'Generar los que falten',
        href: '/gestion/licencias/accesos',
        que: 'Un enlace personal por familia: entra sin teclear nada y ve a todos sus hijos de una vez.',
        ojo: 'Son credenciales. El CSV de enlaces da acceso a los pedidos de cada familia: se usa y se borra, no se sube a Drive.',
      },
    ],
  },
  {
    id: 'recoger',
    titulo: 'Recoger los pedidos',
    resumen: 'Abrir a las familias y perseguir a quien falte hasta cerrar el plazo.',
    icono: <Users className="h-4 w-4" />,
    color: AMBAR,
    pasos: [
      {
        n: 5,
        titulo: 'Abrir la campaña y avisar',
        donde: 'Cabecera del panel · Correos',
        boton: 'Abrir · Correos (modo familias)',
        href: '/gestion/licencias/correos',
        que: 'Se abre el formulario público y se manda el correo de estreno con el enlace personal de cada familia, filtrando por cursos y clases.',
        ojo: 'Antes del envío masivo, manda una prueba a ti y un envío real a UNA familia. Lo que sale ya no vuelve.',
      },
      {
        n: 6,
        titulo: 'Las familias hacen su pedido',
        donde: 'Formulario público',
        que: 'La familia entra por su enlace (o tecleando el DNI del tutor o el NIA), elige libros con el precio en vivo y confirma. Recibe correo de confirmación y puede volver a editarlo.',
        ojo: 'Al alumnado del banco de libros solo se le ofrecen los libros que NO cubre el banco (inglés, francés optativa…). El resto los recibe gratis.',
      },
      {
        n: 7,
        titulo: 'Perseguir a quien falta',
        donde: 'Quién falta · Correos',
        href: '/gestion/licencias/faltan',
        que: 'Listado de quién no ha pedido, por curso y clase, con recordatorio por correo. A quien no vaya a pedir, se le marca y deja de contar como pendiente.',
      },
      {
        n: 8,
        titulo: 'Cerrar el plazo',
        donde: 'Cabecera del panel',
        boton: 'Cerrar',
        que: 'Se cierra el formulario. A partir de aquí ya se puede pedir a las editoriales con números firmes.',
      },
    ],
  },
  {
    id: 'editoriales',
    titulo: 'Pedir a las editoriales',
    resumen: 'Dos pedidos separados: las de pago por un lado, las del banco de libros por otro.',
    icono: <BookMarked className="h-4 w-4" />,
    color: MORADO,
    pasos: [
      {
        n: 9,
        titulo: 'Son DOS pedidos separados, no uno',
        donde: 'Editoriales',
        href: '/gestion/licencias/editoriales',
        que: 'Las licencias de pago y las gratis del banco de libros se piden por vías distintas: dos informes, dos envíos y dos facturas. No se suman nunca.',
        ojo: 'Si solo mandas el de pago, te faltan todas las del banco de libros. Es el error que cuesta dinero y tiempo.',
      },
      {
        n: 10,
        titulo: 'Informe de las licencias DE PAGO',
        donde: 'Editoriales',
        boton: 'Descargar informe y marcar',
        href: '/gestion/licencias/editoriales',
        que: 'CSV agrupado por editorial y libro con lo que han pedido las familias. Al descargarlo, esos pedidos quedan marcados con 🧾 y ya no vuelven a salir.',
        ojo: 'Es incremental: si luego llegan pedidos nuevos, el siguiente informe traerá solo esos. Por eso no se puede deshacer desde la pantalla.',
      },
      {
        n: 11,
        titulo: 'Informe de las licencias GRATIS del banco',
        donde: 'Editoriales',
        boton: 'Descargar informe del banco',
        href: '/gestion/licencias/editoriales',
        que: 'El censo: cuántas licencias hacen falta de cada libro y de cada curso («48 de Lengua de Anaya de 1ESO, 46 de 3ESO…»). No sale de los pedidos: son «alumnos del banco × libros del banco de su curso», resueltos por idioma.',
        ojo: 'Este SÍ sale entero cada vez (es un censo, no un pendiente). Se pide una vez por campaña; si luego entra alumnado nuevo, pide a la editorial solo la diferencia. La pantalla te recuerda cuándo lo descargaste.',
      },
    ],
  },
  {
    id: 'enviar',
    titulo: 'Enviar las licencias',
    resumen: 'Cuando llegan los códigos, repartirlos a cada familia.',
    icono: <Send className="h-4 w-4" />,
    color: AZUL,
    pasos: [
      {
        n: 12,
        titulo: 'Descargar las plantillas de envío',
        donde: 'Exportar',
        boton: 'ENVIAR · NO / SÍ / GRATIS',
        href: '/gestion/licencias/exportar',
        que: 'Tres CSV, una fila por alumno y licencia, con su correo y el libro. La columna «Licencia Activación» va vacía a propósito.',
        ojo: 'Son tres porque son tres envíos distintos: los de pago sin banco, los de pago con banco, y los gratis del banco.',
      },
      {
        n: 13,
        titulo: 'Pegar en el Excel y poner los códigos',
        donde: 'Google Sheet · hojas ENVIAR',
        que: 'Se pegan las filas y se rellenan los códigos de activación que ha mandado la editorial.',
      },
      {
        n: 14,
        titulo: 'Mandar los correos con FormMule',
        donde: 'Google Sheet · FormMule',
        que: 'FormMule (ya configurado con la «Plantilla NEW») manda a cada familia su correo con los códigos.',
      },
      {
        n: 15,
        titulo: 'Marcar los pedidos como enviados',
        donde: 'Editoriales',
        boton: 'Marcar pasados a plantillas',
        href: '/gestion/licencias/editoriales',
        que: 'Deja los pedidos marcados con 📤 para saber de un vistazo cuáles ya se han mandado a la familia.',
      },
    ],
  },
  {
    id: 'cobrar',
    titulo: 'Cobrar',
    resumen: 'Pasar los importes a Educamos y llevar el control de quién ha pagado.',
    icono: <PiggyBank className="h-4 w-4" />,
    color: VERDE,
    pasos: [
      {
        n: 16,
        titulo: 'Sacar el fichero para Educamos',
        donde: 'Económica',
        boton: 'Educamos',
        href: '/gestion/licencias/economia',
        que: 'CSV con el ID de Educamos de cada alumno y su importe (con coma decimal), listo para cargar el cobro.',
        ojo: 'Solo salen los alumnos con importe mayor que cero. Quien solo tenga licencias del banco no paga nada y no aparece.',
      },
      {
        n: 17,
        titulo: 'Marcar quién ha pagado',
        donde: 'Pedidos',
        boton: 'Columna 💰',
        href: '/gestion/licencias/pedidos',
        que: 'Se marca pedido a pedido. Sirve para saber quién queda por cobrar.',
      },
      {
        n: 18,
        titulo: 'Seguir el cobro',
        donde: 'Económica',
        href: '/gestion/licencias/economia',
        que: 'Ingresos previstos, cobrado y pendiente, con el desglose por curso.',
      },
    ],
  },
];

export function ProcesoEsquema() {
  const [faseId, setFaseId] = useState(FASES[0].id);
  const [abierto, setAbierto] = useState<number | null>(null);
  const fase = FASES.find((f) => f.id === faseId) ?? FASES[0];

  return (
    <div className="space-y-5">
      {/* Recorrido de fases */}
      <div className="flex flex-wrap gap-2">
        {FASES.map((f, i) => {
          const on = f.id === faseId;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFaseId(f.id);
                setAbierto(null);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                on
                  ? f.color.chipOn
                  : `border border-zinc-200 bg-white ${f.color.chip} hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800`
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                  on ? 'bg-white/25' : 'bg-zinc-100 dark:bg-zinc-800'
                }`}
              >
                {i + 1}
              </span>
              {f.titulo}
            </button>
          );
        })}
      </div>

      {/* Cabecera de la fase */}
      <div className={`rounded-2xl border p-4 ${fase.color.borde} ${fase.color.suave}`}>
        <p className={`flex items-center gap-2 font-semibold ${fase.color.chip}`}>
          {fase.icono} {fase.titulo}
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{fase.resumen}</p>
      </div>

      {/* Pasos de la fase, en línea de tiempo */}
      <ol className="relative space-y-3 border-l-2 border-dashed border-zinc-200 pl-6 dark:border-zinc-700">
        {fase.pasos.map((p) => {
          const open = abierto === p.n;
          return (
            <li key={p.n} className="relative">
              <span
                className={`absolute -left-[31px] top-3 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white ${fase.color.punto}`}
              >
                {p.n}
              </span>
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => setAbierto(open ? null : p.n)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-zinc-900 dark:text-zinc-100">{p.titulo}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                      <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">{p.donde}</span>
                      {p.boton && (
                        <span className={`rounded-md px-1.5 py-0.5 ${fase.color.suave} ${fase.color.chip}`}>
                          {p.boton}
                        </span>
                      )}
                    </span>
                  </span>
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
                  />
                </button>
                {open && (
                  <div className="space-y-2 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">{p.que}</p>
                    {p.ojo && (
                      <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{p.ojo}</span>
                      </p>
                    )}
                    {p.href && (
                      <Link
                        href={p.href}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        Ir a {p.donde.split(' · ')[0]} <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Las dos cosas que más se lían */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-500/30 dark:bg-purple-500/10">
          <p className="flex items-center gap-2 text-sm font-semibold text-purple-800 dark:text-purple-200">
            <Download className="h-4 w-4" /> De pago ≠ del banco
          </p>
          <p className="mt-1 text-xs text-purple-900/80 dark:text-purple-200/80">
            Son <strong>dos pedidos independientes</strong>, nunca se suman. Las <strong>de pago</strong> salen de los
            pedidos de las familias y se piden a trozos según van llegando. Las <strong>del banco</strong> no salen de
            ningún pedido: son todo el alumnado del banco por los libros de su curso, y se piden de una vez.
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="h-4 w-4" /> Los tres sellos de un pedido
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-emerald-900/80 dark:text-emerald-200/80">
            <li>🧾 pedido a la editorial</li>
            <li>📤 pasado a plantillas de envío (la familia ya tiene su código)</li>
            <li>💰 pagado</li>
          </ul>
          <p className="mt-1 text-xs text-emerald-900/70 dark:text-emerald-200/70">
            Se ven en la lista de <strong>Pedidos</strong>, uno por columna.
          </p>
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-zinc-400">
        <Gift className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Todo lo que aquí sale como CSV se puede seguir haciendo a mano en el Excel de siempre: los ficheros son el
        mismo formato de las hojas del Sheet. La app no quita el Excel, lo rellena.
      </p>
      <p className="flex items-start gap-1.5 text-xs text-zinc-400">
        <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Los correos a familias salen de <strong>licencias@consolacionburriana.com</strong>, que es también donde
        contestan.
      </p>
    </div>
  );
}
