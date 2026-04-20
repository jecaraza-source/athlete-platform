'use client';

import { Link, usePathname } from '@/i18n/navigation';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

// Hrefs hidden from the 'athlete' role (staff/admin-only pages).
const STAFF_ONLY_HREFS = new Set(['/athletes', '/follow-up']);

// Hrefs hidden from non-athletes (athlete-specific pages).
// Staff/admin use the full admin panel equivalents instead.
const ATHLETE_ONLY_HREFS = new Set(['/tickets']);

const mainLinks = [
  {
    href: '/dashboard' as const,
    key: 'dashboard',
    inactive: 'bg-indigo-50  text-indigo-600  hover:bg-indigo-100  hover:text-indigo-800',
    active:   'bg-indigo-100 text-indigo-900',
  },
  {
    href: '/athletes' as const,
    key: 'athletes',
    inactive: 'bg-emerald-50  text-emerald-600  hover:bg-emerald-100  hover:text-emerald-800',
    active:   'bg-emerald-100 text-emerald-900',
  },
  {
    href: '/calendar' as const,
    key: 'calendar',
    inactive: 'bg-sky-50  text-sky-600  hover:bg-sky-100  hover:text-sky-800',
    active:   'bg-sky-100 text-sky-900',
  },
  {
    href: '/plans' as const,
    key: 'plans',
    inactive: 'bg-indigo-50  text-indigo-600  hover:bg-indigo-100  hover:text-indigo-800',
    active:   'bg-indigo-100 text-indigo-900',
  },
  {
    href: '/follow-up' as const,
    key: 'followUp',
    inactive: 'bg-amber-50  text-amber-600  hover:bg-amber-100  hover:text-amber-800',
    active:   'bg-amber-100 text-amber-900',
  },
  {
    href: '/protocols' as const,
    key: 'protocols',
    inactive: 'bg-violet-50  text-violet-600  hover:bg-violet-100  hover:text-violet-800',
    active:   'bg-violet-100 text-violet-900',
  },
  // ―― Athlete-only link: Mis Tickets ―――――――――――――――――――――――――――――――――――――
  // Staff/admin access tickets via the Communications > /admin/tickets route.
  {
    href: '/tickets' as const,
    key: 'tickets',
    inactive: 'bg-teal-50  text-teal-600  hover:bg-teal-100  hover:text-teal-800',
    active:   'bg-teal-100 text-teal-900',
  },
];

// Sub-links shown inside the Communications accordion
const commsLinks = [
  { href: '/admin/tickets' as const, key: 'tickets' },
  { href: '/admin/notificaciones' as const, key: 'notifications' },
];

const COMMS_ROOTS = commsLinks.map((l) => l.href);

const prefsLink = {
  href: '/preferencias' as const,
  key: 'preferences',
  inactive: 'bg-gray-50  text-gray-600  hover:bg-gray-100  hover:text-gray-800',
  active:   'bg-gray-100 text-gray-900',
};

const adminLink = {
  href: '/admin' as const,
  key: 'admin',
  inactive: 'bg-rose-50  text-rose-600  hover:bg-rose-100  hover:text-rose-800',
  active:   'bg-rose-100 text-rose-900',
};

export default function NavLinks({
  showAdmin = false,
  isAthlete = false,
}: {
  showAdmin?: boolean;
  /** When true, hides staff-only sections (athlete list, follow-up, communications). */
  isAthlete?: boolean;
}) {
  const pathname = usePathname();
  const t = useTranslations('nav');

  // Auto-expand Communications when the current route is under it
  const isCommsActive = COMMS_ROOTS.some((r) => pathname.startsWith(r));
  const [commsOpen, setCommsOpen] = useState(isCommsActive);

  // Keep expanded if user navigates to a comms route from elsewhere
  useEffect(() => {
    if (isCommsActive) setCommsOpen(true);
  }, [isCommsActive]);

  function linkClass(href: string, inactive: string, active: string) {
    const isActive =
      href === '/dashboard'
        ? pathname === '/dashboard' || pathname === '/'
        : pathname.startsWith(href);
    return `flex items-center px-3 py-2.5 rounded-md text-base transition-colors ${
      isActive ? `font-bold ${active}` : `font-semibold ${inactive}`
    }`;
  }

  return (
    <nav className="flex-1 px-3 py-4 flex flex-col">
      {/* Main navigation links */}
      <div className="space-y-1">
        {mainLinks.map((link) => {
          // Staff-only items are hidden from athletes
          if (isAthlete && STAFF_ONLY_HREFS.has(link.href)) return null;
          // Athlete-only items are hidden from staff/admin
          if (!isAthlete && ATHLETE_ONLY_HREFS.has(link.href)) return null;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={linkClass(link.href, link.inactive, link.active)}
            >
              {t(link.key as Parameters<typeof t>[0])}
            </Link>
          );
        })}

        {/* ── Communications accordion — staff / admin only ──────── */}
        {!isAthlete && (
          <div>
            {/* Parent toggle button */}
            <button
              type="button"
              onClick={() => setCommsOpen((v) => !v)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-base transition-colors font-semibold ${
                isCommsActive
                  ? 'bg-teal-100 text-teal-900 font-bold'
                  : 'bg-teal-50 text-teal-600 hover:bg-teal-100 hover:text-teal-800'
              }`}
            >
              <span>{t('communications')}</span>
              <svg
                className={`h-4 w-4 transition-transform duration-200 ${
                  commsOpen ? 'rotate-90' : ''
                }`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Sub-links */}
            {commsOpen && (
              <div className="mt-1 ml-3 pl-3 border-l-2 border-teal-200 space-y-1">
                {commsLinks.map((link) => {
                  const isActive = pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center px-3 py-2 rounded-md text-sm transition-colors ${
                        isActive
                          ? 'bg-teal-100 text-teal-900 font-bold'
                          : 'text-teal-700 hover:bg-teal-50 hover:text-teal-900 font-medium'
                      }`}
                    >
                      {t(link.key as Parameters<typeof t>[0])}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preferences + Admin — pinned to the bottom of the nav column */}
      <div className="mt-auto pt-3 border-t border-gray-200 space-y-1">
        <Link
          href={prefsLink.href}
          className={linkClass(prefsLink.href, prefsLink.inactive, prefsLink.active)}
        >
          {t(prefsLink.key as Parameters<typeof t>[0])}
        </Link>
        {showAdmin && (
          <Link
            href={adminLink.href}
            className={linkClass(adminLink.href, adminLink.inactive, adminLink.active)}
          >
            {t(adminLink.key as Parameters<typeof t>[0])}
          </Link>
        )}
      </div>
    </nav>
  );
}
