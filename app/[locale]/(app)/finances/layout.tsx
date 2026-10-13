import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';
import { getCurrentUser } from '@/lib/rbac/server';

const FINANCE_ACCESS_EMAIL = 'soporte@aodeporte.com';

export default async function FinancesLayout({
  children,
}: {
  children: ReactNode;
}) {
  const currentUser = await getCurrentUser();
  const email = currentUser?.profile?.email?.trim().toLowerCase();

  if (email !== FINANCE_ACCESS_EMAIL) {
    redirect('/dashboard');
  }

  return children;
}
