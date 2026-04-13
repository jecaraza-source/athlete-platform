import BackButton from '@/components/back-button';
import { requirePermission } from '@/lib/rbac/server';
import NewTicketForm from './new-ticket-form';

export default async function NewTicketPage() {
  await requirePermission('create_tickets');

  return (
    <main className="p-8 max-w-2xl">
      <BackButton href="/admin/tickets" label="Back to Tickets" />

      <h1 className="text-3xl font-bold mt-4 mb-2 text-rose-700">New Ticket</h1>
      <p className="text-gray-500 text-sm mb-8">
        Describe the issue clearly so it can be triaged and assigned quickly.
      </p>

      <NewTicketForm />
    </main>
  );
}
