import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { routing } from '@/i18n/routing';

export const metadata: Metadata = {
  title: 'Athlete Platform',
  description: 'Athlete development platform',
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as 'en' | 'es')) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AppShell>{children}</AppShell>
    </NextIntlClientProvider>
  );
}
