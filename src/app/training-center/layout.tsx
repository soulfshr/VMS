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

const trainingCenterNavItems = [
  { href: '/training-center', label: 'Dashboard', icon: '📊' },
  { href: '/training-center/modules', label: 'Modules', icon: '📚' },
];

export default function TrainingCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if this is a learner path (accessible to all users)
  const isLearnerPath = pathname?.startsWith('/training-center/learn');

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
        // Learner paths are accessible to all authenticated users
        // Management paths (dashboard, modules) require DEVELOPER role
        if (!isLearnerPath && data.user.role !== 'DEVELOPER') {
          router.push('/dashboard');
          return;
        }
        setUser(data.user);
        setIsLoading(false);
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router, isLearnerPath]);

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  const isDeveloper = user.role === 'DEVELOPER';

  // Learner paths get a simpler layout without sidebar
  if (isLearnerPath && !isDeveloper) {
    return (
      <div className="min-h-[calc(100vh-200px)] bg-gray-50">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex gap-8">
          {/* Sidebar - only shown to developers */}
          {isDeveloper && (
            <aside className="w-64 shrink-0">
              <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 px-2">
                  Training Center
                </h2>
                <nav className="space-y-1">
                  {trainingCenterNavItems.map(item => {
                    const isActive = pathname === item.href ||
                      (item.href !== '/training-center' && pathname?.startsWith(item.href));
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
                  <Link
                    href="/training-center/learn"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      pathname?.startsWith('/training-center/learn')
                        ? 'bg-purple-50 text-purple-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <span>🎓</span>
                    Learner View
                  </Link>
                </nav>

                <div className="mt-6 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500 px-2">
                    Module management is only available to developers.
                  </p>
                </div>
              </div>
            </aside>
          )}

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
