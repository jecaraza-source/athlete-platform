import Image from 'next/image';
import Link from 'next/link';
import { ReactNode } from 'react';
import { getAuthUser } from '@/lib/rbac/server';
import SignOutButton from './sign-out-button';

const links = [
  { href: '/dashboard', label: 'Dashboard',  style: 'text-indigo-700  bg-indigo-50  hover:bg-indigo-100'  },
  { href: '/athletes',  label: 'Athletes',   style: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' },
  { href: '/calendar',  label: 'Calendar',   style: 'text-sky-700     bg-sky-50     hover:bg-sky-100'     },
  { href: '/follow-up', label: 'Follow-up',  style: 'text-amber-700   bg-amber-50   hover:bg-amber-100'   },
  { href: '/admin',     label: 'Admin',      style: 'text-rose-700    bg-rose-50    hover:bg-rose-100'    },
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
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${link.style}`}
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
