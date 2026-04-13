import { requirePermission } from '@/lib/rbac/server';
import { supabaseAdmin }     from '@/lib/supabase-admin';
import BackButton from '@/components/back-button';

export const dynamic = 'force-dynamic';

export default async function DispositivosPage() {
  await requirePermission('manage_push_campaigns');

  const { data: tokens } = await supabaseAdmin
    .from('push_device_tokens')
    .select(`
      id, platform, device_name, is_active, last_seen_at, registered_at,
      profile:profiles(first_name, last_name, email, role)
    `)
    .order('registered_at', { ascending: false });

  const active   = (tokens ?? []).filter((t) => t.is_active).length;
  const inactive = (tokens ?? []).length - active;

  return (
    <main className="p-8">
      <BackButton href="/admin/notificaciones/push" label="Volver a Push" />

      <div className="mt-4 mb-8">
        <h1 className="text-2xl font-bold text-violet-700">Dispositivos Registrados</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tokens de push registrados por los usuarios de la plataforma.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total dispositivos', value: (tokens ?? []).length },
          { label: 'Activos',            value: active },
          { label: 'Inactivos',          value: inactive },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-800">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {!tokens || tokens.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-400">
          <p className="font-medium">Sin dispositivos registrados todavía.</p>
          <p className="text-sm mt-2">
            Los dispositivos se registran automáticamente desde la app móvil al iniciar sesión.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Usuario</th>
                <th className="px-4 py-3 text-left">Plataforma</th>
                <th className="px-4 py-3 text-left">Dispositivo</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Última actividad</th>
                <th className="px-4 py-3 text-left">Registrado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tokens.map((tok) => {
                const profile = Array.isArray(tok.profile) ? tok.profile[0] : tok.profile;
                return (
                  <tr key={tok.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">
                        {profile ? `${(profile as {first_name:string}).first_name} ${(profile as {last_name:string}).last_name}` : '—'}
                      </p>
                      <p className="text-xs text-gray-400">{(profile as {email:string} | null)?.email}</p>
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-600">{tok.platform}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{tok.device_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        tok.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {tok.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {tok.last_seen_at
                        ? new Date(tok.last_seen_at).toLocaleDateString('es-MX')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(tok.registered_at).toLocaleDateString('es-MX')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
