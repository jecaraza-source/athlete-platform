import Link from 'next/link';

const cards = [
  {
    href:        '/athletes',
    label:       'Athletes',
    description: 'Manage athlete records and profiles.',
    card:        'border-emerald-200 bg-emerald-50 hover:bg-emerald-100',
    title:       'text-emerald-800',
    text:        'text-emerald-600',
  },
  {
    href:        '/calendar',
    label:       'Calendar',
    description: 'Review and manage upcoming events.',
    card:        'border-sky-200    bg-sky-50    hover:bg-sky-100',
    title:       'text-sky-800',
    text:        'text-sky-600',
  },
  {
    href:        '/follow-up',
    label:       'Follow-up',
    description: 'Track training, nutrition, physio, psychology, and medical services.',
    card:        'border-amber-200  bg-amber-50  hover:bg-amber-100',
    title:       'text-amber-800',
    text:        'text-amber-600',
  },
  {
    href:        '/protocols',
    label:       'Protocols',
    description: 'Standard operating guidelines for each discipline.',
    card:        'border-violet-200 bg-violet-50 hover:bg-violet-100',
    title:       'text-violet-800',
    text:        'text-violet-600',
  },
];

export default function DashboardPage() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold text-indigo-700">Dashboard</h1>
      <p className="mt-2 text-gray-500 mb-8">
        Welcome to your athlete development platform.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className={`rounded-xl border p-6 transition-colors ${c.card}`}
          >
            <h2 className={`font-bold text-lg mb-1 ${c.title}`}>{c.label}</h2>
            <p className={`text-sm ${c.text}`}>{c.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
