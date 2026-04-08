'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    inactive: 'bg-indigo-50  text-indigo-600  hover:bg-indigo-100  hover:text-indigo-800',
    active:   'bg-indigo-100 text-indigo-900',
  },
  {
    href: '/athletes',
    label: 'Athletes',
    inactive: 'bg-emerald-50  text-emerald-600  hover:bg-emerald-100  hover:text-emerald-800',
    active:   'bg-emerald-100 text-emerald-900',
  },
  {
    href: '/calendar',
    label: 'Calendar',
    inactive: 'bg-sky-50  text-sky-600  hover:bg-sky-100  hover:text-sky-800',
    active:   'bg-sky-100 text-sky-900',
  },
  {
    href: '/follow-up',
    label: 'Follow-up',
    inactive: 'bg-amber-50  text-amber-600  hover:bg-amber-100  hover:text-amber-800',
    active:   'bg-amber-100 text-amber-900',
  },
  {
    href: '/admin',
    label: 'Admin',
    inactive: 'bg-rose-50  text-rose-600  hover:bg-rose-100  hover:text-rose-800',
    active:   'bg-rose-100 text-rose-900',
  },
  {
    href: '/protocols',
    label: 'Protocols',
    inactive: 'bg-violet-50  text-violet-600  hover:bg-violet-100  hover:text-violet-800',
    active:   'bg-violet-100 text-violet-900',
  },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {links.map((link) => {
        // Dashboard matches exactly; all others match if the path starts with the href
        const isActive =
          link.href === '/dashboard'
            ? pathname === '/dashboard' || pathname === '/'
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center px-3 py-2.5 rounded-md text-base transition-colors ${
              isActive
                ? `font-bold   ${link.active}`
                : `font-semibold ${link.inactive}`
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
