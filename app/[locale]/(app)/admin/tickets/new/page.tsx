import BackButton from '@/components/back-button';
import { requirePermission } from '@/lib/rbac/server';
import { getTranslations } from 'next-intl/server';
import NewTicketForm from './new-ticket-form';

export default async function NewTicketPage() {
  await requirePermission('create_tickets');

  const t = await getTranslations('admin.tickets');

  return (
    <main className="p-8 max-w-2xl">
      <BackButton href="/admin/tickets" label={t('backToTickets')} />

      <h1 className="text-3xl font-bold mt-4 mb-2 text-rose-700">{t('formNewTitle')}</h1>
      <p className="text-gray-500 text-sm mb-8">
        {t('formNewDesc')}
      </p>

      <NewTicketForm />
    </main>
  );
}
