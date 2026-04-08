import Image from 'next/image';
import Link from 'next/link';
import { ReactNode } from 'react';
import { getAuthUser } from '@/lib/rbac/server';
import SignOutButton from './sign-out-button';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/athletes',  label: 'Athletes'  },
  { href: '/calendar',  label: 'Calendar'  },
  { href: '/follow-up', label: 'Follow-up' },
  { href: '/admin',     label: 'Admin'     },
];

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
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200/70 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

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
