import Image from 'next/image';
import { ReactNode } from 'react';
import { getCurrentUser, hasRole } from '@/lib/rbac/server';
import SignOutButton from './sign-out-button';
import NavLinks from './nav-links';
import LanguageSwitcher from './language-switcher';

export default async function AppShell({ children }: { children: ReactNode }) {
  // getCurrentUser() is memoized — hasRole() reuses the same resolved data.
  const [currentUser, showAdmin, isAthlete] = await Promise.all([
    getCurrentUser(),
    hasRole('super_admin', 'admin', 'program_director'),
    hasRole('athlete'),
  ]);

  const profile  = currentUser?.profile ?? null;
  const authUser = profile; // keeps remaining code compatible

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
            {/* Avatar + email row */}
            <div className="flex items-center gap-2 px-1 mt-2 mb-1">
              {/* Mini avatar */}
              {profile?.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt=""
                  width={24}
                  height={24}
                  className="w-6 h-6 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold leading-none">
                    {profile?.first_name?.[0]?.toUpperCase() ?? '?'}
                  </span>
                </div>
              )}
              <p
                className="truncate text-xs text-gray-400 min-w-0"
                title={profile?.email ?? ''}
              >
                {profile?.email}
              </p>
            </div>
            <SignOutButton />
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-white print:w-full">{children}</main>
    </div>
  );
}
