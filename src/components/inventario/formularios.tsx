'use client';

// Los formularios de Inventario y aulas: un aula, su audiovisual y sus mesas y sillas. Se usan en
// la ficha del aula y en las hojas de las tablas, para que se edite igual desde todas partes.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import {
  ACCIONES_AV,
  ACCION_AV_LABEL,
  AUDIOS,
  AUDIO_LABEL,
  PANTALLAS,
  PANTALLA_LABEL,
  PISOS,
  PISO_LABEL,
  cuadreMobiliario,
  textoCuadre,
  type AccionAv,
  type Audio,
  type Pantalla,
  type Piso,
} from '@/lib/inventario';
import type { AulaInv, AvInv, MobiliarioInv } from '@/lib/inventario-server';
import { guardarAula, guardarAv, guardarMobiliario } from '@/app/gestion/inventario/acciones';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Selector } from '@/components/ui/selector';
import { Segmentado } from '@/components/ui/segmentado';
import { Interruptor } from '@/components/ui/interruptor';
import { Estado } from '@/components/ui/estado';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Contador, Estrellas, useAccion } from './comun';

// ─── Audiovisual ─────────────────────────────────────────────────────────────

export function FormAv({ aulaId, av, onHecho }: { aulaId: string; av: AvInv | null; onHecho?: () => void }) {
  const [pantalla, setPantalla] = useState<Pantalla | null>((av?.pantalla as Pantalla) ?? null);
  const [marca, setMarca] = useState(av?.marca ?? '');
  const [audio, setAudio] = useState<Audio | ''>((av?.audio as Audio) ?? '');
  const [appleTv, setAppleTv] = useState(av?.appleTv ?? false);
  const [valoracion, setValoracion] = useState<number | null>(av?.valoracion ?? null);
  const [accion, setAccion] = useState<AccionAv>((av?.accion as AccionAv) ?? 'correcto');
  const [notas, setNotas] = useState(av?.notas ?? '');
  const { correr, ocupado } = useAccion();

  async function guardar() {
    const r = await correr(
      () => guardarAv({ aulaId, pantalla, marca, audio: audio || null, appleTv, valoracion, accion, notas }),
      'Audiovisual guardado',
    );
    if (r !== false) onHecho?.();
  }

  return (
    <div className="space-y-4">
      <Campo etiqueta="Pantalla">
        <Segmentado
          etiqueta="Pantalla"
          opciones={PANTALLAS.map((p) => ({ valor: p, etiqueta: PANTALLA_LABEL[p] }))}
          valor={pantalla}
          onChange={setPantalla}
        />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Marca y modelo" id="av-marca" opcional>
          <Input id="av-marca" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Epson EB-X20, HKC 50″…" />
        </Campo>
        <Campo etiqueta="Audio" id="av-audio">
          <Selector id="av-audio" value={audio} onChange={(e) => setAudio(e.target.value as Audio | '')}>
            <option value="">Sin apuntar</option>
            {AUDIOS.map((a) => (
              <option key={a} value={a}>
                {AUDIO_LABEL[a]}
              </option>
            ))}
          </Selector>
        </Campo>
      </div>
      <Interruptor activo={appleTv} onChange={setAppleTv} etiqueta="Tiene Apple TV" />
      <Campo etiqueta="Cómo se ve y se oye" ayuda="De 0 (no funciona) a 5 (perfecto). Toca la misma estrella para dejarlo sin valorar.">
        <Estrellas valor={valoracion} onChange={setValoracion} />
      </Campo>
      <Campo etiqueta="Qué hay que hacer" id="av-accion">
        <Selector id="av-accion" value={accion} onChange={(e) => setAccion(e.target.value as AccionAv)}>
          {ACCIONES_AV.map((a) => (
            <option key={a} value={a}>
              {ACCION_AV_LABEL[a]}
            </option>
          ))}
        </Selector>
      </Campo>
      <Campo etiqueta="Notas" id="av-notas" opcional>
        <Textarea id="av-notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} />
      </Campo>
      <Button onClick={guardar} cargando={ocupado}>
        <Save aria-hidden /> Guardar audiovisual
      </Button>
    </div>
  );
}

// ─── Mesas y sillas ──────────────────────────────────────────────────────────

