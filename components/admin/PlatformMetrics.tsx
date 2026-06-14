'use client';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

interface Metric {
  label: string;
  value: string;
  sub?: string;
  status?: 'ok' | 'warn' | 'error';
}

const STATUS_DOT = {
  ok:    'bg-emerald-500',
  warn:  'bg-amber-500',
  error: 'bg-red-500',
};

export function PlatformMetrics() {
  const [metrics, setMetrics] = useState<Metric[]>([]);

  useEffect(() => {
    const load = async () => {
      const supabase = createSupabaseBrowserClient();
      const [{ count: profiles }, { count: appointments }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('appointments').select('*', { count: 'exact', head: true }),
      ]);

      setMetrics([
        { label: 'Total perfiles',   value: profiles?.toString() ?? '—',    sub: 'en tabla profiles',      status: 'ok' },
        { label: 'Total citas',      value: appointments?.toString() ?? '—', sub: 'en tabla appointments',  status: 'ok' },
        { label: 'Última actualiz.', value: new Date().toLocaleTimeString('es-MX'), sub: 'en este cargado', status: 'ok' },
        { label: 'Entorno',          value: process.env.NEXT_PUBLIC_ENV ?? 'production', sub: 'Vercel',     status: 'ok' },
      ]);
    };
    load();
  }, []);

  return (
    <div className="bg-[#1A1D27] rounded-xl border border-[#2A2D3A] p-5">
      <h3 className="text-[#F1F5F9] font-semibold text-sm mb-4">Métricas de plataforma</h3>
      <div className="grid grid-cols-2 gap-3">
        {metrics.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-[#0F1117] rounded-lg p-3 border border-[#2A2D3A] h-16 animate-pulse" />
            ))
          : metrics.map(m => (
            <div key={m.label} className="bg-[#0F1117] rounded-lg p-3 border border-[#2A2D3A]">
              <div className="flex items-center gap-1.5 mb-1">
                {m.status && (
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[m.status]}`} />
                )}
                <span className="text-[10px] text-[#6B7280] uppercase tracking-wide">{m.label}</span>
              </div>
              <div className="text-lg font-bold text-[#F1F5F9]">{m.value}</div>
              {m.sub && <div className="text-[10px] text-[#6B7280] mt-0.5">{m.sub}</div>}
            </div>
          ))
        }
      </div>
    </div>
  );
}
