import Link from 'next/link';
import BackButton from '@/components/back-button';
import { requireAuthenticated } from '@/lib/rbac/server';

export const dynamic = 'force-dynamic';

const disciplines = [
  {
    href:        '/protocols/coach',
    label:       'Coach',
    description: 'Training methodologies, session planning, and performance protocols.',
    card:        'border-blue-200   bg-blue-50   hover:bg-blue-100',
    title:       'text-blue-800',
    text:        'text-blue-600',
  },
  {
    href:        '/protocols/physio',
    label:       'Physio',
    description: 'Injury prevention, rehabilitation, and physiotherapy guidelines.',
    card:        'border-orange-200 bg-orange-50 hover:bg-orange-100',
    title:       'text-orange-800',
    text:        'text-orange-600',
  },
  {
    href:        '/protocols/medic',
    label:       'Medic',
    description: 'Medical examination standards, health monitoring, and emergency procedures.',
    card:        'border-rose-200   bg-rose-50   hover:bg-rose-100',
    title:       'text-rose-800',
    text:        'text-rose-600',
  },
  {
    href:        '/protocols/nutrition',
    label:       'Nutrition',
    description: 'Dietary guidelines, supplementation standards, and hydration protocols.',
    card:        'border-emerald-200 bg-emerald-50 hover:bg-emerald-100',
    title:       'text-emerald-800',
    text:        'text-emerald-600',
  },
  {
    href:        '/protocols/psychology',
    label:       'Psychology',
    description: 'Mental performance frameworks, stress management, and wellbeing protocols.',
    card:        'border-purple-200 bg-purple-50 hover:bg-purple-100',
    title:       'text-purple-800',
    text:        'text-purple-600',
  },
];

export default async function ProtocolsPage() {
  await requireAuthenticated();

  return (
    <main className="p-8">
      <BackButton href="/dashboard" label="Back to Dashboard" />

      <h1 className="text-3xl font-bold mt-4 mb-2 text-violet-700">Protocols</h1>
      <p className="text-gray-500 mb-8">
        Standard operating procedures and guidelines for each discipline.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {disciplines.map((d) => (
          <Link
            key={d.href}
            href={d.href}
            className={`rounded-xl border p-6 transition-colors ${d.card}`}
          >
            <h2 className={`text-lg font-bold mb-1.5 ${d.title}`}>{d.label}</h2>
            <p className={`text-sm ${d.text}`}>{d.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
