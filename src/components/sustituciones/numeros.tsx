'use client';

// Números (docs/32, decisiones 11, 12 y 19): cifras del mes, el trimestre o el curso; horas ausentes
// por profe (escolar / personal, nunca el motivo concreto) y quién ha cubierto más (para repartir
// mejor, no es un marcador). Abajo, el informe mensual: vista previa y «Enviarlo ahora».
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Eye, Send } from 'lucide-react';
import { toast } from 'sonner';
import { GRUPO_MOTIVO_NOMBRE, mayuscula, nombreMes, PERIODOS_CIFRAS, rangoCorto, type PeriodoCifras, type Resumen } from '@/lib/sustituciones';
import { Aviso } from '@/components/ui/aviso';
import { Button } from '@/components/ui/button';
import { Cifra, Cifras } from '@/components/ui/cifra';
import { ConfirmarEnLinea } from '@/components/ui/confirmar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Tarjeta, TarjetaCabecera, TarjetaCuerpo } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { Selector } from '@/components/ui/selector';
import { pedir } from './comun';

const NOMBRE_PERIODO: Record<PeriodoCifras, string> = { mes: 'Este mes', trimestre: 'Trimestre', curso: 'Curso' };

export interface DatosNumeros {
  periodo: PeriodoCifras;
  etapa: string;
  desde: string;
  hasta: string;
  resumen: Resumen;
  informe: { mes: string; html: string; asunto: string; destinatarios: string[]; opcionesDestinatarios: { email: string; nombre: string; rol: string }[]; enviado: { at: string; destinatarios: string[] } | null };
}

/** Por jefatura (lo de cada una) y, dentro de Infantil y Primaria, cada etapa por separado. */
const OPCIONES_ETAPA = [
  ['infantil-primaria', 'Infantil y Primaria'],
  ['EI', 'Infantil'],
  ['EP', 'Primaria'],
  ['eso', 'ESO'],
  ['todas', 'Todo'],
] as const;

