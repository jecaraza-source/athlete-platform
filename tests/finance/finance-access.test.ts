import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { redirectUrl: url });
  }),
}));

vi.mock('@/lib/rbac/server', () => ({
  getCurrentUser: vi.fn(),
}));

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/rbac/server';
import FinancesLayout from '@/app/[locale]/(app)/finances/layout';

async function captureRedirect(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    throw new Error('Expected the finance route to redirect.');
  } catch (error: unknown) {
    const redirectError = error as { message?: string; redirectUrl?: string };
    if (redirectError.message === 'NEXT_REDIRECT' && redirectError.redirectUrl) {
      return redirectError.redirectUrl;
    }
    throw error;
  }
}

describe('Finance route access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects a non-authorized account to the dashboard', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      profile: { email: 'admin@aodeporte.com' },
    } as never);

    const target = await captureRedirect(() =>
      FinancesLayout({ children: 'Finance content' }),
    );

    expect(target).toBe('/dashboard');
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });

  it('allows the authorized support account through the route guard', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      profile: { email: ' SOPORTE@AODEPORTE.COM ' },
    } as never);

    await expect(
      FinancesLayout({ children: 'Finance content' }),
    ).resolves.toBe('Finance content');
    expect(redirect).not.toHaveBeenCalled();
  });
});
