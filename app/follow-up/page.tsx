import Link from 'next/link';
import BackButton from '@/components/back-button';

const categories = [
  {
    label: 'Training',
    description: 'Track workload, intensity, and session notes.',
    href: '/follow-up/training',
  },
  {
    label: 'Nutrition',
    description: 'Monitor dietary plans and nutritional goals.',
    href: '/follow-up/nutrition',
  },
  {
    label: 'Physio',
    description: 'Log injuries, recovery progress, and treatments.',
    href: '/follow-up/physio',
  },
  {
    label: 'Psychology',
    description: 'Record mental performance and wellbeing check-ins.',
    href: '/follow-up/psychology',
  },
  {
    label: 'Medical Services',
    description: 'Track medical cases, vitals, blood pressure, and treatment adherence.',
    href: '/follow-up/medical',
  },
];

export default function FollowUpPage() {
  return (
    <main className="p-8">
      <BackButton href="/dashboard" label="Back to Dashboard" />
      <h1 className="text-3xl font-bold mt-4 mb-2">Follow-up</h1>
      <p className="text-gray-600 mb-8">
        Track training, nutrition, physio, psychology, and medical services across your athletes.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((cat) =>
          cat.href ? (
            <Link
              key={cat.label}
              href={cat.href}
              className="rounded-lg border border-gray-200 p-5 hover:bg-gray-50 transition-colors"
            >
              <h2 className="font-semibold text-lg">{cat.label}</h2>
              <p className="text-sm text-gray-600 mt-1">{cat.description}</p>
            </Link>
          ) : (
            <div
              key={cat.label}
              className="rounded-lg border border-gray-200 p-5"
            >
              <h2 className="font-semibold text-lg">{cat.label}</h2>
              <p className="text-sm text-gray-600 mt-1">{cat.description}</p>
            </div>
          )
        )}
      </div>
    </main>
  );
}