export function Numeros({ datos }: { datos: DatosNumeros }) {
  const router = useRouter();
  const ruta = usePathname();
  const [vista, setVista] = useState(false);
  const [destinatario, setDestinatario] = useState(datos.informe.opcionesDestinatarios[0]?.email ?? '');
  const [etapaEnvio, setEtapaEnvio] = useState<'todas' | 'EI' | 'EP' | 'ESO'>('todas');
  const r = datos.resumen;
  const maxCubiertas = Math.max(1, ...r.porSustituto.map((s) => s.total));
  const inf = datos.informe;

  async function enviarAhora() {
    try {
      const res = await pedir<{ enviado: boolean; destinatarios: string[]; motivo?: string; fallidos: string[] }>('/api/sustituciones/admin/informe', { body: { mes: inf.mes, destinatarios: [destinatario], etapa: etapaEnvio } });
      if (res.enviado) toast.success(`Informe enviado a ${res.destinatarios.length === 1 ? '1 persona' : `${res.destinatarios.length} personas`}${res.fallidos.length ? `; falló a ${res.fallidos.join(', ')}` : ''}`);
      else toast.error(res.motivo ?? 'No ha salido');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido mandar');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Filtros etiqueta="Periodo">
          {PERIODOS_CIFRAS.map((p) => (
            <Filtro key={p} activo={datos.periodo === p} onClick={() => { const params = new URLSearchParams(); if (p !== 'mes') params.set('periodo', p); params.set('etapa', datos.etapa); const query = params.toString(); router.push(query ? `${ruta}?${query}` : ruta); }}>
              {NOMBRE_PERIODO[p]}
            </Filtro>
          ))}
        </Filtros>
        <Filtros etiqueta="Etapa">
          {OPCIONES_ETAPA.map(([e, nombre]) => {
            const params = new URLSearchParams();
            if (datos.periodo !== 'mes') params.set('periodo', datos.periodo);
            params.set('etapa', e);
            return <Filtro key={e} activo={datos.etapa === e} onClick={() => router.push(`${ruta}?${params.toString()}`)}>{nombre}</Filtro>;
          })}
        </Filtros>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">{rangoCorto(datos.desde, datos.hasta)}</span>
      </div>

      <Cifras>
        <Cifra etiqueta="Ausencias" valor={r.ausencias} />
        <Cifra etiqueta="Horas ausentes" valor={r.sesiones} />
        <Cifra etiqueta="Horas cubiertas" valor={r.cubiertas} barra={r.aCubrir ? r.cubiertas / r.aCubrir : undefined} />
        <Cifra etiqueta="Sin cubrir" valor={r.sinCubrir} tono={r.sinCubrir > 0 ? 'aviso' : undefined} />
      </Cifras>

      {r.sesiones === 0 ? (
        <Vacio titulo="No hay ausencias en este periodo" />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <Tarjeta>
            <TarjetaCabecera titulo="Horas ausentes por profe" descripcion="El motivo va agrupado: son datos de salud." />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 dark:text-zinc-400">
                    <th className="px-4 py-2 font-medium">Profe</th>
                    <th className="px-2 py-2 text-right font-medium">{GRUPO_MOTIVO_NOMBRE.escolar}</th>
                    <th className="px-2 py-2 text-right font-medium">{GRUPO_MOTIVO_NOMBRE.personal}</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {r.porAusente.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-2 text-zinc-900 dark:text-zinc-100">{a.nombre}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{a.escolar}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{a.personal}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">{a.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>
          <Tarjeta>
            <TarjetaCabecera titulo="Quién ha cubierto más" descripcion="Para repartir mejor. Las de «Solo urgencia», aparte." />
            {r.porSustituto.length === 0 ? (
              <p className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">Nadie ha cubierto todavía.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {r.porSustituto.map((s) => (
                  <li key={s.id} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-zinc-900 dark:text-zinc-100">{s.nombre}</span>
                      <span className="tabular-nums">
                        <strong>{s.total}</strong>
                        {s.urgencia > 0 && <span className="text-amber-700 dark:text-amber-400"> · {s.urgencia} de urgencia</span>}
                      </span>
                    </div>
                    <span aria-hidden className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <span className="block h-full rounded-full bg-[var(--datos-1)]" style={{ width: `${Math.round((s.total / maxCubiertas) * 100)}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>
      )}

      <Tarjeta>
        <TarjetaCabecera
          titulo={`Informe de ${nombreMes(inf.mes)}`}
          descripcion="Sale el día 1 por etapa y en un resumen conjunto para Dirección titular."
          accion={
            <Button variant="outline" size="sm" onClick={() => setVista(true)}>
              <Eye aria-hidden /> Ver el informe
            </Button>
          }
        />
        <TarjetaCuerpo className="space-y-3">
          {inf.enviado ? (
            <Aviso tono="ok">
              Enviado el {new Date(inf.enviado.at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} a {inf.enviado.destinatarios.join(', ') || 'nadie'}.
            </Aviso>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">Todavía no se ha mandado.</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">Enviar a<Selector aria-label="Destinatario del informe" value={destinatario} onChange={(e) => setDestinatario(e.target.value)}><option value="">Elige jefatura o dirección…</option>{inf.opcionesDestinatarios.map((o) => <option key={o.email} value={o.email}>{o.rol === 'jefe' ? 'Jefatura' : 'Dirección'} · {o.nombre} ({o.email})</option>)}</Selector></label>
            <label className="space-y-1 text-sm font-medium">Etapa del informe<Selector aria-label="Etapa del informe" value={etapaEnvio} onChange={(e) => setEtapaEnvio(e.target.value as typeof etapaEnvio)}><option value="todas">Todas las etapas</option><option value="EI">Infantil</option><option value="EP">Primaria</option><option value="ESO">ESO</option></Selector></label>
          </div>
          <ConfirmarEnLinea
            etiqueta={inf.enviado ? 'Volver a enviarlo' : 'Enviarlo ahora'}
            icono={<Send aria-hidden />}
            variante="outline"
            pregunta={`¿Enviar el resumen ${etapaEnvio === 'todas' ? 'de todas las etapas' : `de ${etapaEnvio}`} a ${destinatario || 'la cuenta seleccionada'}?`}
            confirmar="Enviar"
            disabled={!destinatario}
            onConfirmar={enviarAhora}
          />
        </TarjetaCuerpo>
      </Tarjeta>

      <Dialog open={vista} onOpenChange={setVista}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{mayuscula(inf.asunto)}</DialogTitle>
          </DialogHeader>
          <iframe title="Vista previa del informe" srcDoc={inf.html} sandbox="" className="h-[65vh] w-full rounded-xl border border-zinc-200 bg-white dark:border-zinc-800" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
