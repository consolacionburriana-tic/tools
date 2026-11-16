'use client';

// La ficha de un aula: todo lo que hay dentro, editable en el sitio. Arriba, qué clase la ocupa
// este curso (y las de cursos anteriores); luego audiovisual, mesas y sillas, arreglos, antena y
// el material de robótica que está aquí.
import { useState } from 'react';
import Link from 'next/link';
import { Armchair, Bot, CalendarDays, DoorOpen, Pencil, Printer, Projector, Wifi, Wrench } from 'lucide-react';
import {
  cartelClase,
  antenaPorRenombrar,
  claveHorario,
  codigoAulaPropia,
  etiquetaPiso,
  nombreAntenaDeAula,
  ESTADO_KIT_LABEL,
  ESTADO_KIT_TONO,
  TIPO_ESPACIO_LABEL,
  type EstadoKit,
  type TipoEspacio,
} from '@/lib/inventario';
import type { Inventario } from '@/lib/inventario-server';
import { buttonVariants } from '@/components/ui/button';
import { EnlaceVolver, TituloPagina } from '@/components/ui/cabecera-modulo';
import { Tarjeta, TarjetaCabecera, TarjetaCuerpo } from '@/components/ui/tarjeta';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cuando, useIndice } from './comun';
import { FormAula, FormAv, FormMobiliario } from './formularios';
import { ListaArreglos } from './arreglos';

