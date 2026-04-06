import Image from 'next/image';
import Link from 'next/link';
import { ReactNode } from 'react';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/athletes', label: 'Athletes' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/follow-up', label: 'Follow-up' },
  { href: '/admin', label: 'Admin' },
];

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-white text-gray-900">
      <aside className="w-64 border-r border-gray-200 p-5">
        <Image
          src="/logo.png"
          alt="Athlete Platform"
          width={160}
          height={40}
          className="mb-6"
          priority
        />

        <nav className="space-y-3">
          {links.map((link) => (
            <div key={link.href}>
              <Link
                href={link.href}
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                {link.label}
              </Link>
            </div>
          ))}
        </nav>
      </aside>

      <main className="flex-1">{children}</main>
    </div>
  );
}