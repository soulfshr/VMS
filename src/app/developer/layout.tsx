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

const developerNavItems = [
  { href: '/developer', label: 'Overview', icon: '📊' },
  { href: '/developer/logs', label: 'System Logs', icon: '📜' },
  { href: '/developer/health', label: 'Health Status', icon: '💚' },
  { href: '/developer/feature-flags', label: 'Feature Flags', icon: '🚩' },
  { href: '/developer/knowledge-graph', label: 'Knowledge Graph', icon: '🧠' },
];

export default function DeveloperLayout({
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
        // Only DEVELOPER role can access the developer console
        if (data.user.role !== 'DEVELOPER') {
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
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gray-50">
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-7xl">
        {/* Mobile Navigation - horizontal scrollable tabs */}
        <div className="md:hidden mb-4">
          <div className="bg-white rounded-xl border border-gray-200 p-2 overflow-x-auto">
            <nav className="flex gap-1 min-w-max">
              {developerNavItems.map(item => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span className="hidden xs:inline">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Sidebar - hidden on mobile */}
          <aside className="hidden md:block w-64 shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 px-2">
                Developer Console
              </h2>
              <nav className="space-y-1">
                {developerNavItems.map(item => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-purple-50 text-purple-700'
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
