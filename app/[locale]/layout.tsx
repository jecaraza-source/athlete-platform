import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

export const metadata: Metadata = {
  title: 'AO Deportes',
  description: 'Plataforma de gestión y desarrollo de atletas — AO Deportes',
  openGraph: {
    title: 'AO Deportes',
    description: 'Plataforma de gestión y desarrollo de atletas',
    url: 'https://aodeporte.com',
    siteName: 'AO Deportes',
    locale: 'es_MX',
    type: 'website',
  },
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
      {children}
    </NextIntlClientProvider>
  );
}
