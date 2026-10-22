'use client';

// El escaparate de /gestion/diseno: cada pieza común con sus variantes, para elegir sin leer
// código y para copiar la línea de `import`. Todo con datos inventados (no consulta nada).
import { useState } from 'react';
import { toast } from 'sonner';
import {
  CalendarDays,
  Check,
  Coins,
  Download,
  FileText,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Plus,
  Save,
  Tablet,
  Trash2,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { MODULOS } from '@/lib/modulos';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Selector } from '@/components/ui/selector';
import { Campo } from '@/components/ui/campo';
import { Segmentado, Secciones } from '@/components/ui/segmentado';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Tarjeta, TarjetaCabecera, TarjetaCuerpo, TarjetaEnlace } from '@/components/ui/tarjeta';
import { Cifra, Cifras } from '@/components/ui/cifra';
import { Vacio } from '@/components/ui/vacio';
import { Aviso } from '@/components/ui/aviso';
import { ConfirmarDialogo, ConfirmarEnLinea, useConfirmar } from '@/components/ui/confirmar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BarraAcciones } from '@/components/ui/barra-acciones';
import { EnCurso, Progreso } from '@/components/ui/progreso';
import { Interruptor } from '@/components/ui/interruptor';
import { Copiable, CopiarLista, Dato } from '@/components/ui/copiable';
import { Rotulo } from '@/components/ui/rotulo';
import { Avatar, Avatares } from '@/components/ui/avatar';
import { IconoModulo } from '@/components/ui/icono-modulo';
import { TituloPagina } from '@/components/ui/cabecera-modulo';
import { Skeleton, SkeletonKpis, SkeletonRows, SkeletonTabla } from '@/components/ui/skeleton';

const PERSONAS = [
  { email: 'ana.perez@ejemplo.es', nombre: 'Ana Pérez' },
  { email: 'luis.gil@ejemplo.es', nombre: 'Luis Gil' },
  { email: 'marta.soler@ejemplo.es', nombre: 'Marta Soler' },
  { email: 'pau.ribes@ejemplo.es', nombre: 'Pau Ribes' },
  { email: 'irene.mas@ejemplo.es', nombre: 'Irene Mas' },
];

const PIEZAS = [
  ['botones', 'Botones'],
  ['campos', 'Campos'],
  ['vistas', 'Vistas y filtros'],
  ['estados', 'Estados'],
  ['tarjetas', 'Tarjetas'],
  ['cifras', 'Cifras'],
  ['vacio', 'Vacío y avisos'],
  ['confirmar', 'Confirmar'],
  ['ventanas', 'Ventanas'],
  ['barra', 'Barra de abajo'],
  ['progreso', 'Progreso'],
  ['interruptor', 'Interruptor'],
  ['copiar', 'Copiar'],
  ['personas', 'Personas'],
  ['modulos', 'Módulos'],
  ['titulos', 'Títulos'],
  ['carga', 'Carga'],
] as const;

function Pieza({
  id,
  titulo,
  para,
  importa,
  children,
}: {
  id: (typeof PIEZAS)[number][0];
  titulo: string;
  para: React.ReactNode;
  importa: string;
  children: React.ReactNode;
}) {
  return (
    <Tarjeta as="section" id={id} aria-labelledby={`t-${id}`} className="scroll-mt-20">
      <TarjetaCabecera id={`t-${id}`} titulo={titulo} descripcion={para} />
      <TarjetaCuerpo className="space-y-5">
        <Copiable valor={importa} etiqueta="import" mono className="text-xs text-zinc-600 dark:text-zinc-300">
          {importa}
        </Copiable>
        {children}
      </TarjetaCuerpo>
    </Tarjeta>
  );
}

