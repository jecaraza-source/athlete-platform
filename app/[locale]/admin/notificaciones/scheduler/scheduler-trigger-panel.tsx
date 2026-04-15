'use client';

import { useState } from 'react';

type JobKey = 'email' | 'push' | 'ticket';
type TriggerResult = Record<string, unknown> | null;

const JOB_CONFIG: Array<{ key: JobKey; label: string; color: string; desc: string }> = [
  {
    key:   'email',
    label: 'Email',
    color: 'bg-rose-600 hover:bg-rose-700',
    desc:  'Despacha campañas → crea jobs → envía via Resend',
  },
  {
    key:   'push',
    label: 'Push',
    color: 'bg-violet-600 hover:bg-violet-700',
    desc:  'Despacha campañas → crea jobs → envía via OneSignal',
  },
  {
    key:   'ticket',
    label: 'Tickets',
    color: 'bg-amber-600 hover:bg-amber-700',
    desc:  'Evalúa reglas SLA, vencidos y pendientes',
  },
];

export default function SchedulerTriggerPanel() {
  const [running, setRunning]   = useState<JobKey | null>(null);
  const [result, setResult]     = useState<TriggerResult>(null);
  const [lastJob, setLastJob]   = useState<JobKey | null>(null);
  const [error, setError]       = useState<string | null>(null);

  async function trigger(job: JobKey) {
    setRunning(job);
    setResult(null);
    setError(null);
    setLastJob(job);

    try {
      const res = await fetch('/api/admin/run-cron', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ job }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(null);
    }
  }

  return (
    <section>
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Ejecutar manualmente
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        Útil en desarrollo. En producción los jobs corren automáticamente vía Vercel Cron.
      </p>

      <div className="space-y-2">
        {JOB_CONFIG.map((j) => (
          <button
            key={j.key}
            onClick={() => trigger(j.key)}
            disabled={running !== null}
            className={`w-full rounded-md px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50 ${j.color}`}
          >
            {running === j.key ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Ejecutando…
              </span>
            ) : (
              <span className="flex items-center justify-between">
                <span>▶ Ejecutar {j.label}</span>
                <span className="opacity-70 text-xs font-normal">{j.desc}</span>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Result */}
      {error && (
        <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3 text-xs text-red-700">
          <p className="font-semibold mb-1">Error en job {lastJob}:</p>
          <p>{error}</p>
        </div>
      )}

      {result && !error && (
        <div className="mt-4 rounded-md bg-green-50 border border-green-200 p-3">
          <p className="text-xs font-semibold text-green-700 mb-2">
            ✓ Job "{lastJob}" completado
          </p>
          <pre className="text-[10px] text-green-800 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}
