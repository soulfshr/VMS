'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles: string[]; // Empty means all roles
}

const settingsNavItems: NavItem[] = [
  {
    href: '/settings/profile',
    label: 'My Profile',
    icon: '👤',
    roles: [], // All users
  },
  // DEPRECATED: Scheduling, Organization, and Features settings have been consolidated to /admin/settings
  // These pages still exist for backward compatibility but are hidden from navigation
  // Uncomment to restore to navigation:
  // {
  //   href: '/settings/scheduling',
  //   label: 'Scheduling',
  //   icon: '📅',
  //   roles: ['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'],
  // },
  // {
  //   href: '/settings/organization',
  //   label: 'Organization',
  //   icon: '🏢',
  //   roles: ['ADMINISTRATOR', 'DEVELOPER'],
  // },
  // {
  //   href: '/settings/features',
  //   label: 'Features',
  //   icon: '🚀',
  //   roles: ['ADMINISTRATOR', 'DEVELOPER'],
  // },
  {
    href: '/settings/system',
    label: 'System',
    icon: '⚙️',
    roles: ['DEVELOPER'],
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
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

  // Filter nav items based on user role
  const visibleNavItems = settingsNavItems.filter(item =>
    item.roles.length === 0 || item.roles.includes(user.role)
  );

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your account and organization preferences</p>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar - Desktop */}
          <aside className="hidden md:block w-56 shrink-0">
            <nav className="bg-white rounded-xl border border-gray-200 p-2 sticky top-24">
              {visibleNavItems.map(item => {
                const isActive = pathname === item.href ||
                  (item.href !== '/settings' && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-cyan-50 text-cyan-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <span className="text-base">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Mobile Navigation */}
          <div className="md:hidden">
            <div className="bg-white rounded-xl border border-gray-200 p-1 flex gap-1 overflow-x-auto">
              {visibleNavItems.map(item => {
                const isActive = pathname === item.href ||
                  (item.href !== '/settings' && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-cyan-50 text-cyan-700'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            <div className="bg-white rounded-xl border border-gray-200">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
