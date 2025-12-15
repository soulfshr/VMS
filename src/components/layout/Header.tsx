'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import HelpButton from '@/components/onboarding/HelpButton';
import { useFeatures } from '@/hooks/useFeatures';

// Environment detection
const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
const isDevEnvironment = vercelEnv !== 'production';
const envLabel = vercelEnv === 'preview' ? 'DEV/PREVIEW' :
                 vercelEnv === 'development' ? 'LOCAL DEV' :
                 process.env.NODE_ENV === 'development' ? 'LOCAL DEV' : null;

export default function Header() {
  const features = useFeatures();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isResourcesOpen, setIsResourcesOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Refs for click-outside detection
  const resourcesRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showWelcome, setShowWelcome] = useState(false);
  const [envMismatch, setEnvMismatch] = useState<'dev-serving-prod' | 'prod-serving-dev' | null>(null);

  // Mark component as mounted after hydration
  useEffect(() => {
    setMounted(true);

    // CRITICAL: Detect environment/URL mismatch
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isDevUrl = hostname.includes('dev-') || hostname.includes('preview') || hostname === 'localhost';
      const isProdUrl = hostname === 'nc.ripple-vms.com' || hostname === 'ripple-vms.com';
      const isProdEnv = vercelEnv === 'production';
      const isDevEnv = vercelEnv === 'preview' || vercelEnv === 'development';

      // Dev URL serving prod data
      if (isDevUrl && isProdEnv) {
        setEnvMismatch('dev-serving-prod');
        console.error('🚨 CRITICAL: Dev URL is serving production environment! This may expose production data.');
      }
      // Prod URL serving dev data
      if (isProdUrl && isDevEnv) {
        setEnvMismatch('prod-serving-dev');
        console.error('🚨 CRITICAL: Production URL is serving dev/preview environment! Users may see test data.');
      }
    }
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resourcesRef.current && !resourcesRef.current.contains(event.target as Node)) {
        setIsResourcesOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const user = session?.user;
  const isLoading = status === 'loading' || !mounted;

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/' });
  };

  const isActive = (path: string) => pathname === path;

  return (
    <>
      {/* CRITICAL: Environment mismatch warning */}
      {envMismatch === 'dev-serving-prod' && (
        <div className="bg-red-600 text-white text-center py-2 text-sm font-bold sticky top-0 z-[60] animate-pulse">
          🚨 CRITICAL: Dev URL is serving PRODUCTION DATA! Contact admin immediately! 🚨
        </div>
      )}
      {envMismatch === 'prod-serving-dev' && (
        <div className="bg-red-600 text-white text-center py-2 text-sm font-bold sticky top-0 z-[60] animate-pulse">
          🚨 CRITICAL: Production URL is serving DEV/TEST DATA! Contact admin immediately! 🚨
        </div>
      )}
      {/* Environment Banner - Only shown in non-production (when no mismatch) */}
      {!envMismatch && isDevEnvironment && envLabel && (
        <div className="bg-orange-500 text-white text-center py-1 text-sm font-bold sticky top-0 z-[60]">
          ⚠️ {envLabel} ENVIRONMENT - NOT PRODUCTION ⚠️
        </div>
      )}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-24">
          {/* Logo - links to dashboard when logged in, home when not */}
          <Link href={user ? "/dashboard" : "/"} className="hover:opacity-90 transition-opacity">
            <Image
              src="/ripple-logo.png"
              alt="RippleVMS"
              width={200}
              height={166}
              style={{ width: '90px', height: '75px' }}
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {isLoading ? (
              <div className="animate-pulse flex gap-4">
                <div className="h-4 w-20 bg-gray-200 rounded" />
                <div className="h-4 w-16 bg-gray-200 rounded" />
              </div>
            ) : user ? (
              <>
                {/* 1. Dashboard */}
                <Link
                  href="/dashboard"
                  className={`text-sm font-medium transition-colors ${
                    isActive('/dashboard')
                      ? 'text-cyan-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Dashboard
                </Link>
                {/* 2. Schedule */}
                <Link
                  href="/schedule"
                  className={`text-sm font-medium transition-colors ${
                    pathname.startsWith('/schedule')
                      ? 'text-cyan-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Schedule
                </Link>
                {/* 3. Shifts */}
                <Link
                  href="/shifts"
                  className={`text-sm font-medium transition-colors ${
                    pathname.startsWith('/shifts')
                      ? 'text-cyan-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Shifts
                </Link>
                {/* 4. Dispatch (role-restricted) */}
                {features.sightings && ['DISPATCHER', 'COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role) && (
                  <Link
                    href="/sightings"
                    className={`text-sm font-medium transition-colors ${
                      pathname.startsWith('/sightings')
                        ? 'text-cyan-700'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Dispatch
                  </Link>
                )}
                {/* 5. Volunteers (role-restricted) */}
                {['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role) && (
                  <Link
                    href="/volunteers"
                    className={`text-sm font-medium transition-colors ${
                      pathname.startsWith('/volunteers')
                        ? 'text-cyan-700'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Volunteers
                  </Link>
                )}
                {/* 6. Coordinator (role-restricted) */}
                {['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR'].includes(user.role) && (
                  <Link
                    href="/coordinator"
                    className={`text-sm font-medium transition-colors ${
                      pathname.startsWith('/coordinator')
                        ? 'text-cyan-700'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Coordinator
                  </Link>
                )}
                {/* 7. Admin (role-restricted) */}
                {['ADMINISTRATOR', 'DEVELOPER'].includes(user.role) && (
                  <Link
                    href="/admin"
                    className={`text-sm font-medium transition-colors ${
                      pathname.startsWith('/admin')
                        ? 'text-cyan-700'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Admin
                  </Link>
                )}
                {/* 8. Resources Dropdown */}
                <div className="relative" ref={resourcesRef}>
                  <button
                    onClick={() => setIsResourcesOpen(!isResourcesOpen)}
                    className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                      pathname.startsWith('/resources')
                        ? 'text-cyan-700'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Resources
                    <svg
                      className={`w-4 h-4 transition-transform ${isResourcesOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isResourcesOpen && (
                    <div className="absolute left-0 mt-2 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      <Link
                        href="/map"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsResourcesOpen(false)}
                      >
                        Map
                      </Link>
                      {features.trainings && (
                        <Link
                          href="/training"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsResourcesOpen(false)}
                        >
                          Training
                        </Link>
                      )}
                      <div className="border-t border-gray-100 my-1" />
                      <Link
                        href="/resources"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsResourcesOpen(false)}
                      >
                        Dispatch Process
                      </Link>
                      <a
                        href="/guide.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsResourcesOpen(false)}
                      >
                        User Guide
                      </a>
                      <a
                        href="https://docs.google.com/presentation/d/1laZwZv-C_Vwuru4kbJzzQcH8HKy4HHYTdQ5r9FNIf_Y/edit?slide=id.p"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsResourcesOpen(false)}
                      >
                        Dispatch Training
                      </a>
                    </div>
                  )}
                </div>
                {/* 9. Settings (icon) */}
                <Link
                  href="/settings"
                  className={`transition-colors ${
                    pathname.startsWith('/settings')
                      ? 'text-cyan-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Settings"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </Link>
                {/* 10. Help Button */}
                <HelpButton
                  userRole={user.role}
                  onRestartWelcome={() => setShowWelcome(true)}
                />
                {/* Developer (role-restricted, shown after help) */}
                {user.role === 'DEVELOPER' && (
                  <Link
                    href="/developer"
                    className={`text-sm font-medium transition-colors ${
                      pathname.startsWith('/developer')
                        ? 'text-purple-700'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Developer
                  </Link>
                )}

                {/* User Menu */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    aria-expanded={isUserMenuOpen}
                    aria-haspopup="menu"
                    aria-label="User menu"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-cyan-600 text-white flex items-center justify-center text-sm font-medium">
                      {user.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{user.name}</span>
                    <svg
                      className={`w-4 h-4 text-gray-500 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-xs text-gray-500">Logged in as</p>
                        <p className="text-sm font-medium text-gray-900">{user.role}</p>
                        {user.zone && (
                          <p className="text-xs text-gray-500">{user.zone}</p>
                        )}
                      </div>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/about"
                  className={`text-sm font-medium transition-colors ${
                    isActive('/about')
                      ? 'text-cyan-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  About
                </Link>
                <Link
                  href="/login"
                  className="px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 transition-colors"
                >
                  Login
                </Link>
              </>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            className="md:hidden p-2 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden py-4 border-t border-gray-200 max-h-[calc(100vh-120px)] overflow-y-auto">
            {user ? (
              <div className="space-y-2">
                <div className="px-2 py-2 bg-gray-100 rounded-lg mb-4">
                  <p className="text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.role} {user.zone && `- ${user.zone}`}</p>
                </div>
                {/* 1. Dashboard */}
                <Link
                  href="/dashboard"
                  className="block px-2 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Dashboard
                </Link>
                {/* 2. Schedule */}
                <Link
                  href="/schedule"
                  className="block px-2 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Schedule
                </Link>
                {/* 3. Shifts */}
                <Link
                  href="/shifts"
                  className="block px-2 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Shifts
                </Link>
                {/* 4. Dispatch (role-restricted) */}
                {features.sightings && ['DISPATCHER', 'COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role) && (
                  <Link
                    href="/sightings"
                    className="block px-2 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Dispatch
                  </Link>
                )}
                {/* 5. Volunteers (role-restricted) */}
                {['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role) && (
                  <Link
                    href="/volunteers"
                    className="block px-2 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Volunteers
                  </Link>
                )}
                {/* 6. Coordinator (role-restricted) */}
                {['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR'].includes(user.role) && (
                  <Link
                    href="/coordinator"
                    className="block px-2 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Coordinator
                  </Link>
                )}
                {/* 7. Admin (role-restricted) */}
                {['ADMINISTRATOR', 'DEVELOPER'].includes(user.role) && (
                  <Link
                    href="/admin"
                    className="block px-2 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Admin
                  </Link>
                )}
                {/* 8. Resources Group */}
                <div className="space-y-1">
                  <p className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">Resources</p>
                  <Link
                    href="/map"
                    className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Map
                  </Link>
                  {features.trainings && (
                    <Link
                      href="/training"
                      className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Training
                    </Link>
                  )}
                  <Link
                    href="/resources"
                    className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Dispatch Process
                  </Link>
                  <a
                    href="/guide.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    User Guide
                  </a>
                  <a
                    href="https://docs.google.com/presentation/d/1laZwZv-C_Vwuru4kbJzzQcH8HKy4HHYTdQ5r9FNIf_Y/edit?slide=id.p"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Dispatch Training
                  </a>
                </div>
                {/* 9. Settings */}
                <Link
                  href="/settings"
                  className="flex items-center gap-2 px-2 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </Link>
                {/* Developer (role-restricted) */}
                {user.role === 'DEVELOPER' && (
                  <Link
                    href="/developer"
                    className="block px-2 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Developer
                  </Link>
                )}
                {/* Logout - with visual separator */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-2 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium"
                  >
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Link
                  href="/about"
                  className="block px-2 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  About
                </Link>
                <Link
                  href="/login"
                  className="block px-2 py-2 bg-cyan-600 text-white text-center rounded-lg hover:bg-cyan-700"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Login
                </Link>
              </div>
            )}
          </nav>
        )}
      </div>
    </header>
    </>
  );
}
