import Link                    from 'next/link';
import { requireMagazineAccess } from '@/lib/rbac/server';
import { ActivityAdminForm }   from '@/components/bitacora/ActivityAdminForm';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function NuevaActividadPage({ params }: PageProps) {
  await requireMagazineAccess();
  const { locale } = await params;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <nav className="text-sm text-gray-400 mb-6">
        <Link href={`/${locale}/admin/bitacora`} className="hover:text-red-600 transition-colors">
          ← Volver a Bitácora
        </Link>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nueva Actividad</h1>

      <ActivityAdminForm locale={locale} />
    </div>
  );
}
