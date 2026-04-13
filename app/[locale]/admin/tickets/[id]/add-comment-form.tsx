'use client';

import { useOptimistic, useTransition, useState, useRef } from 'react';
import { addComment } from '../actions';
import type { CommentWithAuthor, TicketProfile } from '@/lib/tickets/types';

interface Props {
  ticketId: string;
  initialComments: CommentWithAuthor[];
  /** Pass null to hide the comment form (user lacks comment_tickets permission). */
  currentUserProfile: TicketProfile | null;
}

export default function AddCommentForm({
  ticketId,
  initialComments,
  currentUserProfile,
}: Props) {
  const [optimisticComments, addOptimisticComment] = useOptimistic(
    initialComments,
    (state: CommentWithAuthor[], newComment: CommentWithAuthor) => [
      ...state,
      newComment,
    ]
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(formData: FormData) {
    const message = (formData.get('message') as string) ?? '';
    if (!message.trim()) return;

    // Build an optimistic comment to show immediately
    const optimistic: CommentWithAuthor = {
      id:         crypto.randomUUID(),
      ticket_id:  ticketId,
      author_id:  currentUserProfile?.id ?? '',
      message:    message.trim(),
      created_at: new Date().toISOString(),
      author:     currentUserProfile ?? null,
    };

    startTransition(async () => {
      addOptimisticComment(optimistic);
      const result = await addComment(ticketId, message);
      if (result?.error) {
        setError(result.error);
      } else {
        setError(null);
        if (textareaRef.current) textareaRef.current.value = '';
      }
    });
  }

  return (
    <div>
      {/* ── Thread ───────────────────────────────────────────────────────── */}
      {optimisticComments.length === 0 ? (
        <p className="text-sm text-gray-400 italic mb-6">No comments yet.</p>
      ) : (
        <ul className="space-y-4 mb-6">
          {optimisticComments.map((comment) => (
            <li
              key={comment.id}
              className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-medium text-sm text-gray-900">
                  {comment.author
                    ? `${comment.author.first_name} ${comment.author.last_name}`
                    : 'Unknown'}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(comment.created_at).toLocaleString('en-US', {
                    month:  'short',
                    day:    'numeric',
                    hour:   '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.message}</p>
            </li>
          ))}
        </ul>
      )}

      {/* ── Add comment form (only shown when user has permission) ──────── */}
      {currentUserProfile && (
        <form action={handleSubmit} className="space-y-3">
          {error && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <textarea
            ref={textareaRef}
            name="message"
            required
            rows={3}
            placeholder="Write a comment…"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Posting…' : 'Add Comment'}
          </button>
        </form>
      )}
    </div>
  );
}
