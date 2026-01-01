'use client';

import Image from 'next/image';
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

export default function SelectOrgClient() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    // If user already has an org selected, go to dashboard
    if (session?.user?.currentOrgId) {
      router.push('/dashboard');
      return;
    }

    setLoading(false);
  }, [status, session, router]);

  const handleSelectOrg = async (orgId: string) => {
    setSelecting(orgId);
    setError(null);

    try {
      const response = await fetch('/api/auth/set-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to select organization');
      }

      // Update the session to get the new currentOrgId
      await update();

      // Navigate to dashboard
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setSelecting(null);
    }
  };

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    // Manually clear auth cookies before redirect
    const cookieOptions = '; path=/; domain=.ripple-vms.com; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure';
    document.cookie = `__Secure-authjs.session-token=${cookieOptions}`;
    document.cookie = `__Secure-authjs.callback-url=${cookieOptions}`;
    window.location.href = 'https://ripple-vms.com/login';
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  const memberships = (session?.user?.memberships || []) as OrgMembership[];
  const approvedMemberships = memberships.filter(m => m.accountStatus === 'APPROVED');
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

        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Select Your Organization
            </h1>
            <p className="text-gray-600">
              Hi {userName}! Choose which organization you&apos;d like to access.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-6">
              {error}
            </div>
          )}

          {approvedMemberships.length > 0 ? (
            <div className="space-y-3">
              {approvedMemberships.map((m) => (
                <button
                  key={m.organizationId}
                  onClick={() => handleSelectOrg(m.organizationId)}
                  disabled={selecting !== null}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-cyan-400 hover:bg-cyan-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div>
                    <div className="font-medium text-gray-900">{m.organizationName}</div>
                    <div className="text-sm text-gray-500 capitalize">{m.role.toLowerCase()}</div>
                  </div>
                  {selecting === m.organizationId ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-600"></div>
                  ) : (
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                You don&apos;t have any approved organization memberships yet.
              </p>
              <p className="text-sm text-gray-500">
                Please wait for your application to be approved, or contact your organization administrator.
              </p>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
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
