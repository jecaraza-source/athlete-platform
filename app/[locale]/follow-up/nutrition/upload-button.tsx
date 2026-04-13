'use client';

import { useRef, useState, useTransition } from 'react';
import { uploadNutritionFile } from './upload-action';

export default function UploadButton({
  planId,
  hasFile,
}: {
  planId: string;
  hasFile: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    startTransition(async () => {
      const result = await uploadNutritionFile(planId, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
      }
      // Reset so the same file can be re-selected if needed
      if (inputRef.current) inputRef.current.value = '';
    });
  }

  return (
    <div className="mt-3">
      {error && (
        <p className="mb-2 text-xs text-red-600">{error}</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleChange}
      />
      <button
        type="button"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        {isPending ? (
          'Uploading…'
        ) : (
          <>
            <span>{hasFile ? '↑ Replace file' : '📎 Attach file'}</span>
          </>
        )}
      </button>
    </div>
  );
}
