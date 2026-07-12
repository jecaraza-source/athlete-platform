'use client';

/**
 * AvatarUploader
 *
 * Displays the user's profile photo (or an initials circle as fallback)
 * and lets them pick a new photo or delete the current one.
 *
 * Props:
 *   currentUrl  — current avatar_url from the profile (null = no photo yet)
 *   initials    — 1–2 uppercase letters shown when there is no photo
 *   size        — optional visual size ('sm' | 'md' | 'lg', default 'md')
 */

import { useRef, useState, useTransition } from 'react';
import Image                               from 'next/image';
import { useTranslations }                 from 'next-intl';
import { uploadAvatar, deleteAvatar }      from '@/lib/avatar/actions';

type Size = 'sm' | 'md' | 'lg';

const SIZE: Record<Size, { circle: string; text: string; px: number }> = {
  sm:  { circle: 'w-8  h-8',  text: 'text-sm',  px: 32  },
  md:  { circle: 'w-20 h-20', text: 'text-2xl', px: 80  },
  lg:  { circle: 'w-24 h-24', text: 'text-3xl', px: 96  },
};

type Props = {
  currentUrl?: string | null;
  initials:    string;
  size?:       Size;
  /** When true, hides the action buttons (read-only display). */
  readOnly?:   boolean;
};

export function AvatarUploader({
  currentUrl,
  initials,
  size     = 'md',
  readOnly = false,
}: Props) {
  const t        = useTranslations('preferences.avatar');
  const fileRef  = useRef<HTMLInputElement>(null);
  const s        = SIZE[size];

  const [url, setUrl]         = useState<string | null>(currentUrl ?? null);
  const [error, setError]     = useState<string | null>(null);
  const [isPending, start]    = useTransition();

  // ── Upload ──────────────────────────────────────────────────────────────
  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant local preview
    const preview = URL.createObjectURL(file);
    setUrl(preview);
    setError(null);

    const fd = new FormData();
    fd.append('avatar', file);

    start(async () => {
      const result = await uploadAvatar(fd);
      if (result.error) {
        setError(result.error);
        setUrl(currentUrl ?? null); // revert on error
      } else if (result.avatarUrl) {
        setUrl(result.avatarUrl);
      }
      // Reset input so the same file can be re-selected after an error
      if (fileRef.current) fileRef.current.value = '';
    });
  }

  // ── Delete ──────────────────────────────────────────────────────────────
  function handleDelete() {
    setError(null);
    start(async () => {
      const result = await deleteAvatar();
      if (!result.error) {
        setUrl(null);
      } else {
        setError(result.error);
      }
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex items-center gap-5">
      {/* Avatar circle */}
      <div className="relative shrink-0">
        <div
          className={`${s.circle} rounded-full overflow-hidden bg-indigo-600
            flex items-center justify-center select-none`}
        >
          {url ? (
            <Image
              src={url}
              alt={t('title')}
              width={s.px}
              height={s.px}
              className="w-full h-full object-cover"
              unoptimized={url.startsWith('blob:')}
            />
          ) : (
            <span className={`font-bold text-white ${s.text}`}>
              {initials || '?'}
            </span>
          )}
        </div>

        {/* Uploading overlay */}
        {isPending && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white animate-spin"
              fill="none" viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25" cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4"
              />
              <path
                className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Actions */}
      {!readOnly && (
        <div className="flex flex-col gap-1.5">
          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleSelect}
          />

          <button
            type="button"
            disabled={isPending}
            onClick={() => fileRef.current?.click()}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800
              disabled:opacity-50 text-left transition-colors"
          >
            {isPending ? t('uploading') : t('change')}
          </button>

          {url && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleDelete}
              className="text-sm text-red-500 hover:text-red-700
                disabled:opacity-50 text-left transition-colors"
            >
              {t('delete')}
            </button>
          )}

          <p className="text-xs text-gray-400">{t('formatHint')}</p>

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
