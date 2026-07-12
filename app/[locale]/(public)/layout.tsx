import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header público mínimo */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="AO Deporte"
              width={100}
              height={32}
              className="h-8 w-auto"
            />
          </Link>

          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link href="/bitacora" className="text-gray-600 hover:text-red-600 transition-colors">
              Bitácora
            </Link>
            <Link href="/revista" className="text-gray-600 hover:text-red-600 transition-colors">
              Revista
            </Link>
            <Link
              href="/login"
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            >
              Ingresar
            </Link>
          </nav>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-4 text-sm text-gray-400">
          <p>© {new Date().getFullYear()} AO Deporte. Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <Link href="/privacy-policy" className="hover:text-gray-600">Privacidad</Link>
            <Link href="/login" className="hover:text-gray-600">Plataforma</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
