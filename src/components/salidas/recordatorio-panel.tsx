'use client';

import { useEffect, useState } from 'react';
import { Loader2, Mail, Send, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';

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
    setConfirming(false);
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

  const inputCls =
    'w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100';

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          Recordar el pago a las familias pendientes
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            {count ?? '…'}
          </span>
        </span>
        <span className="text-xs text-zinc-400">{abierto ? 'cerrar' : 'abrir'}</span>
      </button>

      {abierto && (
        <div className="space-y-3 border-t border-zinc-100 p-4 dark:border-zinc-800">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Asunto</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-500">Mensaje</label>
              <span className="flex gap-1">
                {['alumno', 'salida', 'fecha', 'importe'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setBody((b) => b + `{${v}}`)}
                    className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                  >
                    {`{${v}}`}
                  </button>
                ))}
              </span>
            </div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} className={inputCls} />
            <p className="mt-1 text-xs text-zinc-400">
              Cada familia recibe SOLO el de su hijo/a ({nombre}
              {fecha ? ` · ${new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''}
              {importe ? ` · ${importe} €` : ''}). No se escribe a quien no va.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="correo para prueba"
              className="min-w-40 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={() => void enviar('test')}
              disabled={busy || !testEmail}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
            >
              Probar
            </button>
          </div>
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={busy || !subject.trim() || !body.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar a {count} familias
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-2.5 dark:border-amber-700/50 dark:bg-amber-500/10">
              <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" />
              <span className="flex-1 text-sm text-amber-800 dark:text-amber-200">¿Enviar de verdad a {count} familias?</span>
              <button type="button" onClick={() => setConfirming(false)} className="px-2 text-sm text-zinc-500">
                No
              </button>
              <button
                type="button"
                onClick={() => void enviar('send')}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Sí, enviar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
