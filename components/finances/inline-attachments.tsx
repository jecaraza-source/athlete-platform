'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

export type InlineAttachmentItem = {
  id: string;
  file_name_original: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
};

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 ** 2).toFixed(1)} MB`;
}

export function InlineAttachments({
  label,
  color = 'indigo',
  uploadFn,
  listFn,
  deleteFn,
  signedUrlFn,
  canManage = true,
}: {
  label: string;
  color?: 'indigo' | 'sky' | 'violet' | 'emerald';
  uploadFn: (fd: FormData) => Promise<{ errors: string[]; uploaded: number }>;
  listFn: () => Promise<InlineAttachmentItem[]>;
  deleteFn: (id: string) => Promise<{ error: string | null }>;
  signedUrlFn: (path: string) => Promise<string | null>;
  canManage?: boolean;
}) {
  const t = useTranslations('finances.attachments');
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<InlineAttachmentItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const colors: Record<string, { btn: string; badge: string }> = {
    indigo:  { btn: 'border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100', badge: 'bg-indigo-100 text-indigo-700' },
    sky:     { btn: 'border-sky-200 text-sky-700 bg-sky-50 hover:bg-sky-100',           badge: 'bg-sky-100 text-sky-700' },
    violet:  { btn: 'border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100', badge: 'bg-violet-100 text-violet-700' },
    emerald: { btn: 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100', badge: 'bg-emerald-100 text-emerald-700' },
  };
  const c = colors[color];

  useEffect(() => {
    listFn().then(data => { setItems(data); setLoaded(true); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setErrors([]);
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append('files', f));
    startTransition(async () => {
      const result = await uploadFn(fd);
      if (result.errors.length) { setErrors(result.errors); }
      if (result.uploaded > 0) {
        const fresh = await listFn();
        setItems(fresh);
      }
      if (inputRef.current) inputRef.current.value = '';
    });
  }

  async function handleOpen(item: InlineAttachmentItem) {
    setOpeningId(item.id);
    const url = await signedUrlFn(item.file_path);
    setOpeningId(null);
    if (url) window.open(url, '_blank');
  }

  function handleDelete(item: InlineAttachmentItem) {
    if (!confirm(t('deleteConfirm', { name: item.file_name_original }))) return;
    startTransition(async () => {
      await deleteFn(item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
    });
  }

  const count = items.length;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600">
          {label}
          {loaded && count > 0 && (
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-medium ${c.badge}`}>{count}</span>
          )}
        </span>
        {canManage && (
          <label className="cursor-pointer">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.docx,.doc,.csv,.txt"
              className="sr-only"
              onChange={handleFileChange}
              disabled={isPending}
            />
            <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border cursor-pointer transition-colors ${isPending ? 'opacity-50 cursor-wait' : c.btn}`}>
              {isPending ? t('uploading') : t('uploadBtn')}
            </span>
          </label>
        )}
      </div>

      {errors.length > 0 && (
        <ul className="rounded bg-red-50 border border-red-200 p-2 space-y-0.5">
          {errors.map((e, i) => <li key={i} className="text-xs text-red-700">{e}</li>)}
        </ul>
      )}

      {!loaded && (
        <p className="text-xs text-gray-400 italic">{t('loading')}</p>
      )}
      {loaded && count === 0 && (
        <p className="text-xs text-gray-400 italic">{t('noFiles')}</p>
      )}
      {count > 0 && (
        <ul className="space-y-1">
          {items.map(item => (
            <li key={item.id} className="flex items-center gap-1.5 rounded bg-gray-50 border border-gray-200 px-2 py-1">
              <svg className="h-3.5 w-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="flex-1 text-xs text-gray-700 truncate max-w-[160px]" title={item.file_name_original}>
                {item.file_name_original}
              </span>
              <span className="text-xs text-gray-400 shrink-0">{formatBytes(item.file_size)}</span>
              <button type="button" onClick={() => handleOpen(item)} disabled={openingId === item.id}
                className="text-xs text-indigo-600 hover:text-indigo-800 shrink-0">
                {openingId === item.id ? '…' : t('viewBtn')}
              </button>
              {canManage && (
                <button type="button" onClick={() => handleDelete(item)} disabled={isPending}
                  className="text-xs text-red-500 hover:text-red-700 shrink-0">
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
