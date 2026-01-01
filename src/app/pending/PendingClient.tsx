'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';

interface StatusData {
  accountStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  isVerified: boolean;
  name: string;
  applicationDate: string | null;
  rejectionReason: string | null;
}

export default function PendingClient() {
  const router = useRouter();
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/status')
      .then(res => {
        if (res.status === 401) {
          // Not logged in, redirect to login
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data) {
          // If user is approved, redirect to dashboard
          if (data.accountStatus === 'APPROVED') {
            router.push('/dashboard');
            return;
          }
          setStatus(data);
        }
      })
      .catch(err => {
        console.error('Error fetching status:', err);
        setError('Failed to load application status');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    // Manually clear auth cookies before redirect
    const cookieOptions = '; path=/; domain=.ripple-vms.com; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure';
    document.cookie = `__Secure-authjs.session-token=${cookieOptions}`;
    document.cookie = `__Secure-authjs.callback-url=${cookieOptions}`;
    window.location.href = 'https://ripple-vms.com/login';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-12">
        <div className="container mx-auto px-4 max-w-md">
          <div className="text-center mb-8">
            <Image
              src="/ripple-logo.png"
              alt="RippleVMS"
              width={150}
              height={124}
              className="mx-auto mb-4"
            />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link
              href="/login"
              className="inline-block px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
            >
              Return to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Status: PENDING (email verified)
  if (status?.accountStatus === 'PENDING' && status.isVerified) {
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
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Application Under Review
            </h1>
            <p className="text-gray-600 mb-6">
              Hi {status.name?.split(' ')[0] || 'there'}! Your application has been received and is being reviewed by our team.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left mb-6">
              <h3 className="font-semibold text-blue-800 mb-2">What happens next?</h3>
              <ul className="text-sm text-blue-700 space-y-2">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>A coordinator will review your application</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>You&apos;ll receive an email once approved</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Then you can sign up for shifts and start volunteering!</span>
                </li>
              </ul>
            </div>

            {status.applicationDate && (
              <p className="text-sm text-gray-500 mb-6">
                Application submitted: {new Date(status.applicationDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            )}

            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign out
            </button>
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

  // Status: PENDING (email NOT verified - shouldn't normally see this if not logged in)
  if (status?.accountStatus === 'PENDING' && !status.isVerified) {
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Check Your Email
            </h1>
            <p className="text-gray-600 mb-6">
              Please check your email and click the verification link to set your password and complete your application.
            </p>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
              <p>
                <strong>Didn&apos;t receive the email?</strong> Check your spam folder or{' '}
                <a href="/signup" className="text-cyan-600 hover:text-cyan-700 underline">
                  try signing up again
                </a>.
              </p>
            </div>

            <button
              onClick={handleSignOut}
              className="mt-6 text-sm text-gray-500 hover:text-gray-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Status: REJECTED
  if (status?.accountStatus === 'REJECTED') {
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
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Application Not Approved
            </h1>
            <p className="text-gray-600 mb-6">
              We&apos;re sorry, but your volunteer application was not approved at this time.
            </p>

            {status.rejectionReason && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left mb-6">
                <h3 className="font-semibold text-gray-800 mb-1">Reason:</h3>
                <p className="text-sm text-gray-600">{status.rejectionReason}</p>
              </div>
            )}

            <p className="text-sm text-gray-600 mb-6">
              If you have questions about this decision or believe this was made in error,
              please contact us.
            </p>

            <a
              href="mailto:triangle.dispatch.group@gmail.com"
              className="inline-block px-6 py-2.5 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition-colors"
            >
              Contact Us
            </a>

            <div className="mt-6">
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-md text-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
