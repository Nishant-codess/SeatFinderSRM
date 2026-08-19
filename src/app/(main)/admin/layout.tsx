'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { AdminNav } from '@/components/admin/admin-nav';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // isAdmin comes from localStorage (set at login time) — no DynamoDB call needed
  const isAdmin = user?.isAdmin ?? false;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/');
    } else if (!isAdmin) {
      router.replace('/dashboard');
    }
  }, [loading, user, isAdmin, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <AdminNav />
      <main className="flex-1 w-full lg:w-auto overflow-x-hidden">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
