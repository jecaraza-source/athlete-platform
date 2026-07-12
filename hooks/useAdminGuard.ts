'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type AdminRole = 'super_admin' | 'admin' | 'program_director' | 'coordinador' | 'logistica' | 'operaciones';

interface AdminGuardState {
  user: { id: string; email: string; full_name: string } | null;
  role: AdminRole | null;
  isLoading: boolean;
}

export function useAdminGuard(): AdminGuardState {
  const router = useRouter();
  const [state, setState] = useState<AdminGuardState>({
    user: null, role: null, isLoading: true,
  });

  useEffect(() => {
    const checkAccess = async () => {
      // Call the server-side API route which uses supabaseAdmin to bypass RLS
      const res = await fetch('/api/admin/me');

      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (!res.ok) {
        router.replace('/unauthorized');
        return;
      }

      const data = await res.json();
      setState({
        user: { id: data.id, email: data.email, full_name: data.full_name },
        role: data.role as AdminRole,
        isLoading: false,
      });
    };

    checkAccess();
  }, [router]);

  return state;
}