export function FichaAula({ inv, aulaId }: { inv: Inventario; aulaId: string }) {
  const filas = useIndice(inv);
  const f = filas.find((x) => x.aula.id === aulaId)!;
  const [editarAula, setEditarAula] = useState(false);
  const historia = inv.ocupacion.filter((o) => o.aulaId === aulaId).sort((a, b) => b.academicYear.localeCompare(a.academicYear));
  const modelos = new Map(inv.modelos.map((m) => [m.id, m]));
  const esClase = f.aula.tipo === 'clase';
  // Su horario: el de la clase que la ocupa y, si Horarios la tiene como aula propia del grupo
  // (`A-1ESOA`) o como sala (`INFO`), quién más la usa.
  const espacioHorario = inv.espaciosHorario.find((e) =>
    esClase && f.ocupacion?.curso
      ? e.codigo === codigoAulaPropia(f.ocupacion.curso, f.ocupacion.letra)
      : f.aula.espacioCodigo && e.codigo === f.aula.espacioCodigo.toUpperCase(),
  );
  const arreglosKits = inv.arreglos.filter((a) => a.kitId && f.kits.some((k) => k.id === a.kitId) && !a.hechoAt);

  return (
    <div className="space-y-5">
      <div>
        <EnlaceVolver href="/gestion/inventario">Todas las aulas</EnlaceVolver>
        <TituloPagina
          antes={`${etiquetaPiso(f.aula.piso)} · ${TIPO_ESPACIO_LABEL[f.aula.tipo as TipoEspacio] ?? f.aula.tipo}`}
          descripcion={
            !esClase
              ? (f.aula.notas ?? undefined)
              : f.cartel
                ? [`${f.cartel} este curso`, f.tutores.join(' y '), f.alumnos !== null ? `${f.alumnos} alumnos` : null].filter(Boolean).join(' · ')
                : 'Sin clase este curso'
          }
          acciones={
            <>
              <Button variant="outline" size="sm" onClick={() => setEditarAula(true)}>
                <Pencil aria-hidden /> Datos
              </Button>
              <Link href={`/gestion/inventario/imprimir?informe=aula&id=${f.aula.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                <Printer aria-hidden /> Imprimir ficha
              </Link>
            </>
          }
        >
          {f.nombre}
        </TituloPagina>
        {esClase && f.aula.notas && <p className="-mt-3 text-sm whitespace-pre-line text-zinc-600 dark:text-zinc-400">{f.aula.notas}</p>}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Tarjeta>
            <TarjetaCabecera
              icono={<Projector />}
              titulo="Audiovisual"
              descripcion={f.av ? `Revisado el ${cuando(f.av.updatedAt, f.av.actualizadoPor)}` : 'Sin apuntar todavía'}
            />
            <TarjetaCuerpo>
              <FormAv key={f.av?.updatedAt ?? 'nuevo'} aulaId={aulaId} av={f.av} />
            </TarjetaCuerpo>
          </Tarjeta>
          <Tarjeta>
            <TarjetaCabecera
              icono={<Armchair />}
              titulo="Mesas y sillas"
              descripcion={f.mob ? `Contadas el ${cuando(f.mob.updatedAt, f.mob.actualizadoPor)}` : 'Sin contar todavía'}
            />
            <TarjetaCuerpo>
              <FormMobiliario key={f.mob?.updatedAt ?? 'nuevo'} aulaId={aulaId} mob={f.mob} alumnos={f.alumnos} curso={f.ocupacion?.curso ?? null} />
            </TarjetaCuerpo>
          </Tarjeta>
        </div>

        <div className="space-y-5">
          <Tarjeta>
            <TarjetaCabecera
              icono={<Wrench />}
              titulo="Arreglos"
              descripcion={f.pendientes.length ? `${f.pendientes.length} pendientes` : 'Nada pendiente'}
            />
            <TarjetaCuerpo className="pt-1">
              <ListaArreglos arreglos={f.arreglos} aulaId={aulaId} areaPorDefecto="av" filas={filas} />
            </TarjetaCuerpo>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera
              icono={<Wifi />}
              titulo="Antena wifi"
              accion={
                <Link href="/gestion/inventario/antenas" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                  Antenas
                </Link>
              }
            />
            <TarjetaCuerpo>
              {f.antenas.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No hay ninguna antena en esta aula
                  {nombreAntenaDeAula(f.aula) ? ` (si la hubiera, se llamaría ${nombreAntenaDeAula(f.aula)})` : ''}.
                </p>
              ) : (
                <ul className="space-y-2">
                  {f.antenas.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <Etiqueta className="font-mono">{a.nombreActual}</Etiqueta>
                      {antenaPorRenombrar(a) ? (
                        <Estado tono="aviso">Renombrar a {a.nombreNuevo}</Estado>
                      ) : (
                        <Estado tono="ok">Nombre bien puesto</Estado>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </TarjetaCuerpo>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera
              icono={<Bot />}
              titulo="Robótica en esta aula"
              descripcion={
                f.kits.length
                  ? `${f.kits.length} kits${arreglosKits.length ? ` · ${arreglosKits.length} con algo que arreglar` : ''}`
                  : 'Ningún kit guardado aquí'
              }
              accion={
                <Link href="/gestion/inventario/robotica" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                  Robótica
                </Link>
              }
            />
            {f.kits.length > 0 && (
              <TarjetaCuerpo>
                <ul className="flex flex-wrap gap-1.5">
                  {f.kits.map((k) => (
                    <li key={k.id}>
                      <Link
                        href={`/gestion/inventario/robotica?kit=${k.id}`}
                        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-zinc-200 px-3 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        title={modelos.get(k.modeloId)?.nombre}
                      >
                        <span className="font-mono font-semibold">{k.codigo}</span>
                        {k.estado !== 'ok' && (
                          <Estado tono={ESTADO_KIT_TONO[k.estado as EstadoKit]}>{ESTADO_KIT_LABEL[k.estado as EstadoKit]}</Estado>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </TarjetaCuerpo>
            )}
          </Tarjeta>

          {(espacioHorario || (esClase && f.ocupacion?.curso)) && (
            <Tarjeta>
              <TarjetaCabecera icono={<CalendarDays />} titulo="Horario" descripcion="Lo que pasa en esta aula, en Horarios" />
              <TarjetaCuerpo className="flex flex-wrap gap-2">
                {esClase && f.ocupacion?.curso && (
                  <Link
                    href={`/gestion/horarios?vista=clase&clave=${encodeURIComponent(claveHorario(f.ocupacion.curso, f.ocupacion.letra))}`}
                    className={buttonVariants({ variant: 'suave', size: 'sm' })}
                  >
                    Horario de {f.cartel}
                  </Link>
                )}
                {espacioHorario && (
                  <Link
                    href={`/gestion/horarios?vista=aula&clave=${espacioHorario.id}`}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    Quién usa {esClase ? 'el aula' : espacioHorario.nombre}
                  </Link>
                )}
              </TarjetaCuerpo>
            </Tarjeta>
          )}

          {esClase && (
            <Tarjeta>
              <TarjetaCabecera
                icono={<DoorOpen />}
                titulo="Clases que ha tenido"
                accion={
                  <Link href="/gestion/inventario/clases" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                    Cambiar
                  </Link>
                }
              />
              <TarjetaCuerpo>
                {historia.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin clases apuntadas.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {historia.map((o) => (
                      <li key={o.academicYear} className="flex justify-between gap-3">
                        <span className="text-zinc-500 tabular-nums dark:text-zinc-400">{o.academicYear}</span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{o.curso ? cartelClase(o.curso, o.letra) : o.etiqueta}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </TarjetaCuerpo>
            </Tarjeta>
          )}
        </div>
      </div>

      {editarAula && (
        <Dialog open onOpenChange={(o) => !o && setEditarAula(false)}>
          <DialogContent variante="hoja" className="sm:max-w-lg">
            <DialogTitle>Datos del espacio</DialogTitle>
            <DialogDescription>El número de la puerta no cambia con el curso; la clase, sí (eso va en «Clases de cada aula»).</DialogDescription>
            <FormAula aula={f.aula} espacios={inv.espaciosHorario} onHecho={() => setEditarAula(false)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
