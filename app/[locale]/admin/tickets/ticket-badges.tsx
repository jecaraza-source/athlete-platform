import type { TicketPriority, TicketStatus } from '@/lib/tickets/types';

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<TicketStatus, string> = {
  open:        'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  resolved:    'bg-green-100 text-green-800',
  closed:      'bg-gray-100 text-gray-600',
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  open:        'Open',
  in_progress: 'In Progress',
  resolved:    'Resolved',
  closed:      'Closed',
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// PriorityBadge
// ---------------------------------------------------------------------------

const PRIORITY_STYLES: Record<TicketPriority, string> = {
  low:    'bg-gray-100 text-gray-600',
  medium: 'bg-sky-100 text-sky-700',
  high:   'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const label = priority.charAt(0).toUpperCase() + priority.slice(1);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_STYLES[priority]}`}
    >
      {label}
    </span>
  );
}
