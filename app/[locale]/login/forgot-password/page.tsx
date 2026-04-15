'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { requestPasswordReset } from './actions';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError]   = useState<string | null>(null);
  const [sent, setSent]     = useState(false);
  const [isPending, start]  = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      const result = await requestPasswordReset(formData);
      if (result.sent) {
        setSent(true);
      } else if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Recuperar contraseña</h1>
          <p className="mt-1 text-sm text-gray-500">AO Deportes</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          {sent ? (
            /* Estado: correo enviado */
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              </div>
              <p className="text-sm font-medium text-gray-800">
                Correo enviado
              </p>
              <p className="text-sm text-gray-500">
                Si existe una cuenta con ese correo, recibirás un enlace para
                restablecer tu contraseña. Revisa también la carpeta de spam.
              </p>
              <button
                onClick={() => router.push('/login')}
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Volver al inicio de sesión
              </button>
            </div>
          ) : (
            /* Estado: formulario */
            <>
              <p className="text-sm text-gray-500 mb-5">
                Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
              </p>

              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form ref={formRef} action={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Correo electrónico
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="tu@ejemplo.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {isPending ? 'Enviando…' : 'Enviar enlace'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => router.push('/login')}
                  className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  ← Volver al inicio de sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
