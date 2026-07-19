import { requireAdminAccess }    from '@/lib/rbac/server';
import { fetchGalleryData }       from '@/lib/historiaGraficaQueries';
import HistoriaGraficaClient      from './HistoriaGraficaClient';

export const dynamic = 'force-dynamic';

export default async function HistoriaGraficaPage() {
  await requireAdminAccess();

  const initialData = await fetchGalleryData();

  return <HistoriaGraficaClient initialData={initialData} />;
}
