'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

const developerNavItems = [
  { href: '/developer', label: 'Overview', icon: '📊' },
  { href: '/developer/organizations', label: 'Organizations', icon: '🏢' },
  { href: '/developer/audit', label: 'Audit Trail', icon: '📋' },
  { href: '/developer/logs', label: 'System Logs', icon: '📜' },
  { href: '/developer/health', label: 'Health Status', icon: '💚' },
  { href: '/developer/global-feature-flags', label: 'Global Flags', icon: '🌐' },
  { href: '/developer/feature-flags', label: 'Org Flags', icon: '🚩' },
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

  // Org selector state
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [currentOrgName, setCurrentOrgName] = useState<string | null>(null);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [isSwitchingOrg, setIsSwitchingOrg] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOrgDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        // Only DEVELOPER role can access the developer console
        if (data.user.role !== 'DEVELOPER') {
          router.push('/dashboard');
          return;
        }
        setUser(data.user);
        setIsLoading(false);

        // Load organizations and current org override
        fetchOrganizations();
        fetchCurrentOrg();
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/developer/organizations');
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data.organizations || []);
      }
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
    }
  };

  const fetchCurrentOrg = async () => {
    try {
      const res = await fetch('/api/developer/set-org');
      if (res.ok) {
        const data = await res.json();
        setCurrentOrgId(data.orgId);
        setCurrentOrgName(data.orgName);
      }
    } catch (err) {
      console.error('Failed to fetch current org:', err);
    }
  };

  const handleOrgSwitch = async (orgId: string) => {
    setIsSwitchingOrg(true);
    setOrgDropdownOpen(false);

    try {
      const res = await fetch('/api/developer/set-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentOrgId(data.orgId);
        setCurrentOrgName(data.orgName);

        // Simply reload - the dev-org-override cookie overrides subdomain detection
        // No need to redirect to a different subdomain
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to switch org:', err);
    } finally {
      setIsSwitchingOrg(false);
    }
  };

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
              <h2 className="text-lg font-semibold text-gray-900 mb-2 px-2">
                Developer Console
              </h2>

              {/* Org Selector */}
              <div className="mb-4 px-2" ref={dropdownRef}>
                <div className="relative">
                  <button
                    onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
                    disabled={isSwitchingOrg}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-sm font-medium text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-50"
                  >
                    <span className="truncate">
                      {isSwitchingOrg ? 'Switching...' : (currentOrgName || 'Select Organization')}
                    </span>
                    <svg className={`w-4 h-4 transition-transform ${orgDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {orgDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {organizations.map(org => (
                        <button
                          key={org.id}
                          onClick={() => handleOrgSwitch(org.id)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                            currentOrgId === org.id ? 'bg-purple-50 text-purple-700' : 'text-gray-700'
                          }`}
                        >
                          {currentOrgId === org.id && (
                            <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                          <span className={currentOrgId === org.id ? '' : 'ml-6'}>{org.name}</span>
                          {!org.isActive && (
                            <span className="ml-auto text-xs text-gray-400">(inactive)</span>
                          )}
                        </button>
                      ))}
                      <div className="border-t border-gray-100" />
                      <button
                        onClick={() => handleOrgSwitch('__none__')}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                          currentOrgId === '__none__' ? 'bg-purple-50 text-purple-700' : 'text-gray-500'
                        }`}
                      >
                        {currentOrgId === '__none__' && (
                          <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                        <span className={currentOrgId === '__none__' ? '' : 'ml-6'}>No Organization (orphaned)</span>
                      </button>
                    </div>
                  )}
                </div>
                {currentOrgId && (
                  <p className="mt-1 text-xs text-gray-500 px-1">
                    Viewing as: {currentOrgName}
                  </p>
                )}
              </div>

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
