'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { DevUser } from '@/types/auth';

const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: '📊', adminOnly: true },
  { href: '/admin/email-blast', label: 'Email Blast', icon: '📧', adminOnly: false },
  { href: '/admin/settings', label: 'General Settings', icon: '⚙️', adminOnly: true },
  { href: '/admin/qualified-roles', label: 'Qualified Roles', icon: '🏅', adminOnly: true },
  { href: '/admin/shift-types', label: 'Shift Types', icon: '📋', adminOnly: true },
  { href: '/admin/training-types', label: 'Training Types', icon: '🎓', adminOnly: true },
  { href: '/admin/mapping', label: 'Mapping', icon: '🗺️', adminOnly: true },
];

export default function AdminLayout({
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
        // Coordinators can access email-blast, but other admin pages require ADMINISTRATOR
        const isEmailBlastPage = pathname?.startsWith('/admin/email-blast');
        const allowedRoles = isEmailBlastPage
          ? ['ADMINISTRATOR', 'COORDINATOR']
          : ['ADMINISTRATOR'];

        if (!allowedRoles.includes(data.user.role)) {
          router.push('/dashboard');
          return;
        }
        setUser(data.user);
        setIsLoading(false);
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-64 shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 px-2">
                Admin Settings
              </h2>
              <nav className="space-y-1">
                {adminNavItems
                  .filter(item => !item.adminOnly || user?.role === 'ADMINISTRATOR')
                  .map(item => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-teal-50 text-teal-700'
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
