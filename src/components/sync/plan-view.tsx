'use client';

// UI compartida del patrón "vista previa → confirmar y aplicar" que ya usaba Licencias
// (Google Sheets → catálogo/alumnado). Cualquier sync nuevo que siga el mismo contrato de
// API (GET = plan sin escribir, POST = aplica) reutiliza esto en vez de reinventar la vista.
import { useState } from 'react';
import { Check, ChevronDown, Clock, Eye, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';

export interface FieldChange {
  field: string;
  before: string;
  after: string;
}
export interface PlanItem {
  key: string;
  label: string;
  changes: FieldChange[];
  warning?: string;
}
export interface DeactivateItem {
  key: string;
  label: string;
  hasOrder?: boolean;
}
export interface Plan {
  toInsert: PlanItem[];
  toUpdate: PlanItem[];
  toDeactivate: DeactivateItem[];
  unchanged: number;
  outOfScope?: number;
}

function Changes({ changes }: { changes: FieldChange[] }) {
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-zinc-500">
      {changes.map((c) => (
        <li key={c.field}>
          <strong>{c.field}</strong>: {c.before} → {c.after}
        </li>
      ))}
    </ul>
  );
}

export function PlanView({ plan }: { plan: Plan }) {
  const [open, setOpen] = useState<'insert' | 'update' | 'deactivate' | null>(
    plan.toInsert.length > 0 ? 'insert' : plan.toUpdate.length > 0 ? 'update' : null,
  );
  const total = plan.toInsert.length + plan.toUpdate.length + plan.toDeactivate.length;
  const warnings = plan.toUpdate.filter((i) => i.warning);

  if (total === 0) {
    return <p className="mt-3 text-sm text-zinc-500">Sin cambios: ya está todo al día. ✅</p>;
  }

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800/40">
      {plan.outOfScope != null && plan.outOfScope > 0 && (
        <p className="text-xs text-zinc-400">{plan.outOfScope} fila(s) ignoradas (curso fuera de esta campaña).</p>
      )}
      {warnings.length > 0 && (
        <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {warnings.length} elemento(s) con aviso — revisa antes de confirmar.
        </p>
      )}

      <button type="button" onClick={() => setOpen(open === 'insert' ? null : 'insert')} className="flex w-full items-center justify-between text-left font-medium text-zinc-700 disabled:opacity-30 dark:text-zinc-200" disabled={plan.toInsert.length === 0}>
        <span>Altas nuevas ({plan.toInsert.length})</span>
        {plan.toInsert.length > 0 && <ChevronDown className={`h-4 w-4 transition-transform ${open === 'insert' ? 'rotate-180' : ''}`} />}
      </button>
      {open === 'insert' && (
        <ul className="max-h-40 space-y-1 overflow-y-auto pl-2 text-xs text-zinc-600 dark:text-zinc-300">
          {plan.toInsert.map((i) => <li key={i.key}>{i.label}</li>)}
        </ul>
      )}

      <button type="button" onClick={() => setOpen(open === 'update' ? null : 'update')} className="flex w-full items-center justify-between text-left font-medium text-zinc-700 disabled:opacity-30 dark:text-zinc-200" disabled={plan.toUpdate.length === 0}>
        <span>Actualizaciones ({plan.toUpdate.length})</span>
        {plan.toUpdate.length > 0 && <ChevronDown className={`h-4 w-4 transition-transform ${open === 'update' ? 'rotate-180' : ''}`} />}
      </button>
      {open === 'update' && (
        <ul className="max-h-56 space-y-2 overflow-y-auto pl-2 text-xs text-zinc-600 dark:text-zinc-300">
          {plan.toUpdate.map((i) => (
            <li key={i.key}>
              <p className="font-medium text-zinc-700 dark:text-zinc-200">{i.label}</p>
              <Changes changes={i.changes} />
              {i.warning && (
                <p className="mt-1 flex items-start gap-1 text-amber-700 dark:text-amber-300">
                  <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" /> {i.warning}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={() => setOpen(open === 'deactivate' ? null : 'deactivate')} className="flex w-full items-center justify-between text-left font-medium text-zinc-700 disabled:opacity-30 dark:text-zinc-200" disabled={plan.toDeactivate.length === 0}>
        <span>Se desactivarán ({plan.toDeactivate.length})</span>
        {plan.toDeactivate.length > 0 && <ChevronDown className={`h-4 w-4 transition-transform ${open === 'deactivate' ? 'rotate-180' : ''}`} />}
      </button>
      {open === 'deactivate' && (
        <ul className="max-h-40 space-y-1 overflow-y-auto pl-2 text-xs text-zinc-600 dark:text-zinc-300">
          {plan.toDeactivate.map((i) => (
            <li key={i.key}>
              {i.label}{i.hasOrder && <span className="ml-1 text-amber-600 dark:text-amber-400">(tiene pedido)</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-zinc-400">{plan.unchanged} sin cambios (no se tocan).</p>
    </div>
  );
}

export interface ApplyResult {
  ok?: boolean;
  upserted?: number;
  deactivated?: number;
  outOfScope?: number;
  error?: string;
}

export function usePreviewApply<TResult extends { ok?: boolean; error?: string } = ApplyResult>(baseUrl: string) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<TResult | null>(null);
  const [ranAt, setRanAt] = useState<Date | null>(null);

  async function preview() {
    setLoadingPlan(true);
    setPlanError(null);
    setResult(null);
    try {
      const res = await fetch(baseUrl);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido');
      setPlan(data.plan);
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : 'Error de conexión');
    } finally {
      setLoadingPlan(false);
    }
  }

  async function apply() {
    setApplying(true);
    try {
      const res = await fetch(baseUrl, { method: 'POST' });
      const data = await res.json();
      setResult(res.ok ? data : ({ error: data.error ?? 'Error desconocido' } as TResult));
      setRanAt(new Date());
      setPlan(null);
    } catch {
      setResult({ error: 'Error de conexión' } as TResult);
    } finally {
      setApplying(false);
    }
  }

  return { plan, loadingPlan, planError, applying, result, ranAt, preview, apply };
}

export interface SyncCardProps {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  bullets: string[];
  applyLabel: string;
  resultSummary: (r: ApplyResult) => React.ReactNode;
  sync: ReturnType<typeof usePreviewApply<ApplyResult>>;
}

export function SyncCard({ icon, title, description, bullets, applyLabel, resultSummary, sync }: SyncCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-100">{icon} {title}</p>
      <p className="mt-1 text-sm text-zinc-500">{description}</p>
      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-zinc-500">
        {bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={sync.preview}
          disabled={sync.loadingPlan}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
        >
          {sync.loadingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
          Ver cambios
        </button>
        {sync.plan && (
          <button
            type="button"
            onClick={sync.apply}
            disabled={sync.applying}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
          >
            {sync.applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {applyLabel}
          </button>
        )}
      </div>

      {sync.planError && (
        <p className="mt-3 flex items-start gap-1.5 text-sm text-red-600 dark:text-red-400">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {sync.planError}
        </p>
      )}
      {sync.plan && <PlanView plan={sync.plan} />}

      {sync.result?.error && (
        <p className="mt-3 flex items-start gap-1.5 text-sm text-red-600 dark:text-red-400">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {sync.result.error}
        </p>
      )}
      {sync.result?.ok && (
        <div className="mt-3 space-y-1 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
          <p className="flex items-center gap-1.5 font-medium"><Check className="h-4 w-4" /> Aplicado</p>
          {resultSummary(sync.result)}
          {sync.ranAt && (
            <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <Clock className="h-3 w-3" /> {sync.ranAt.toLocaleString('es-ES')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
