import Link from 'next/link';

export default function DashboardPage() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-2 text-gray-600">
        Welcome to your athlete development platform.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <Link href="/athletes" className="border rounded-lg p-5 hover:bg-gray-50 transition-colors">
          <h2 className="font-semibold">Athletes</h2>
          <p className="text-sm text-gray-600 mt-1">Manage athlete records</p>
        </Link>

        <Link href="/calendar" className="border rounded-lg p-5 hover:bg-gray-50 transition-colors">
          <h2 className="font-semibold">Calendar</h2>
          <p className="text-sm text-gray-600 mt-1">Review upcoming events</p>
        </Link>

        <Link href="/follow-up" className="border rounded-lg p-5 hover:bg-gray-50 transition-colors">
          <h2 className="font-semibold">Follow-up</h2>
          <p className="text-sm text-gray-600 mt-1">
            Track training, nutrition, physio and psychology
          </p>
        </Link>
      </div>
    </main>
  );
}
