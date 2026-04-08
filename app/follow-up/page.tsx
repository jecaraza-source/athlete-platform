import Link from 'next/link';
import BackButton from '@/components/back-button';

const categories = [
  {
    label:       'Training',
    description: 'Track workload, intensity, and session notes.',
    href:        '/follow-up/training',
    card:        'border-blue-200   bg-blue-50   hover:bg-blue-100',
    title:       'text-blue-800',
    text:        'text-blue-600',
  },
  {
    label:       'Nutrition',
    description: 'Monitor dietary plans and nutritional goals.',
    href:        '/follow-up/nutrition',
    card:        'border-emerald-200 bg-emerald-50 hover:bg-emerald-100',
    title:       'text-emerald-800',
    text:        'text-emerald-600',
  },
  {
    label:       'Physio',
    description: 'Log injuries, recovery progress, and treatments.',
    href:        '/follow-up/physio',
    card:        'border-orange-200 bg-orange-50 hover:bg-orange-100',
    title:       'text-orange-800',
    text:        'text-orange-600',
  },
  {
    label:       'Psychology',
    description: 'Record mental performance and wellbeing check-ins.',
    href:        '/follow-up/psychology',
    card:        'border-purple-200 bg-purple-50 hover:bg-purple-100',
    title:       'text-purple-800',
    text:        'text-purple-600',
  },
  {
    label:       'Medical Services',
    description: 'Track medical cases, vitals, blood pressure, and treatment adherence.',
    href:        '/follow-up/medical',
    card:        'border-rose-200   bg-rose-50   hover:bg-rose-100',
    title:       'text-rose-800',
    text:        'text-rose-600',
  },
];

export default function FollowUpPage() {
  return (
    <main className="p-8">
      <BackButton href="/dashboard" label="Back to Dashboard" />
      <h1 className="text-3xl font-bold mt-4 mb-2 text-amber-700">Follow-up</h1>
      <p className="text-gray-500 mb-8">
        Track training, nutrition, physio, psychology, and medical services across your athletes.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((cat) => (
          <Link
            key={cat.label}
            href={cat.href}
            className={`rounded-xl border p-6 transition-colors ${cat.card}`}
          >
            <h2 className={`font-bold text-lg mb-1 ${cat.title}`}>{cat.label}</h2>
            <p className={`text-sm ${cat.text}`}>{cat.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
