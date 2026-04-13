import './globals.css';
import { headers } from 'next/headers';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const locale = headersList.get('x-next-intl-locale') ?? 'en';
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
