'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';

interface OrgMembership {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  role: string;
  accountStatus: string;
}

export default function RequestAccessClient() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    // If user has current org context, they shouldn't be here
    if (session?.user?.currentOrgId) {
      router.push('/dashboard');
      return;
    }

    setLoading(false);
  }, [status, session, router]);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    // Manually clear auth cookies before redirect
    const cookieOptions = '; path=/; domain=.ripple-vms.com; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure';
    document.cookie = `__Secure-authjs.session-token=${cookieOptions}`;
    document.cookie = `__Secure-authjs.callback-url=${cookieOptions}`;
    window.location.href = 'https://ripple-vms.com/login';
  };

  const handleGoToOrg = async (orgId: string) => {
    // Switch to the selected org via API
    try {
      const response = await fetch('/api/auth/set-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });

      if (response.ok) {
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Failed to switch org:', error);
    }
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  const memberships = session?.user?.memberships as OrgMembership[] | undefined;
  const hasMemberships = memberships && memberships.length > 0;
  const userName = session?.user?.name?.split(' ')[0] || 'there';

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-lg">
        <div className="text-center mb-8">
          <Image
            src="/ripple-logo.png"
            alt="RippleVMS"
            width={150}
            height={124}
            className="mx-auto mb-4"
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm text-center">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            No Access to This Organization
          </h1>
          <p className="text-gray-600 mb-6">
            Hi {userName}! You don&apos;t have access to this organization yet.
          </p>

          {hasMemberships ? (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left mb-6">
                <h3 className="font-semibold text-blue-800 mb-3">Your Organizations</h3>
                <p className="text-sm text-blue-700 mb-3">
                  You are a member of the following organizations:
                </p>
                <div className="space-y-2">
                  {memberships.map((m) => (
                    <button
                      key={m.organizationId}
                      onClick={() => handleGoToOrg(m.organizationSlug)}
                      className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
                    >
                      <div>
                        <div className="font-medium text-gray-900">{m.organizationName}</div>
                        <div className="text-sm text-gray-500 capitalize">{m.role.toLowerCase()}</div>
                      </div>
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="font-medium text-gray-800 mb-2">Want to join this organization?</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Contact the organization administrators to request access, or sign up through their website.
                </p>
                <Link
                  href="/signup"
                  className="inline-block px-6 py-2.5 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition-colors"
                >
                  Sign Up for This Organization
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left mb-6">
                <h3 className="font-semibold text-yellow-800 mb-2">How to get access</h3>
                <ul className="text-sm text-yellow-700 space-y-2">
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Sign up for this organization using the link below</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Wait for a coordinator to approve your application</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Once approved, you&apos;ll have access to this organization</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/signup"
                className="inline-block px-6 py-2.5 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition-colors"
              >
                Sign Up for This Organization
              </Link>
            </>
          )}

          <div className="mt-6">
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Questions? Contact us at{' '}
            <a
              href="mailto:triangle.dispatch.group@gmail.com"
              className="text-cyan-600 hover:text-cyan-700 font-medium"
            >
              triangle.dispatch.group@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
