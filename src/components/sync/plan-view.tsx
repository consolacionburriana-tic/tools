'use client';

// UI compartida del patrón "vista previa → confirmar y aplicar" que ya usaba Licencias
// (Google Sheets → catálogo/alumnado). Cualquier sync nuevo que siga el mismo contrato de
// API (GET = plan sin escribir, POST = aplica) reutiliza esto en vez de reinventar la vista.
import { useState } from 'react';
import { Clock, Eye, RefreshCw, TriangleAlert, UserMinus, UserPlus } from 'lucide-react';
import { Aviso } from '@/components/ui/aviso';
import { Button } from '@/components/ui/button';
import { Estado } from '@/components/ui/estado';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Cubo } from '@/components/sync/cubo';

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
  /** Filas del origen que comparten identidad: solo se guardará la última de cada grupo. */
  duplicados?: { key: string; curso: string; cod: string; labels: string[] }[];
}

function Changes({ changes }: { changes: FieldChange[] }) {
  return (
    <ul className="mt-1 space-y-0.5 text-sm text-zinc-600 dark:text-zinc-400">
      {changes.map((c) => (
        <li key={c.field}>
          <span className="font-medium text-zinc-800 dark:text-zinc-200">{c.field}</span>: {c.before} → {c.after}
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
  const alternar = (k: 'insert' | 'update' | 'deactivate') => setOpen(open === k ? null : k);

  if (total === 0) {
    return (
      <Aviso tono="ok" className="mt-3">
        Sin cambios: ya está todo al día.
      </Aviso>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {plan.outOfScope != null && plan.outOfScope > 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{plan.outOfScope} fila(s) ignoradas (curso fuera de esta campaña).</p>
      )}
      {warnings.length > 0 && (
        <Aviso tono="aviso">{warnings.length} elemento(s) con aviso: revísalos antes de confirmar.</Aviso>
      )}
      {plan.duplicados != null && plan.duplicados.length > 0 && (
        <Aviso
          tono="error"
          titulo={`${plan.duplicados.length} código(s) repetidos en el mismo curso: solo se guardará el último de cada uno.`}
        >
          <ul className="mt-1 space-y-0.5">
            {plan.duplicados.map((d) => (
              <li key={d.key}>
                <strong>
                  {d.curso} · {d.cod}
                </strong>
                : {d.labels.join(' / ')}
              </li>
            ))}
          </ul>
          <p className="mt-1">Ponles códigos distintos en el Excel o uno de los dos no existirá.</p>
        </Aviso>
      )}

      <Cubo
        icono={<UserPlus />}
        titulo="Altas nuevas"
        n={plan.toInsert.length}
        abierto={open === 'insert'}
        onToggle={() => alternar('insert')}
      >
        <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-zinc-700 dark:text-zinc-300">
          {plan.toInsert.map((i) => (
            <li key={i.key}>{i.label}</li>
          ))}
        </ul>
      </Cubo>

      <Cubo
        icono={<RefreshCw />}
        titulo="Actualizaciones"
        n={plan.toUpdate.length}
        abierto={open === 'update'}
        onToggle={() => alternar('update')}
      >
        <ul className="max-h-64 space-y-2.5 overflow-y-auto text-sm">
          {plan.toUpdate.map((i) => (
            <li key={i.key}>
              <p className="font-medium text-zinc-900 dark:text-zinc-100">{i.label}</p>
              <Changes changes={i.changes} />
              {i.warning && (
                <p className="mt-1 flex items-start gap-1.5 text-amber-800 dark:text-amber-300">
                  <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" /> {i.warning}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Cubo>

      <Cubo
        icono={<UserMinus />}
        titulo="Se desactivarán"
        n={plan.toDeactivate.length}
        abierto={open === 'deactivate'}
        onToggle={() => alternar('deactivate')}
      >
        <ul className="max-h-48 space-y-1.5 overflow-y-auto text-sm text-zinc-700 dark:text-zinc-300">
          {plan.toDeactivate.map((i) => (
            <li key={i.key} className="flex flex-wrap items-center gap-2">
              {i.label}
              {i.hasOrder && <Estado tono="aviso">Tiene pedido</Estado>}
            </li>
          ))}
        </ul>
      </Cubo>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{plan.unchanged} sin cambios (no se tocan).</p>
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
    <Tarjeta className="p-4">
      <h3 className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100 [&_svg]:size-4 [&_svg]:shrink-0">
        {icon} {title}
      </h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-zinc-500 dark:text-zinc-400">
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" cargando={sync.loadingPlan} onClick={() => void sync.preview()}>
          {!sync.loadingPlan && <Eye aria-hidden />}
          Ver cambios
        </Button>
        {sync.plan && (
          <Button type="button" size="sm" cargando={sync.applying} onClick={() => void sync.apply()}>
            {!sync.applying && <RefreshCw aria-hidden />}
            {applyLabel}
          </Button>
        )}
      </div>

      {sync.planError && (
        <Aviso tono="error" className="mt-3">
          {sync.planError}
        </Aviso>
      )}
      {sync.plan && <PlanView plan={sync.plan} />}

      {sync.result?.error && (
        <Aviso tono="error" className="mt-3">
          {sync.result.error}
        </Aviso>
      )}
      {sync.result?.ok && (
        <Aviso tono="ok" titulo="Aplicado" className="mt-3">
          {resultSummary(sync.result)}
          {sync.ranAt && (
            <p className="mt-1 flex items-center gap-1 text-xs tabular-nums">
              <Clock aria-hidden className="h-3.5 w-3.5" /> {sync.ranAt.toLocaleString('es-ES')}
            </p>
          )}
        </Aviso>
      )}
    </Tarjeta>
  );
}
