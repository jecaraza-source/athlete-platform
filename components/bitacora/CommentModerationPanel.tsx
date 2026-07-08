'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ActivityComment } from '@/lib/types/bitacora';
import { moderateComment, deleteComment } from '@/lib/bitacora/actions';

interface CommentModerationPanelProps {
  comments: ActivityComment[];
}

export function CommentModerationPanel({ comments: initial }: CommentModerationPanelProps) {
  const [comments, setComments] = useState(initial);
  const [loading,  setLoading]  = useState<string | null>(null);

  async function handleModerate(id: string, approved: boolean) {
    setLoading(id);
    const result = await moderateComment(id, approved);
    setLoading(null);
    if (!result.error) {
      setComments((prev) => prev.map((c) => c.id === id ? { ...c, approved } : c));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este comentario?')) return;
    setLoading(id);
    const result = await deleteComment(id);
    setLoading(null);
    if (!result.error) {
      setComments((prev) => prev.filter((c) => c.id !== id));
    }
  }

  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        No hay comentarios para moderar.
      </div>
    );
  }

  const pending  = comments.filter((c) => !c.approved);
  const approved = comments.filter((c) => c.approved);

  return (
    <div className="flex flex-col gap-4">
      {/* Pendientes */}
      {pending.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-2">
            Pendientes de revisión ({pending.length})
          </h4>
          <div className="flex flex-col gap-2">
            {pending.map((comment) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                loading={loading === comment.id}
                onApprove={() => handleModerate(comment.id, true)}
                onDelete={() => handleDelete(comment.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Aprobados */}
      {approved.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-green-600 mb-2">
            Aprobados ({approved.length})
          </h4>
          <div className="flex flex-col gap-2">
            {approved.map((comment) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                loading={loading === comment.id}
                onReject={() => handleModerate(comment.id, false)}
                onDelete={() => handleDelete(comment.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  loading,
  onApprove,
  onReject,
  onDelete,
}: {
  comment:    ActivityComment;
  loading:    boolean;
  onApprove?: () => void;
  onReject?:  () => void;
  onDelete:   () => void;
}) {
  const date = format(new Date(comment.created_at), "d MMM yyyy 'a las' HH:mm", { locale: es });

  return (
    <div className={`border rounded-lg p-3 text-sm ${comment.approved ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-gray-800">{comment.author_name}</span>
          {comment.author_email && (
            <span className="text-xs text-gray-400">{comment.author_email}</span>
          )}
          <time className="text-xs text-gray-400">{date}</time>
        </div>

        <div className="flex gap-1.5 shrink-0">
          {onApprove && (
            <button
              type="button"
              disabled={loading}
              onClick={onApprove}
              className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-semibold px-2 py-1 rounded-lg"
            >
              ✓ Aprobar
            </button>
          )}
          {onReject && (
            <button
              type="button"
              disabled={loading}
              onClick={onReject}
              className="bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold px-2 py-1 rounded-lg"
            >
              ↩ Ocultar
            </button>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={onDelete}
            className="bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-600 text-xs font-semibold px-2 py-1 rounded-lg"
          >
            🗑
          </button>
        </div>
      </div>

      <p className="mt-2 text-gray-700 leading-relaxed">{comment.comment}</p>
    </div>
  );
}
