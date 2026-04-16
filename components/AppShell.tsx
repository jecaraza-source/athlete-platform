import Image from 'next/image';
import { ReactNode } from 'react';
import { getAuthUser, hasRole } from '@/lib/rbac/server';
import SignOutButton from './sign-out-button';
import NavLinks from './nav-links';
import LanguageSwitcher from './language-switcher';

export default async function AppShell({ children }: { children: ReactNode }) {
  const authUser = await getAuthUser();

  // Determine role-level access once, server-side, to drive sidebar visibility.
  // Both calls reuse the same memoized getCurrentUser() — only one DB round-trip.
  const [showAdmin, isAthlete] = await Promise.all([
    hasRole('super_admin', 'admin', 'program_director'),
    hasRole('athlete'),
  ]);

  return (
    <div className="min-h-screen flex bg-gray-50 text-gray-900">
      {/* Sidebar — hidden when printing */}
      <aside className="w-56 shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col print:hidden">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-200">
        <Image
          src="/logo.png"
          alt="AO Deportes"
          width={160}
          height={40}
          className="mb-6"
          style={{ height: 'auto' }}
          priority
        />
        </div>

        {/* Navigation */}
        <NavLinks showAdmin={showAdmin} isAthlete={isAthlete} />

        {/* Footer */}
        <div className="border-t border-gray-200">
          <LanguageSwitcher />
        </div>
        {authUser && (
          <div className="px-3 pb-3 border-t border-gray-200">
            <p
              className="truncate text-xs text-gray-400 px-3 mb-1 mt-2"
              title={authUser.email ?? ''}
            >
              {authUser.email}
            </p>
            <SignOutButton />
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-white print:w-full">{children}</main>
    </div>
  );
}
