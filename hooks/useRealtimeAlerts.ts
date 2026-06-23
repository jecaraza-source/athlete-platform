'use client';
import { useEffect, useState, useCallback } from 'react';
import { addHours, isBefore } from 'date-fns';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import type { RealtimeAlert } from '@/lib/types/admin';

export function useRealtimeAlerts() {
  const [alerts, setAlerts] = useState<RealtimeAlert[]>([]);

  const addAlert = useCallback((alert: RealtimeAlert) => {
    setAlerts(prev => [alert, ...prev].slice(0, 20));
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel('admin-console-alerts')
      // Listen to changes in events (appointments in the platform)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ev = payload.new as any;

          if (payload.eventType === 'INSERT') {
            // New event scheduled within the next 24 hours
            const evDateTime = ev.start_at ? new Date(ev.start_at) : null;
            if (ev.status === 'scheduled' && evDateTime && isBefore(evDateTime, addHours(new Date(), 24))) {
              addAlert({
                id: `unconfirmed-${ev.id}-${Date.now()}`,
                type: 'unconfirmed',
                message: 'Nueva cita programada en menos de 24h',
                appointmentId: ev.id,
                createdAt: new Date().toISOString(),
              });
            }
          }

          if (payload.eventType === 'UPDATE' && ev.status === 'no_show') {
            addAlert({
              id: `noshow-${ev.id}-${Date.now()}`,
              type: 'consecutive_noshow',
              message: 'No Show registrado — revisar historial del atleta',
              appointmentId: ev.id,
              createdAt: new Date().toISOString(),
            });
          }

          if (payload.eventType === 'UPDATE' && ev.status === 'rescheduled') {
            addAlert({
              id: `reschedule-${ev.id}-${Date.now()}`,
              type: 'pending_reschedule',
              message: 'Cita reagendada — pendiente de notificar al atleta',
              appointmentId: ev.id,
              createdAt: new Date().toISOString(),
            });
          }
        }
      )
      // Listen to new athlete registrations
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'athletes' },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const athlete = payload.new as any;
          addAlert({
            id: `athlete-${athlete.id}-${Date.now()}`,
            type: 'new_athlete',
            message: `Nuevo atleta registrado: ${[athlete.first_name, athlete.last_name].filter(Boolean).join(' ') || athlete.email || ''}`,
            athleteId: athlete.id,
            createdAt: new Date().toISOString(),
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [addAlert]);

  return { alerts, dismissAlert };
}
