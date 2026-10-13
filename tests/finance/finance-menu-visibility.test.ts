import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/navigation', async () => {
  const React = await import('react');

  return {
    Link: ({
      children,
      href,
      ...props
    }: {
      children: React.ReactNode;
      href: string;
    }) => React.createElement('a', { href, ...props }, children),
    usePathname: () => '/dashboard',
  };
});

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import NavLinks from '@/components/nav-links';

function renderNavigation({
  isAthlete = false,
  showFinances = false,
}: {
  isAthlete?: boolean;
  showFinances?: boolean;
}) {
  return renderToStaticMarkup(
    createElement(NavLinks, {
      isAthlete,
      showFinances,
    }),
  );
}

describe('Finance menu visibility', () => {
  it('shows Finance to the authorized support account after AppShell grants access', () => {
    const html = renderNavigation({ showFinances: true });

    expect(html).toContain('href="/finances"');
  });

  it('hides Finance from staff accounts that AppShell does not authorize', () => {
    const html = renderNavigation({ showFinances: false });

    expect(html).not.toContain('href="/finances"');
  });

  it('hides Finance from athletes even if they receive the finance flag', () => {
    const html = renderNavigation({
      isAthlete: true,
      showFinances: true,
    });

    expect(html).not.toContain('href="/finances"');
  });
});
