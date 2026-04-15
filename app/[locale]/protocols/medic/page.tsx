import BackButton from '@/components/back-button';
import { requireAuthenticated } from '@/lib/rbac/server';

export const dynamic = 'force-dynamic';

export default async function MedicProtocolsPage() {
  await requireAuthenticated();

  return (
    <main className="p-8 max-w-3xl">
      <BackButton href="/protocols" label="Back to Protocols" />

      <h1 className="text-3xl font-bold mt-4 mb-2 text-rose-700">Medic Protocols</h1>
      <p className="text-gray-500 mb-8">
        Standard guidelines and procedures for the Medic discipline.
      </p>

      <div className="rounded-xl border border-gray-200 p-8 text-center text-gray-400">
        <p className="text-sm font-medium">Content coming soon.</p>
        <p className="text-xs mt-1">Protocols for this discipline are being prepared.</p>
      </div>
    </main>
  );
}
