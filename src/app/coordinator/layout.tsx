'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { DevUser } from '@/types/auth';

const coordinatorNavItems = [
  { href: '/coordinator', label: 'Overview', icon: '📊' },
  { href: '/shifts', label: 'Shifts', icon: '📅' },
  { href: '/coordinator/email-blast', label: 'Email Blast', icon: '📧' },
];

export default function CoordinatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<DevUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (!data.user) {
          router.push('/login');
          return;
        }
        // Check account status - redirect PENDING/REJECTED to pending page
        if (data.user.accountStatus === 'PENDING' || data.user.accountStatus === 'REJECTED') {
          router.push('/pending');
          return;
        }
        // Coordinators, Dispatchers, and Administrators can access
        if (!['ADMINISTRATOR', 'COORDINATOR', 'DISPATCHER'].includes(data.user.role)) {
          router.push('/dashboard');
          return;
        }
        setUser(data.user);
        setIsLoading(false);
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Mobile Navigation - horizontal tabs */}
        <div className="md:hidden mb-6">
          <nav className="flex gap-2 overflow-x-auto pb-2">
            {coordinatorNavItems.map(item => {
              const isActive = pathname === item.href ||
                (item.href !== '/coordinator' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-cyan-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex gap-8">
          {/* Sidebar - hidden on mobile */}
          <aside className="hidden md:block w-64 shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 px-2">
                Coordinator Console
              </h2>
              <nav className="space-y-1">
                {coordinatorNavItems.map(item => {
                  const isActive = pathname === item.href ||
                    (item.href !== '/coordinator' && pathname?.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-cyan-50 text-cyan-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
