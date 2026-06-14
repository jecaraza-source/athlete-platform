import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="text-5xl">🚫</span>
      <h1 className="text-2xl font-bold text-gray-800">Acceso no autorizado</h1>
      <p className="text-gray-500 max-w-sm">
        No tienes los permisos necesarios para acceder a esta sección.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
      >
        Volver al dashboard
      </Link>
    </main>
  );
}
