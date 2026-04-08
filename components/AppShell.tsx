import Image from 'next/image';
import { ReactNode } from 'react';
import { getAuthUser } from '@/lib/rbac/server';
import SignOutButton from './sign-out-button';
import NavLinks from './nav-links';

export default async function AppShell({ children }: { children: ReactNode }) {
  const authUser = await getAuthUser();

  return (
    <div className="min-h-screen flex bg-gray-50 text-gray-900">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-200">
          <Image
            src="/logo.png"
            alt="Athlete Platform"
            width={140}
            height={36}
            priority
          />
        </div>

        {/* Navigation */}
        <NavLinks />

        {/* Footer */}
        {authUser && (
          <div className="px-3 py-3 border-t border-gray-200">
            <p
              className="truncate text-xs text-gray-400 px-3 mb-1"
              title={authUser.email ?? ''}
            >
              {authUser.email}
            </p>
            <SignOutButton />
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-white">{children}</main>
    </div>
  );
}
