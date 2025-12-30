'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { signIn } from 'next-auth/react';

export default function LoginClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const error = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(
    error === 'CredentialsSignin' ? 'Invalid email or password' : null
  );

  // Invite code for new signups
  const [inviteCode, setInviteCode] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError(null);

    try {
      const result = await signIn('credentials', {
        email: email.toLowerCase().trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setLoginError('Invalid email or password');
        setIsLoading(false);
        return;
      }

      // Use full page navigation instead of client-side routing
      // This ensures middleware runs and can redirect PENDING/REJECTED users
      window.location.href = callbackUrl;
    } catch {
      setLoginError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const handleInviteCodeSubmit = async () => {
    setInviteError(null);

    const trimmed = inviteCode.trim();
    if (!trimmed) {
      setInviteError('Please enter an invite code');
      return;
    }

    if (trimmed.length < 3 || trimmed.length > 20) {
      setInviteError('Invite code must be 3-20 characters');
      return;
    }

    // Navigate to signup page with the code
    router.push(`/signup?code=${encodeURIComponent(trimmed)}`);
  };

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
            Welcome Back
          </h1>
          <p className="text-gray-600">
            Sign in to your volunteer account
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {loginError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {loginError}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-cyan-600 hover:text-cyan-700"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-colors"
                placeholder="Enter your password"
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
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* New Volunteer Signup with Invite Code */}
        <div className="mt-8 bg-gradient-to-br from-purple-50 to-cyan-50 rounded-xl border border-purple-200 p-6">
          <div className="text-center mb-5">
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">New volunteer?</h2>
            <p className="text-sm text-gray-600 mt-1">
              Enter your invite code to create an account
            </p>
          </div>

          {inviteError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
              {inviteError}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleInviteCodeSubmit();
                }
              }}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors bg-white"
              placeholder="Enter invite code"
              maxLength={20}
            />
            <button
              onClick={handleInviteCodeSubmit}
              className="px-6 py-2.5 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors"
            >
              Sign Up
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">
            Don&apos;t have an invite code? Contact your organization coordinator.
          </p>
        </div>
      </div>
    </div>
  );
}
