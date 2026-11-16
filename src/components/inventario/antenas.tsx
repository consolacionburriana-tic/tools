'use client';

// Antenas wifi: el nombre que tienen y el que les toca (por número de aula, `P2_15`, o por pasillo,
// `P1_PASILLO_ASCENSOR`). La parte de «aula del curso 22/23» del Excel se dejó fuera: estaba
// obsoleta, y el aula de una antena se lee de su número de puerta.
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import { PISOS, PISO_LABEL, antenaPorRenombrar, etiquetaPiso, nombreAntenaDeAula, type Piso } from '@/lib/inventario';
import type { AntenaInv, Inventario } from '@/lib/inventario-server';
import { guardarAntena, marcarAntenaRenombrada, quitarAntena } from '@/app/gestion/inventario/acciones';
import { Button, buttonVariants } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Selector } from '@/components/ui/selector';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Estado } from '@/components/ui/estado';
import { Cifra, Cifras } from '@/components/ui/cifra';
import { Rotulo } from '@/components/ui/rotulo';
import { Tarjeta } from '@/components/ui/tarjeta';
import { ConfirmarEnLinea } from '@/components/ui/confirmar';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { OpcionesAulas, etiquetaAula, useAccion, useIndice, type FilaAula } from './comun';

export function Antenas({ inv }: { inv: Inventario }) {
  const filas = useIndice(inv);
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [editando, setEditando] = useState<AntenaInv | 'nueva' | null>(null);
  const { correr, clave } = useAccion();
  const aulas = new Map(filas.map((f) => [f.aula.id, f]));
  const pendientes = inv.antenas.filter(antenaPorRenombrar);
  const visibles = soloPendientes ? pendientes : inv.antenas;
  const pisos = new Map<string, AntenaInv[]>();
  for (const a of visibles) pisos.set(a.piso ?? '', [...(pisos.get(a.piso ?? '') ?? []), a]);
  const orden = ['PB', 'P1', 'P2', 'P3', ''];

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Antenas</h1>
      <Cifras>
        <Cifra etiqueta="Antenas" valor={inv.antenas.length} />
        <Cifra etiqueta="Por renombrar" valor={pendientes.length} tono={pendientes.length ? 'aviso' : 'ok'} barra={inv.antenas.length ? 1 - pendientes.length / inv.antenas.length : 1} />
        <Cifra etiqueta="En un aula" valor={inv.antenas.filter((a) => a.aulaId).length} />
        <Cifra etiqueta="En pasillos y salas" valor={inv.antenas.filter((a) => !a.aulaId).length} />
      </Cifras>

      <div className="flex flex-wrap items-center gap-2">
        <Filtros etiqueta="Mostrar">
          <Filtro activo={!soloPendientes} onClick={() => setSoloPendientes(false)} cuenta={inv.antenas.length}>
            Todas
          </Filtro>
          <Filtro activo={soloPendientes} onClick={() => setSoloPendientes(true)} cuenta={pendientes.length} tono="aviso">
            Por renombrar
          </Filtro>
        </Filtros>
        <div className="ml-auto flex flex-wrap gap-2">
          <Link href="/gestion/inventario/imprimir?informe=antenas" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Printer aria-hidden /> Imprimir
          </Link>
          <Button variant="outline" size="sm" onClick={() => setEditando('nueva')}>
            <Plus aria-hidden /> Añadir antena
          </Button>
        </div>
      </div>

      {orden
        .filter((p) => pisos.has(p))
        .map((piso) => (
          <section key={piso || 'otras'} className="space-y-2">
            <Rotulo>{piso ? etiquetaPiso(piso) : 'Sin piso'}</Rotulo>
            <Tarjeta as="section">
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {pisos.get(piso)!.map((a) => {
                  const porRenombrar = antenaPorRenombrar(a);
                  const aula = a.aulaId ? aulas.get(a.aulaId) : null;
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 font-mono text-sm">
                          <span className={porRenombrar ? 'text-zinc-500 line-through decoration-zinc-400 dark:text-zinc-400' : 'font-semibold text-zinc-900 dark:text-zinc-100'}>
                            {a.nombreActual}
                          </span>
                          {porRenombrar && (
                            <>
                              <ArrowRight aria-label="pasa a llamarse" className="size-4 text-zinc-400" />
                              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{a.nombreNuevo}</span>
                            </>
                          )}
                        </p>
                        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                          {aula ? (
                            <Link href={`/gestion/inventario/aulas/${aula.aula.id}`} className="underline-offset-4 hover:underline">
                              {etiquetaAula(aula)}
                            </Link>
                          ) : (
                            (a.ubicacion ?? 'Sin ubicación')
                          )}
                          {a.notas ? ` · ${a.notas}` : ''}
                        </p>
                      </div>
                      {porRenombrar ? (
                        <Button
                          variant="suave"
                          size="sm"
                          cargando={clave === a.id}
                          onClick={() => correr(() => marcarAntenaRenombrada(a.id), `Ahora se llama ${a.nombreNuevo}`, a.id)}
                        >
                          <Check aria-hidden /> Ya renombrada
                        </Button>
                      ) : (
                        <Estado tono="ok">Nombre bien puesto</Estado>
                      )}
                      <Button variant="ghost" size="icon-sm" aria-label={`Editar ${a.nombreActual}`} onClick={() => { haptic.tap(); setEditando(a); }}>
                        <Pencil />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </Tarjeta>
          </section>
        ))}

      {editando && <HojaAntena antena={editando === 'nueva' ? null : editando} filas={filas} onCerrar={() => setEditando(null)} />}
    </div>
  );
}

function HojaAntena({ antena, filas, onCerrar }: { antena: AntenaInv | null; filas: readonly FilaAula[]; onCerrar: () => void }) {
  const [nombreActual, setNombreActual] = useState(antena?.nombreActual ?? '');
  const [nombreNuevo, setNombreNuevo] = useState(antena?.nombreNuevo ?? '');
  const [aulaId, setAulaId] = useState(antena?.aulaId ?? '');
  const [piso, setPiso] = useState<Piso | ''>((antena?.piso as Piso) ?? '');
  const [ubicacion, setUbicacion] = useState(antena?.ubicacion ?? '');
  const [notas, setNotas] = useState(antena?.notas ?? '');
  const { correr, ocupado } = useAccion();
  const aula = filas.find((f) => f.aula.id === aulaId);
  const propuesto = aula ? nombreAntenaDeAula(aula.aula) : null;

  async function guardar() {
    const r = await correr(
      () =>
        guardarAntena({
          id: antena?.id,
          nombreActual,
          nombreNuevo,
          aulaId: aulaId || null,
          piso: (aula?.aula.piso as Piso | null) ?? (piso || null),
          ubicacion: aulaId ? null : ubicacion,
          notas,
        }),
      'Antena guardada',
    );
    if (r !== false) onCerrar();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent variante="hoja" className="sm:max-w-lg">
        <DialogTitle>{antena ? 'Editar antena' : 'Añadir antena'}</DialogTitle>
        <DialogDescription>El nombre que sale en el controlador de la wifi y el que le toca.</DialogDescription>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre actual" id="ant-actual">
              <Input id="ant-actual" value={nombreActual} onChange={(e) => setNombreActual(e.target.value)} className="font-mono" />
            </Campo>
            <Campo etiqueta="Nombre nuevo" id="ant-nuevo" opcional ayuda={propuesto && nombreNuevo !== propuesto ? `Por su aula le tocaría ${propuesto}` : undefined}>
              <Input id="ant-nuevo" value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} className="font-mono" />
            </Campo>
          </div>
          <Campo etiqueta="En qué aula está" id="ant-aula">
            <Selector id="ant-aula" value={aulaId} onChange={(e) => setAulaId(e.target.value)}>
              <option value="">En un pasillo o una sala sin número</option>
              <OpcionesAulas filas={filas} />
            </Selector>
          </Campo>
          {!aulaId && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Piso" id="ant-piso">
                <Selector id="ant-piso" value={piso} onChange={(e) => setPiso(e.target.value as Piso | '')}>
                  <option value="">Sin apuntar</option>
                  {PISOS.map((p) => (
                    <option key={p} value={p}>
                      {PISO_LABEL[p]}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Dónde" id="ant-ubic">
                <Input id="ant-ubic" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder="Pasillo del ascensor" />
              </Campo>
            </div>
          )}
          <Campo etiqueta="Notas" id="ant-notas" opcional>
            <Textarea id="ant-notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </Campo>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button onClick={guardar} cargando={ocupado} disabled={!nombreActual.trim()}>
              <Check aria-hidden /> Guardar
            </Button>
            {antena && (
              <ConfirmarEnLinea
                etiqueta="Quitar"
                icono={<Trash2 aria-hidden />}
                pregunta="¿Quitar esta antena de la lista?"
                confirmar="Sí, quitar"
                onConfirmar={async () => {
                  const r = await correr(() => quitarAntena(antena.id), 'Antena quitada');
                  if (r !== false) onCerrar();
                }}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
