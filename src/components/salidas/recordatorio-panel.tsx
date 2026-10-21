'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Mail, Send } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { ConfirmarDialogo } from '@/components/ui/confirmar';
import { Estado } from '@/components/ui/estado';
import { Input } from '@/components/ui/input';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  tripId: string;
  nombre: string;
  fecha: string | null;
  importe: string | null;
  tipoPago: string;
}

// Recordatorio de pago manual a las familias pendientes (excluye a los que no van).
export function RecordatorioPanel({ tripId, nombre, fecha, importe, tipoPago }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [subject, setSubject] = useState(`Pago pendiente · ${nombre}`);
  const [body, setBody] = useState(
    tipoPago === 'mano'
      ? `Hola,\n\nOs recordamos que queda pendiente el pago de {importe} de "{salida}" ({fecha}) de {alumno}. Se entrega en mano al profesorado responsable.\n\nSi ya lo habéis entregado estos días, ignorad este correo.\n\nGracias,\nColegio Consolación · Burriana`
      : `Hola,\n\nOs recordamos que queda pendiente el justificante de pago de "{salida}" ({fecha}, {importe}) de {alumno}.\n\nPodéis subirlo en un minuto desde vuestro enlace personal:\n{enlace}\n\nSi ya lo habéis enviado estos días, ignorad este correo.\n\nGracias,\nColegio Consolación · Burriana`,
  );
  const [testEmail, setTestEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    fetch('/api/salidas/admin/recordatorio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId, accion: 'count' }),
    })
      .then((r) => r.json())
      .then((d) => setCount(d.count ?? 0))
      .catch(() => setCount(0));
  }, [tripId]);

  async function enviar(accion: 'test' | 'send') {
    setBusy(true);
    try {
      const res = await fetch('/api/salidas/admin/recordatorio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, accion, subject, body, testEmail: accion === 'test' ? testEmail : undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success(accion === 'test' ? `Prueba enviada a ${testEmail}` : `Enviados ${d.enviados} recordatorios (${d.errores} errores)`);
      haptic.success();
      if (accion === 'send') setAbierto(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo enviar');
      haptic.warning();
    } finally {
      setBusy(false);
    }
  }

  if (count === 0) return null;

  return (
    <Tarjeta>
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          <Mail aria-hidden className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          Recordar el pago a las familias pendientes
          <Estado tono="aviso">{count === null ? '…' : `${count} pendientes`}</Estado>
        </span>
        <ChevronDown
          aria-hidden
          className={cn('h-4 w-4 shrink-0 text-zinc-500 transition-transform dark:text-zinc-400', abierto && 'rotate-180')}
        />
      </button>

      {abierto && (
        <div className="space-y-4 border-t border-zinc-100 p-4 dark:border-zinc-800">
          <Campo etiqueta="Asunto" id="recordatorio-asunto">
            <Input id="recordatorio-asunto" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Campo>
          <Campo
            etiqueta="Mensaje"
            id="recordatorio-mensaje"
            ayuda={
              <>
                Cada familia recibe solo el de su hijo/a ({nombre}
                {fecha ? ` · ${new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''}
                {importe ? ` · ${importe} €` : ''}). No se escribe a quien no va.
              </>
            }
          >
            <div className="flex flex-wrap items-center gap-1.5 pb-1">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Añadir:</span>
              {['alumno', 'salida', 'fecha', 'importe'].map((v) => (
                <Button
                  key={v}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="font-mono text-xs"
                  onClick={() => setBody((b) => b + `{${v}}`)}
                >
                  {`{${v}}`}
                </Button>
              ))}
            </div>
            <Textarea id="recordatorio-mensaje" value={body} onChange={(e) => setBody(e.target.value)} rows={7} />
          </Campo>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="email"
              aria-label="Correo para la prueba"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="correo para la prueba"
              className="min-w-40 flex-1"
            />
            <Button type="button" variant="outline" onClick={() => void enviar('test')} disabled={busy || !testEmail}>
              Enviar prueba
            </Button>
          </div>
          <Button
            type="button"
            className="w-full"
            cargando={busy}
            onClick={() => setConfirming(true)}
            disabled={!subject.trim() || !body.trim()}
          >
            {!busy && <Send aria-hidden />}
            Enviar a {count} familias
          </Button>
          <ConfirmarDialogo
            abierto={confirming}
            onCerrar={() => setConfirming(false)}
            onConfirmar={() => enviar('send')}
            peligro={false}
            titulo={`¿Enviar el recordatorio a ${count} familias?`}
            descripcion="Les llega ahora mismo por correo y no se puede deshacer."
            boton={`Enviar a ${count} familias`}
          />
        </div>
      )}
    </Tarjeta>
  );
}
