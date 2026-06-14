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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const apt = payload.new as any;

          if (payload.eventType === 'INSERT') {
            const aptDateTime = new Date(`${apt.date}T${apt.time}`);
            if (apt.status === 'confirmed' && isBefore(aptDateTime, addHours(new Date(), 24))) {
              addAlert({
                id: `unconfirmed-${apt.id}-${Date.now()}`,
                type: 'unconfirmed',
                message: 'Cita sin confirmar en menos de 24h',
                appointmentId: apt.id,
                createdAt: new Date().toISOString(),
              });
            }
            if (apt.status === 'confirmed' && apt.original_appointment_id) {
              addAlert({
                id: `reschedule-${apt.id}-${Date.now()}`,
                type: 'pending_reschedule',
                message: 'Reagendamiento confirmado — pendiente de notificar al atleta',
                appointmentId: apt.id,
                createdAt: new Date().toISOString(),
              });
            }
          }

          if (payload.eventType === 'UPDATE' && apt.status === 'no_show') {
            addAlert({
              id: `noshow-${apt.id}-${Date.now()}`,
              type: 'consecutive_noshow',
              message: 'No Show registrado — revisar historial del atleta',
              appointmentId: apt.id,
              createdAt: new Date().toISOString(),
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'profiles' },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const profile = payload.new as any;
          if (profile.role === 'athlete') {
            addAlert({
              id: `athlete-${profile.id}-${Date.now()}`,
              type: 'new_athlete',
              message: `Nuevo atleta registrado: ${profile.full_name ?? profile.email ?? ''}`,
              athleteId: profile.id,
              createdAt: new Date().toISOString(),
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [addAlert]);

  return { alerts, dismissAlert };
}
