'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  uploadFinanceAttachment,
  deleteFinanceAttachment,
  getFinanceAttachmentSignedUrl,
} from '@/lib/finance/actions';
import type { FinanceAttachment } from '@/lib/types/finance';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export function FinanceAttachmentUpload({
  expenseId,
  attachments,
}: {
  expenseId: string;
  attachments: FinanceAttachment[];
}) {
  const t = useTranslations('finances.attachmentUpload');
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [openingId, setOpeningId] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setErrors([]);

    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append('files', f));

    startTransition(async () => {
      const result = await uploadFinanceAttachment(expenseId, formData);
      if (result.errors.length > 0) setErrors(result.errors);
      if (inputRef.current) inputRef.current.value = '';
    });
  }

  async function handleOpen(attachment: FinanceAttachment) {
    setOpeningId(attachment.id);
    const url = await getFinanceAttachmentSignedUrl(attachment.file_path);
    setOpeningId(null);
    if (url) window.open(url, '_blank');
  }

  async function handleDelete(attachmentId: string) {
    if (!confirm(t('deleteConfirm'))) return;
    startTransition(async () => {
      await deleteFinanceAttachment(attachmentId);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">
          {t('title', { count: attachments.length })}
        </h4>
        <label className="cursor-pointer">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.xlsx,.xls,.docx,.doc,.csv,.txt"
            className="sr-only"
            onChange={handleFileChange}
            disabled={isPending}
          />
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              isPending
                ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-wait'
                : 'border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 cursor-pointer'
            }`}
          >
            {isPending ? t('uploading') : t('uploadBtn')}
          </span>
        </label>
      </div>

      {errors.length > 0 && (
        <ul className="rounded-md bg-red-50 border border-red-200 p-3 space-y-1">
          {errors.map((e, i) => (
            <li key={i} className="text-xs text-red-700">{e}</li>
          ))}
        </ul>
      )}

      {attachments.length === 0 ? (
        <p className="text-xs text-gray-400 italic">{t('noReceipts')}</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="flex-1 text-xs text-gray-700 truncate">{a.file_name_original}</span>
              <span className="text-xs text-gray-400 shrink-0">{formatBytes(a.file_size)}</span>
              <button
                type="button"
                onClick={() => handleOpen(a)}
                disabled={openingId === a.id}
                className="text-xs text-indigo-600 hover:text-indigo-800 shrink-0"
              >
                {openingId === a.id ? t('opening') : t('viewBtn')}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(a.id)}
                disabled={isPending}
                className="text-xs text-red-500 hover:text-red-700 shrink-0"
              >
                {t('deleteBtn')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
