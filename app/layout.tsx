import './globals.css';
import { headers } from 'next/headers';
import { SpeedInsights } from '@vercel/speed-insights/next';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const locale = headersList.get('x-next-intl-locale') ?? 'en';
  return (
    <html lang={locale}>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
