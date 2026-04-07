import Image from 'next/image';
import Link from 'next/link';
import { ReactNode } from 'react';
import { getAuthUser } from '@/lib/rbac/server';
import SignOutButton from './sign-out-button';

const links = [
  { href: '/dashboard', label: 'Dashboard',  color: 'bg-indigo-600 hover:bg-indigo-700' },
  { href: '/athletes',  label: 'Athletes',   color: 'bg-emerald-600 hover:bg-emerald-700' },
  { href: '/calendar',  label: 'Calendar',   color: 'bg-sky-600 hover:bg-sky-700' },
  { href: '/follow-up', label: 'Follow-up',  color: 'bg-amber-500 hover:bg-amber-600' },
  { href: '/admin',     label: 'Admin',      color: 'bg-rose-600 hover:bg-rose-700' },
];

export default async function AppShell({ children }: { children: ReactNode }) {
  const authUser = await getAuthUser();

  return (
    <div className="min-h-screen flex bg-white text-gray-900">
      <aside className="w-64 border-r border-gray-200 p-5 flex flex-col">
        <Image
          src="/logo.png"
          alt="Athlete Platform"
          width={160}
          height={40}
          className="mb-6"
          priority
        />

        <nav className="space-y-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`block w-full text-center text-sm font-medium text-white px-4 py-2 rounded-lg transition-colors ${link.color}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {authUser && (
          <div className="mt-auto pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 truncate px-1 mb-2" title={authUser.email ?? ''}>
              {authUser.email}
            </p>
            <SignOutButton />
          </div>
        )}
      </aside>

      <main className="flex-1">{children}</main>
    </div>
  );
}
