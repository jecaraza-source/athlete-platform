import BackButton from '@/components/back-button';
import { requireAdminAccess } from '@/lib/rbac/server';
import { getAllProtocols, getProtocolSignedUrl, type DisciplineKey } from '@/lib/protocols/actions';
import { UploadProtocolForm } from './upload-form';

export const dynamic = 'force-dynamic';

// Discipline display labels (in Spanish)
const DISCIPLINE_META: Record<DisciplineKey, { label: string; color: string; border: string }> = {
  coach:      { label: 'Entrenador',    color: 'text-blue-800',    border: 'border-blue-200' },
  physio:     { label: 'Fisioterapia',  color: 'text-orange-800',  border: 'border-orange-200' },
  medic:      { label: 'Médico',        color: 'text-rose-800',    border: 'border-rose-200' },
  nutrition:  { label: 'Nutrición',     color: 'text-emerald-800', border: 'border-emerald-200' },
  psychology: { label: 'Psicología',    color: 'text-violet-800',  border: 'border-violet-200' },
};

const ALL_DISCIPLINES = Object.keys(DISCIPLINE_META) as DisciplineKey[];

export default async function AdminProtocolsPage() {
  await requireAdminAccess();

  // Fetch all existing protocols and generate signed URLs in parallel
  const protocols = await getAllProtocols();
  const protocolMap = Object.fromEntries(protocols.map((p) => [p.discipline, p]));

  // Generate signed URLs for all existing protocols concurrently
  const signedUrls = Object.fromEntries(
    await Promise.all(
      protocols.map(async (p) => {
        const url = await getProtocolSignedUrl(p.file_path);
        return [p.discipline, url];
      })
    )
  );

  return (
    <main className="p-8 max-w-3xl">
      <BackButton href="/admin" label="Volver a Admin" />

      <h1 className="text-2xl font-bold mt-4 mb-1 text-violet-700">
        Gestión de Protocolos
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Carga un PDF por disciplina. El documento se mostrará en la sección
        Protocolos tanto para staff como para atletas. El archivo anterior se
        elimina automáticamente al reemplazarlo.
      </p>

      <div className="space-y-4">
        {ALL_DISCIPLINES.map((disc) => {
          const meta     = DISCIPLINE_META[disc];
          const existing = protocolMap[disc] ?? null;
          const url      = (signedUrls[disc] as string | undefined) ?? null;

          return (
            <div key={disc} className={`rounded-xl border-l-4 ${meta.border}`}>
              <div className="bg-white rounded-r-xl rounded-bl-xl overflow-hidden">
                <div className={`px-4 py-2 border-b border-gray-100`}>
                  <span className={`text-xs font-semibold uppercase tracking-wide ${meta.color}`}>
                    Disciplina
                  </span>
                  <span className={`ml-2 text-sm font-bold ${meta.color}`}>
                    {meta.label}
                  </span>
                </div>
                <div className="p-1">
                  <UploadProtocolForm
                    discipline={disc}
                    existing={existing}
                    signedUrl={url}
                    label={meta.label}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
