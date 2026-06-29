'use client';

import { useEffect, useState } from 'react';
import { Loader2, Send, TriangleAlert } from 'lucide-react';

type Grupo = 'faltan' | 'tienen';
const SAMPLE = { nombre: 'María', apellidos: 'García López', curso: '1ESO' };

function fillSample(t: string) {
  return t.replace(/\{nombre\}/gi, SAMPLE.nombre).replace(/\{apellidos\}/gi, SAMPLE.apellidos).replace(/\{curso\}/gi, SAMPLE.curso);
}

export function CorreosForm() {
  const [grupo, setGrupo] = useState<Grupo>('faltan');
  const [count, setCount] = useState<number | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('Hola,\n\n');
  const [testEmail, setTestEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setCount(null);
    fetch('/api/licencias/admin/correos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'count', grupo }),
    })
      .then((r) => r.json())
      .then((d) => setCount(d.count ?? 0))
      .catch(() => setCount(0));
  }, [grupo]);

  function insertVar(v: string) {
    setBody((b) => b + `{${v}}`);
  }

  async function enviarPrueba() {
    setMsg(null);
    setBusy(true);
    try {
      const r = await fetch('/api/licencias/admin/correos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'test', grupo, subject, body, testEmail }),
      });
      const d = await r.json();
      setMsg(r.ok ? (d.status === 'sent' ? `Prueba enviada a ${testEmail}` : `No se pudo enviar (${d.status})`) : d.error);
    } finally {
      setBusy(false);
    }
  }

  async function enviarReal() {
    setMsg(null);
    setBusy(true);
    setConfirming(false);
    try {
      const r = await fetch('/api/licencias/admin/correos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'send', grupo, subject, body }),
      });
      const d = await r.json();
      if (!r.ok) setMsg(d.error ?? 'Error');
      else if (d.skipped) setMsg('Resend no está configurado (no se envió nada).');
      else setMsg(`Enviados ${d.sent} · errores ${d.errors}`);
    } finally {
      setBusy(false);
    }
  }

  const Btn = ({ g, label }: { g: Grupo; label: string }) => (
    <button
      type="button"
      onClick={() => setGrupo(g)}
      className={`rounded-lg border px-3 py-1.5 text-sm cursor-pointer ${
        grupo === g ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Destinatarios</p>
        <div className="flex flex-wrap gap-2">
          <Btn g="faltan" label="Quienes faltan (sin pedido)" />
          <Btn g="tienen" label="Quienes ya tienen pedido" />
          <span className="ml-auto self-center text-sm text-zinc-400">
            {count === null ? '…' : `${count} destinatarios`}
          </span>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Asunto</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Mensaje</label>
          <div className="flex gap-1">
            {['nombre', 'apellidos', 'curso'].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertVar(v)}
                className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 cursor-pointer"
              >
                {`{${v}}`}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100"
        />
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">Vista previa</p>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{fillSample(subject) || '(sin asunto)'}</p>
          <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">{fillSample(body)}</p>
          <p className="mt-3 text-xs text-zinc-400">—<br />Colegio Consolación · Burriana</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
        <input
          type="email"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="correo para prueba"
          className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100"
        />
        <button
          type="button"
          onClick={enviarPrueba}
          disabled={busy || !testEmail}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 cursor-pointer"
        >
          Enviar prueba
        </button>
      </div>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={busy || !subject || !body || !count}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar a {count ?? 0} destinatarios
        </button>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-700/50 dark:bg-amber-500/10">
          <TriangleAlert className="h-5 w-5 shrink-0 text-amber-600" />
          <span className="flex-1 text-sm text-amber-800 dark:text-amber-200">¿Enviar de verdad a {count} correos?</span>
          <button type="button" onClick={() => setConfirming(false)} className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 cursor-pointer">
            Cancelar
          </button>
          <button type="button" onClick={enviarReal} className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 cursor-pointer">
            Sí, enviar
          </button>
        </div>
      )}

      {msg && <p className="text-sm text-zinc-600 dark:text-zinc-300">{msg}</p>}
    </div>
  );
}
