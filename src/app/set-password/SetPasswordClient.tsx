'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export default function SetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isNewSignup, setIsNewSignup] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation matching server requirements
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError('Password must contain at least one lowercase letter');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number');
      return;
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
      setError('Password must contain at least one special character (!@#$%^&* etc.)');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'An error occurred');
        return;
      }

      setIsSuccess(true);
      setIsNewSignup(data.isNewSignup || false);

      // Redirect to login after a delay
      setTimeout(() => {
        router.push(data.isNewSignup ? '/pending' : '/login');
      }, 3000);
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // No token provided
  if (!token) {
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
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Invalid Link</h2>
            <p className="text-gray-600 mb-6">
              This verification link is invalid or missing. Please check your email for the correct link.
            </p>
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

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Image
            src="/ripple-logo.png"
            alt="RippleVMS"
            width={150}
            height={124}
            className="mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Set Your Password
          </h1>
          <p className="text-gray-600">
            Create a secure password to complete your account setup
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          {isSuccess ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                {isNewSignup ? 'Email Verified!' : 'Password Set!'}
              </h2>
              {isNewSignup ? (
                <>
                  <p className="text-gray-600 mb-4">
                    Your email has been verified and password set successfully.
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                    <h3 className="font-semibold text-blue-800 mb-1">What happens next?</h3>
                    <p className="text-sm text-blue-700">
                      Our team will review your application and notify you once approved.
                      You&apos;ll receive a welcome email when your account is ready.
                    </p>
                  </div>
                  <p className="text-sm text-gray-500 mt-4">
                    Redirecting to application status page...
                  </p>
                </>
              ) : (
                <p className="text-gray-600">
                  Redirecting you to login...
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div role="alert" id="password-error" className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span aria-hidden="true">*</span>
                  <span className="sr-only">(required)</span>
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  aria-required="true"
                  aria-invalid={error?.includes('Password') ? true : undefined}
                  aria-describedby={error ? 'password-error password-hint' : 'password-hint'}
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-colors"
                  placeholder="Create a strong password"
                />
                <div id="password-hint" className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-medium text-gray-700 mb-1.5">Password requirements:</p>
                  <ul className="text-xs text-gray-600 space-y-0.5">
                    <li className="flex items-start gap-1.5">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span>At least 8 characters long</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span>At least one uppercase letter (A-Z)</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span>At least one lowercase letter (a-z)</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span>At least one number (0-9)</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span>At least one special character (!@#$%^&* etc.)</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password <span aria-hidden="true">*</span>
                  <span className="sr-only">(required)</span>
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  aria-required="true"
                  aria-invalid={error?.includes('match') ? true : undefined}
                  aria-describedby={error?.includes('match') ? 'password-error' : undefined}
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-colors"
                  placeholder="Confirm your password"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                    Setting Password...
                  </>
                ) : (
                  'Set Password'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
