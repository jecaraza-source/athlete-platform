'use client';

import { useState } from 'react';
import { submitComment } from '@/lib/bitacora/actions';

interface CommentFormProps {
  activityId: string;
}

export function CommentForm({ activityId }: CommentFormProps) {
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [text,    setText]    = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await submitComment({
      activity_id:  activityId,
      author_name:  name,
      author_email: email || undefined,
      comment:      text,
    });

    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setName('');
      setEmail('');
      setText('');
    }
  }

  if (success) {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-700">
        ¡Comentario enviado! Aparecerá después de ser revisado.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <h3 className="font-semibold text-gray-900">Deja un comentario</h3>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="comment-name" className="text-sm font-medium text-gray-700">
            Tu nombre <span className="text-red-500">*</span>
          </label>
          <input
            id="comment-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            placeholder="Juan García"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="comment-email" className="text-sm font-medium text-gray-700">
            Tu correo <span className="text-gray-400 text-xs">(opcional, no se publica)</span>
          </label>
          <input
            id="comment-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={200}
            placeholder="juan@ejemplo.com"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="comment-text" className="text-sm font-medium text-gray-700">
          Comentario <span className="text-red-500">*</span>
        </label>
        <textarea
          id="comment-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          rows={4}
          maxLength={1000}
          placeholder="Escribe tu comentario aquí…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
        />
        <span className="text-xs text-gray-400 text-right">{text.length}/1000</span>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !name.trim() || !text.trim()}
        className="self-start bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
      >
        {loading ? 'Enviando…' : 'Enviar comentario'}
      </button>
    </form>
  );
}
