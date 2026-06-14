import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Appointment } from '@/lib/types/admin';

const STATUS_LABELS: Record<string, string> = {
  confirmed:   'Confirmada',
  show:        'Atendió',
  no_show:     'No Atendió',
  rescheduled: 'Reagendada',
  cancelled:   'Cancelada',
};

const SERVICE_LABELS: Record<string, string> = {
  medico:        'Consulta Médica',
  nutricion:     'Nutrición',
  fisioterapia:  'Fisioterapia',
  psicologia:    'Psicología',
  evaluacion:    'Evaluación',
  entrenamiento: 'Entrenamiento',
};

export async function triggerPrint(data: Appointment[], periodLabel: string) {
  const root = document.getElementById('print-root');
  if (!root) return;

  const rows = data.map(apt => `
    <tr>
      <td>${format(new Date(apt.date), 'dd/MM/yyyy', { locale: es })}</td>
      <td>${apt.time}</td>
      <td>${apt.athlete.full_name}</td>
      <td>${apt.specialist.full_name}</td>
      <td>${SERVICE_LABELS[apt.service_type] ?? apt.service_type}</td>
      <td class="badge-${apt.status}">${STATUS_LABELS[apt.status] ?? apt.status}</td>
      <td>${apt.notes ?? ''}</td>
    </tr>
  `).join('');

  root.innerHTML = `
    <div class="print-header">
      <div>
        <strong style="font-size:16px">AO Deporte — Admin Console</strong><br/>
        <span>Reporte de Citas · ${periodLabel}</span>
      </div>
      <div style="text-align:right;font-size:10px;color:#6b7280">
        Generado: ${format(new Date(), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}<br/>
        Total registros: ${data.length}
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Fecha</th><th>Hora</th><th>Atleta</th>
          <th>Especialista</th><th>Especialidad</th>
          <th>Estado</th><th>Notas</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="print-footer">
      AO Deporte · Documento generado automáticamente desde el Admin Console
    </div>
  `;

  root.style.display = 'block';
  await new Promise<void>(r => setTimeout(r, 150));
  window.print();
  root.style.display = 'none';
  root.innerHTML = '';
}
