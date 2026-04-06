import Link from 'next/link';

export default function AdminPage() {
  return (
    <main className="p-8">
      <Link href="/dashboard" className="text-blue-600 hover:underline">
        ← Back to Dashboard
      </Link>
      <h1 className="text-3xl font-bold mt-4">Admin</h1>
      <p className="mt-2 text-gray-600 mb-8">Platform administration and configuration.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Admin Setup */}
        <Link
          href="/admin/staff"
          className="rounded-lg border border-indigo-200 bg-indigo-50 p-6 hover:bg-indigo-100 transition-colors"
        >
          <h2 className="text-lg font-semibold text-indigo-800">Admin Setup</h2>
          <p className="text-sm text-indigo-600 mt-1">
            Manage super admins, admins, and staff members.
          </p>
        </Link>

        {/* Athletes */}
        <Link
          href="/admin/athletes"
          className="rounded-lg border border-teal-200 bg-teal-50 p-6 hover:bg-teal-100 transition-colors"
        >
          <h2 className="text-lg font-semibold text-teal-800">Athletes Setup</h2>
          <p className="text-sm text-teal-600 mt-1">
            Register new athletes and manage their profiles.
          </p>
        </Link>
      </div>
    </main>
  );
}
