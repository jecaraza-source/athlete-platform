// Server Component — muestra el uso del bucket activity-photos
import { getStorageUsage } from '@/lib/bitacora/queries';
import { MAX_FILE_SIZE_BYTES } from '@/lib/storage-config';

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function StorageUsageIndicator() {
  const { fileCount, totalBytes } = await getStorageUsage();

  // Supabase Free plan: 1 GB storage
  const FREE_PLAN_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB
  const pct = Math.min(100, Math.round((totalBytes / FREE_PLAN_BYTES) * 100));

  const barColor =
    pct > 80 ? 'bg-red-500' :
    pct > 60 ? 'bg-amber-400' :
    'bg-green-500';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">Almacenamiento (bucket activity-photos)</span>
        <span className="text-sm font-mono text-gray-500">{formatBytes(totalBytes)} / 1 GB</span>
      </div>

      {/* Barra de progreso */}
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{fileCount} fotos almacenadas</span>
        <span>{pct}% utilizado</span>
      </div>

      {pct > 80 && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          ⚠ El almacenamiento está casi lleno. Considera eliminar fotos antiguas o actualizar al plan Pro.
        </p>
      )}
    </div>
  );
}