function Fila({ nombre, children }: { nombre: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Rotulo as="h3">{nombre}</Rotulo>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Escaparate() {
  const [vista, setVista] = useState<'lista' | 'clase' | 'cuotas'>('lista');
  const [filtro, setFiltro] = useState<'todos' | 'aviso' | 'hechos'>('todos');
  const [encendido, setEncendido] = useState(true);
  const [dialogo, setDialogo] = useState<'centrado' | 'hoja' | 'palabra' | null>(null);
  const [barra, setBarra] = useState(false);
  const [avance, setAvance] = useState(7);
  const { confirmar, pedirTexto, dialogo: preguntas } = useConfirmar();

  return (
    <div className="space-y-6">
      <Aviso tono="info" titulo="Las piezas comunes de la app">
        Están en <code className="font-mono text-xs">src/components/ui/</code> y las reglas para usarlas, en{' '}
        <code className="font-mono text-xs">docs/diseno.md</code>. Si una pantalla necesita algo que no está aquí, se crea
        aquí. Toca la línea de <code className="font-mono text-xs">import</code> de cada pieza para copiarla.
      </Aviso>

      <nav aria-label="Piezas" className="flex flex-wrap gap-2">
        {PIEZAS.map(([id, nombre]) => (
          <a key={id} href={`#${id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            {nombre}
          </a>
        ))}
      </nav>

      <Pieza
        id="botones"
        titulo="Button"
        para="44 px. Azul para la acción principal (una por pantalla); el resto, outline o ghost. Para un enlace con forma de botón, buttonVariants()."
        importa="import { Button, buttonVariants } from '@/components/ui/button';"
      >
        <Fila nombre="Variantes">
          <Button>
            <Save /> Guardar
          </Button>
          <Button variant="outline">
            <Download /> Exportar
          </Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="ghost">Cancelar</Button>
          <Button variant="destructive">
            <Trash2 /> Borrar
          </Button>
          <Button variant="destructive-solid">Sí, borrar</Button>
          <Button variant="link">Ver todo</Button>
        </Fila>
        <Fila nombre="Tamaños">
          <Button size="lg">Grande · 48</Button>
          <Button>Normal · 44</Button>
          <Button size="sm">Pequeño · 40</Button>
          <Button size="icon" variant="outline" aria-label="Añadir">
            <Plus />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Borrar">
            <Trash2 />
          </Button>
          <Button disabled>Desactivado</Button>
        </Fila>
      </Pieza>

      <Pieza
        id="campos"
        titulo="Input · Textarea · Selector · Campo"
        para="La misma receta para todos: 44 px, borde gris y foco azul. Campo pone la etiqueta, la ayuda y el error."
        importa="import { Input } from '@/components/ui/input';"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre" id="d-nombre" ayuda="Como lo escribe la familia.">
            <Input id="d-nombre" placeholder="Ana Pérez" />
          </Campo>
          <Campo etiqueta="Clase" id="d-clase">
            <Selector id="d-clase" defaultValue="3B">
              <option value="3A">3º ESO A</option>
              <option value="3B">3º ESO B</option>
            </Selector>
          </Campo>
          <Campo etiqueta="Correo" id="d-correo" error="Falta la @.">
            <Input id="d-correo" defaultValue="ana.perez" aria-invalid />
          </Campo>
          <Campo etiqueta="Comentario" id="d-coment" opcional>
            <Textarea id="d-coment" placeholder="Lo que haga falta saber" />
          </Campo>
        </div>
      </Pieza>

      <Pieza
        id="vistas"
        titulo="Segmentado · Secciones · Filtro"
        para="Segmentado para cambiar de vista; Secciones cuando cada vista es una ruta (lo pinta PaginaModulo); Filtro para filtrar una lista."
        importa="import { Segmentado } from '@/components/ui/segmentado';"
      >
        <Fila nombre="Segmentado">
          <Segmentado
            etiqueta="Ver por"
            valor={vista}
            onChange={setVista}
            opciones={[
              { valor: 'lista', etiqueta: 'Alumnado', icono: <Users /> },
              { valor: 'clase', etiqueta: 'Cuotas', icono: <Coins /> },
              { valor: 'cuotas', etiqueta: 'iPads', icono: <Tablet />, cuenta: 12 },
            ]}
          />
        </Fila>
        <Fila nombre="Secciones (enlaces)">
          <Secciones
            secciones={[
              { href: '/gestion/diseno', etiqueta: 'Panel', icono: <LayoutDashboard /> },
              { href: '/gestion/diseno#registros', etiqueta: 'Registros', icono: <ListChecks /> },
              { href: '/gestion/diseno#horario', etiqueta: 'Horario', icono: <CalendarDays /> },
            ]}
          />
        </Fila>
        <Fila nombre="Filtro">
          <Filtros etiqueta="Mostrar">
            <Filtro activo={filtro === 'todos'} onClick={() => setFiltro('todos')} cuenta={24}>
              Todos
            </Filtro>
            <Filtro activo={filtro === 'aviso'} onClick={() => setFiltro('aviso')} cuenta={3} tono="aviso">
              Con aviso
            </Filtro>
            <Filtro activo={filtro === 'hechos'} onClick={() => setFiltro('hechos')} cuenta={21} tono="ok">
              Hechos
            </Filtro>
          </Filtros>
        </Fila>
      </Pieza>

      <Pieza
        id="estados"
        titulo="Estado · Etiqueta"
        para="Estado: verde hecho, ámbar falta algo, rojo error, azul informativo, gris pendiente. Etiqueta: un dato corto (clase, código, ruta)."
        importa="import { Estado } from '@/components/ui/estado';"
      >
        <Fila nombre="Estado">
          <Estado tono="ok" icono={<Check />}>
            Pagado
          </Estado>
          <Estado tono="aviso" icono={<TriangleAlert />}>
            Falta la firma
          </Estado>
          <Estado tono="error">Rechazado</Estado>
          <Estado tono="info">En curso</Estado>
          <Estado tono="neutro">Pendiente</Estado>
        </Fila>
        <Fila nombre="Etiqueta">
          <Etiqueta>3º ESO B</Etiqueta>
          <Etiqueta mono>/Alumnado/ESO/3B</Etiqueta>
          <Etiqueta mono>NIA 10293847</Etiqueta>
        </Fila>
      </Pieza>

      <Pieza
        id="tarjetas"
        titulo="Tarjeta · TarjetaCabecera · TarjetaEnlace"
        para="Borde fino, sin sombra. TarjetaEnlace lleva a otra pantalla (con flecha y ruedecita mientras carga)."
        importa="import { Tarjeta, TarjetaCabecera, TarjetaCuerpo, TarjetaEnlace } from '@/components/ui/tarjeta';"
      >
        <Tarjeta>
          <TarjetaCabecera
            titulo="Pedidos de 3º ESO"
            descripcion="24 familias · 3 sin pagar"
            accion={
              <Button size="sm" variant="outline">
                <Download /> Exportar
              </Button>
            }
          />
          <TarjetaCuerpo className="text-sm text-zinc-600 dark:text-zinc-300">El contenido de la tarjeta.</TarjetaCuerpo>
        </Tarjeta>
        <TarjetaEnlace
          href="/gestion/diseno#tarjetas"
          icono={<FileText />}
          titulo="Envíos de códigos"
          descripcion="Pega los códigos de la editorial y mándalos a las familias."
          extra={<Estado tono="aviso">4 sin enviar</Estado>}
        />
      </Pieza>

      <Pieza
        id="cifras"
        titulo="Cifras · Cifra"
        para="Dos columnas en el móvil, cuatro desde el iPad. Barra para la parte del total; punto para la categoría; tono para lo que pide atención."
        importa="import { Cifra, Cifras } from '@/components/ui/cifra';"
      >
        <Cifras>
          <Cifra etiqueta="Alumnado" valor="639" nota="12 altas este mes" />
          <Cifra etiqueta="Infantil" valor="118" punto="bg-violet-500" barra={118 / 639} />
          <Cifra etiqueta="Sin pagar" valor="23" tono="aviso" nota="Ver quién" />
          <Cifra etiqueta="Pagado" valor="92 %" icono={<Coins />} barra={0.92} />
        </Cifras>
      </Pieza>

      <Pieza
        id="vacio"
        titulo="Vacio · Aviso"
        para="Vacio cuando no hay nada que enseñar (qué pasa y qué hacer). Aviso para algo que hay que saber en la página."
        importa="import { Vacio } from '@/components/ui/vacio';"
      >
        <Vacio
          icono={<Inbox />}
          titulo="Ni un retraso en este periodo"
          accion={
            <Button size="sm">
              <Plus /> Registrar un retraso
            </Button>
          }
        >
          En cuanto se registre el primero, aquí saldrán la tendencia y quién acumula.
        </Vacio>
        <div className="space-y-2">
          <Aviso tono="info">La campaña de licencias se cierra el viernes 24.</Aviso>
          <Aviso tono="aviso" titulo="Faltan 3 tutores">
            Sin tutor, sus familias no reciben el correo.
          </Aviso>
          <Aviso tono="error">No se ha podido conectar con Google. Vuelve a probar en un rato.</Aviso>
          <Aviso tono="ok" accion={<Button size="sm" variant="outline">Ver</Button>}>
            Los 24 correos se han enviado.
          </Aviso>
        </div>
      </Pieza>

      <Pieza
        id="confirmar"
        titulo="ConfirmarEnLinea · ConfirmarDialogo · useConfirmar"
        para="Nunca confirm() ni prompt(). Una cosa: en línea. Muchas: diálogo. Sin vuelta atrás: escribir la palabra. Si se puede rehacer: Deshacer en el toast."
        importa="import { ConfirmarEnLinea, ConfirmarDialogo, useConfirmar } from '@/components/ui/confirmar';"
      >
        <Fila nombre="En línea">
          <ConfirmarEnLinea
            etiqueta="Borrar"
            icono={<Trash2 />}
            pregunta="¿Borrar la salida a Valencia?"
            onConfirmar={() => toast.success('Salida borrada (de mentira)')}
          />
          <ConfirmarEnLinea etiqueta="Quitar" onConfirmar={() => toast.success('Quitado')} confirmar="Sí, quitar" />
        </Fila>
        <Fila nombre="En diálogo">
          <Button variant="destructive" onClick={() => setDialogo('palabra')}>
            Suspender 12 cuentas
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              if (await confirmar({ titulo: '¿Borrar la columna «Hecho»?', descripcion: 'Sus 4 tarjetas pasan a «Por hacer».', boton: 'Borrar columna' }))
                toast.success('Columna borrada (de mentira)');
            }}
          >
            useConfirmar
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const nombre = await pedirTexto({ titulo: 'Renombrar el tablero', etiqueta: 'Nombre', valor: 'Equipo TIC' });
              if (nombre !== null) toast.success(`Ahora se llama «${nombre}»`);
            }}
          >
            pedirTexto
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast('Pregunta borrada', { action: { label: 'Deshacer', onClick: () => toast.success('Recuperada') } })
            }
          >
            Toast con Deshacer
          </Button>
        </Fila>
        <ConfirmarDialogo
          abierto={dialogo === 'palabra'}
          onCerrar={() => setDialogo(null)}
          onConfirmar={() => toast.success('Suspendidas (de mentira)')}
          titulo="Suspender 12 cuentas"
          descripcion="No podrán entrar en Google hasta que se reactiven."
          boton="Suspender 12"
          palabra="SUSPENDER"
        />
        {preguntas}
      </Pieza>

      <Pieza
        id="ventanas"
        titulo="Dialog"
        para={'Centrado por defecto. variante="hoja" sube desde abajo en el móvil (para fichas y detalles).'}
        importa="import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';"
      >
        <Fila nombre="Variantes">
          <Button variant="outline" onClick={() => setDialogo('centrado')}>
            Centrado
          </Button>
          <Button variant="outline" onClick={() => setDialogo('hoja')}>
            Hoja
          </Button>
        </Fila>
        <Dialog open={dialogo === 'centrado' || dialogo === 'hoja'} onOpenChange={(o) => !o && setDialogo(null)}>
          <DialogContent variante={dialogo === 'hoja' ? 'hoja' : 'centrado'}>
            <DialogHeader>
              <DialogTitle>Matemáticas · 3º ESO B</DialogTitle>
              <DialogDescription>Lunes · 9:00–9:55 · Aula 12</DialogDescription>
            </DialogHeader>
            <div className="space-y-1">
              <Dato etiqueta="Profesor" valor="Luis Gil" />
              <Dato etiqueta="Grupo" valor="3º ESO B" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogo(null)}>
                Cerrar
              </Button>
              <Button onClick={() => setDialogo(null)}>Editar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Pieza>

      <Pieza
        id="barra"
        titulo="BarraAcciones"
        para="Fija abajo, con el área segura del iPhone y hueco para el botón de Tareas. Los recuentos, dentro de los botones."
        importa="import { BarraAcciones } from '@/components/ui/barra-acciones';"
      >
        <Interruptor activo={barra} onChange={setBarra} etiqueta="Enseñar la barra" descripcion="Como si hubiera 4 calendarios elegidos." />
        <BarraAcciones visible={barra} resumen="4 calendarios elegidos">
          <Button variant="ghost" onClick={() => setBarra(false)}>
            Quitar selección
          </Button>
          <Button variant="destructive-solid" onClick={() => setBarra(false)}>
            <Trash2 /> Borrar 4
          </Button>
        </BarraAcciones>
      </Pieza>

      <Pieza
        id="progreso"
        titulo="Progreso · EnCurso"
        para="Progreso: cuánto lleva algo (azul, verde al 100 %). EnCurso: una tarea larga del servidor."
        importa="import { Progreso, EnCurso } from '@/components/ui/progreso';"
      >
        <div className="flex items-center gap-3">
          <Progreso hechos={avance} total={12} etiqueta="Tareas hechas" cuenta className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => setAvance((a) => (a >= 12 ? 0 : a + 1))}>
            +1
          </Button>
        </div>
        <EnCurso texto="Creando correos en Google…" hechos={17} total={40} />
      </Pieza>

      <Pieza
        id="interruptor"
        titulo="Interruptor"
        para="Un sí/no que se aplica al momento. En un formulario con botón de guardar, mejor una casilla."
        importa="import { Interruptor } from '@/components/ui/interruptor';"
      >
        <Interruptor
          activo={encendido}
          onChange={setEncendido}
          etiqueta="Avisar al tutor"
          descripcion="Al tercer retraso del trimestre."
        />
      </Pieza>

      <Pieza
        id="copiar"
        titulo="Copiable · Dato · CopiarLista"
        para="El valor entero es el botón; confirma cambiando a «copiado», sin toast."
        importa="import { Copiable, Dato, CopiarLista } from '@/components/ui/copiable';"
      >
        <div className="max-w-sm space-y-1">
          <Dato etiqueta="NIA" valor="10293847" mono />
          <Dato etiqueta="Correo" valor="familia.perez@ejemplo.es" />
          <Dato etiqueta="Teléfono" valor="" />
        </div>
        <Fila nombre="Lista">
          <CopiarLista valores={['ana@ejemplo.es', 'luis@ejemplo.es']} etiqueta="Correos" />
        </Fila>
      </Pieza>

      <Pieza
        id="personas"
        titulo="Avatar · Avatares · Rotulo"
        para="Iniciales con el color de cada persona (sale de su correo). Rotulo: el encabezado pequeño de un grupo."
        importa="import { Avatar, Avatares } from '@/components/ui/avatar';"
      >
        <Fila nombre="Avatar">
          {PERSONAS.slice(0, 3).map((p) => (
            <Avatar key={p.email} {...p} tamano="lg" />
          ))}
          <Avatares personas={PERSONAS} />
        </Fila>
        <Rotulo accion={<Button size="sm" variant="ghost">Ver todo</Button>}>Ahora</Rotulo>
      </Pieza>

      <Pieza
        id="modulos"
        titulo="IconoModulo"
        para="El icono de cada módulo con el color de su grupo: solo aquí, en la cabecera y en el escritorio."
        importa="import { IconoModulo } from '@/components/ui/icono-modulo';"
      >
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(MODULOS).map(([clave, m]) => (
            <li key={clave} className="flex items-center gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
              <IconoModulo icono={m.icono} grupo={m.grupo} tamano="sm" />
              {m.titulo}
            </li>
          ))}
        </ul>
      </Pieza>

      <Pieza
        id="titulos"
        titulo="TituloPagina"
        para="Solo en la página de una cosa concreta (un alumno, un tablero). El resto de páginas no repite el nombre del módulo: llevan un h1 oculto."
        importa="import { TituloPagina } from '@/components/ui/cabecera-modulo';"
      >
        <TituloPagina
          antes="3º ESO B · tutora Ana Pérez"
          descripcion="Llegó en septiembre · 4 de 6 pasos hechos"
          acciones={<Button size="sm" variant="outline">Editar</Button>}
          className="mb-0"
        >
          Pau Ribes Mas
        </TituloPagina>
      </Pieza>

      <Pieza
        id="carga"
        titulo="Esqueletos de carga"
        para="Para los loading.tsx: la misma forma que la pantalla que llega, dentro de SkeletonPage (que lo anuncia)."
        importa="import { SkeletonPage, SkeletonKpis, SkeletonRows, SkeletonTabla } from '@/components/ui/skeleton';"
      >
        <SkeletonKpis />
        <SkeletonRows n={2} />
        <SkeletonTabla n={3} columnas={4} />
        <Skeleton className="h-4 w-1/2" />
      </Pieza>
    </div>
  );
}