export function FormMobiliario({
  aulaId,
  mob,
  alumnos,
  curso,
  onHecho,
}: {
  aulaId: string;
  mob: MobiliarioInv | null;
  alumnos: number | null;
  curso: string | null;
  onHecho?: () => void;
}) {
  const [sillas, setSillas] = useState<number | null>(mob?.sillas ?? null);
  const [mesas, setMesas] = useState<number | null>(mob?.mesas ?? null);
  const [notas, setNotas] = useState(mob?.notas ?? '');
  const { correr, ocupado } = useAccion();
  const c = cuadreMobiliario({ sillas, mesas }, alumnos, curso);

  async function guardar() {
    const r = await correr(() => guardarMobiliario({ aulaId, sillas, mesas, notas }), 'Mesas y sillas guardadas');
    if (r !== false) onHecho?.();
  }

  return (
    <div className="space-y-4">
      {alumnos !== null && <p className="text-sm text-zinc-600 dark:text-zinc-400">{alumnos} alumnos en la clase este curso.</p>}
      <div className="flex flex-wrap gap-6">
        <Campo etiqueta="Sillas">
          <div className="flex items-center gap-3">
            <Contador valor={sillas} onChange={setSillas} etiqueta="Sillas" />
            {c.sillas !== null && <Estado tono={c.sillas < 0 ? 'aviso' : 'ok'}>{textoCuadre(c.sillas)}</Estado>}
          </div>
        </Campo>
        <Campo etiqueta="Mesas">
          <div className="flex items-center gap-3">
            <Contador valor={mesas} onChange={setMesas} etiqueta="Mesas" />
            {c.mesas !== null && <Estado tono={c.mesas < 0 ? 'aviso' : 'ok'}>{textoCuadre(c.mesas)}</Estado>}
          </div>
        </Campo>
      </div>
      <Campo etiqueta="Notas" id="mob-notas" opcional ayuda="Sillas o mesas de otro tamaño, lo que hay en el pasillo…">
        <Textarea id="mob-notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
      </Campo>
      <Button onClick={guardar} cargando={ocupado}>
        <Save aria-hidden /> Guardar mesas y sillas
      </Button>
    </div>
  );
}

// ─── El aula ─────────────────────────────────────────────────────────────────

export function FormAula({ aula, onHecho }: { aula: AulaInv | null; onHecho?: (id: string) => void }) {
  const [numero, setNumero] = useState(aula?.numero ?? '');
  const [piso, setPiso] = useState<Piso | ''>((aula?.piso as Piso) ?? '');
  const [nombre, setNombre] = useState(aula?.nombre ?? '');
  const [notas, setNotas] = useState(aula?.notas ?? '');
  const { correr, ocupado } = useAccion();

  async function guardar() {
    const r = await correr(
      () => guardarAula({ id: aula?.id, numero, piso: piso || null, nombre, notas }),
      aula ? 'Aula guardada' : 'Aula añadida',
    );
    if (r !== false) onHecho?.(aula?.id ?? '');
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Número de la puerta" id="aula-numero" ayuda="Vacío si es una sala sin número">
          <Input id="aula-numero" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="12, 17-18…" />
        </Campo>
        <Campo etiqueta="Piso" id="aula-piso">
          <Selector id="aula-piso" value={piso} onChange={(e) => setPiso(e.target.value as Piso | '')}>
            <option value="">Sin apuntar</option>
            {PISOS.map((p) => (
              <option key={p} value={p}>
                {PISO_LABEL[p]}
              </option>
            ))}
          </Selector>
        </Campo>
      </div>
      <Campo etiqueta="Nombre de la sala" id="aula-nombre" opcional ayuda="Solo si es una sala fija: Música, Informática, Taller de tecnología…">
        <Input id="aula-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </Campo>
      <Campo etiqueta="Notas del aula" id="aula-notas" opcional>
        <Textarea id="aula-notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
      </Campo>
      <Button onClick={guardar} cargando={ocupado}>
        <Save aria-hidden /> {aula ? 'Guardar el aula' : 'Añadir el aula'}
      </Button>
    </div>
  );
}

export function NuevaAula({ onCerrar }: { onCerrar: () => void }) {
  const router = useRouter();
  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent variante="hoja" className="sm:max-w-lg">
        <DialogTitle>Añadir aula o sala</DialogTitle>
        <DialogDescription>Por el número de su puerta. La clase que la ocupa se pone en «Clases de cada aula».</DialogDescription>
        <FormAula
          aula={null}
          onHecho={() => {
            onCerrar();
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
