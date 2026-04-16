import BackButton from '@/components/back-button';
import { Link }     from '@/i18n/navigation';
import { requireAuthenticated } from '@/lib/rbac/server';
import { getProtocolByDiscipline, getProtocolSignedUrl } from '@/lib/protocols/actions';

export const dynamic = 'force-dynamic';

export default async function PhysioProtocolsPage() {
  await requireAuthenticated();
  const protocol  = await getProtocolByDiscipline('physio');
  const signedUrl = protocol ? await getProtocolSignedUrl(protocol.file_path) : null;

  return (
    <main className="p-8 max-w-5xl">
      <BackButton href="/protocols" label="Volver a Protocolos" />

      <div className="flex items-center justify-between mt-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-orange-700">Protocolo: Fisioterapia</h1>
          {protocol && (
            <p className="text-xs text-gray-400 mt-1">
              {protocol.file_name}
              {protocol.version ? ` · v${protocol.version}` : ''}
              {` · ${new Date(protocol.updated_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}`}
            </p>
          )}
        </div>
        {signedUrl && (
          <a href={signedUrl} download className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100 transition-colors">
            ⤓ Descargar PDF
          </a>
        )}
      </div>

      {signedUrl ? (
        <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: '80vh' }}>
          <embed src={signedUrl} type="application/pdf" width="100%" height="100%" />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm font-medium">Sin protocolo disponible</p>
          <p className="text-gray-400 text-xs mt-1">El administrador aún no ha cargado el protocolo para esta disciplina.</p>
          <Link href="/admin/protocols" className="mt-4 inline-block text-xs text-indigo-600 hover:underline">
            Ir a Admin → Protocolos
          </Link>
        </div>
      )}
    </main>
  );
}
