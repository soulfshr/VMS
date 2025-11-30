'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DEV_USERS, type DevUser, type UserRole } from '@/types/auth';

const roleColors: Record<UserRole, { bg: string; text: string; border: string }> = {
  ADMINISTRATOR: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200 hover:border-purple-400' },
  COORDINATOR: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200 hover:border-blue-400' },
  DISPATCHER: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200 hover:border-orange-400' },
  VOLUNTEER: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200 hover:border-green-400' },
};

const roleDescriptions: Record<UserRole, string> = {
  ADMINISTRATOR: 'Full system access - manage users, zones, settings, and all features',
  COORDINATOR: 'Manage shifts, volunteers, and zone operations',
  DISPATCHER: 'Handle incident reports and coordinate field responses',
  VOLUNTEER: 'Sign up for shifts, view assignments, and report incidents',
};

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Group users by role
  const usersByRole = DEV_USERS.reduce((acc, user) => {
    if (!acc[user.role]) {
      acc[user.role] = [];
    }
    acc[user.role].push(user);
    return acc;
  }, {} as Record<UserRole, DevUser[]>);

  const handleLogin = async (userId: string) => {
    setIsLoading(userId);
    setError(null);

    try {
      const response = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      router.push('/dashboard');
    } catch {
      setError('Login failed. Please try again.');
      setIsLoading(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-10">
          <Image
            src="/siembra-logo.webp"
            alt="Siembra NC"
            width={80}
            height={80}
            className="mx-auto rounded-xl shadow-sm mb-4"
          />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Development Login
          </h1>
          <p className="text-gray-600">
            Select a test user to log in and explore the system
          </p>
        </div>

        {/* Development Mode Notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
          <div className="flex items-start gap-3">
            <span className="text-yellow-600 text-xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-yellow-800">Development Mode</h3>
              <p className="text-sm text-yellow-700">
                This is a simplified login for testing purposes. In production, users will authenticate via email/password or OAuth.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 text-red-700">
            {error}
          </div>
        )}

        {/* User Selection by Role */}
        <div className="space-y-8">
          {(['ADMINISTRATOR', 'COORDINATOR', 'DISPATCHER', 'VOLUNTEER'] as UserRole[]).map((role) => (
            <div key={role}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className={`text-lg font-semibold ${roleColors[role].text}`}>
                  {role.charAt(0) + role.slice(1).toLowerCase()}
                </h2>
                <span className="text-sm text-gray-500">
                  — {roleDescriptions[role]}
                </span>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {usersByRole[role]?.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleLogin(user.id)}
                    disabled={isLoading !== null}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${roleColors[role].border} ${roleColors[role].bg} hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white ${
                        role === 'ADMINISTRATOR' ? 'bg-purple-600' :
                        role === 'COORDINATOR' ? 'bg-blue-600' :
                        role === 'DISPATCHER' ? 'bg-orange-600' :
                        'bg-green-600'
                      }`}>
                        {user.name.charAt(0)}
                      </div>

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {user.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {user.email}
                        </p>
                        {user.zone && (
                          <p className="text-xs text-gray-500">
                            Zone: {user.zone}
                          </p>
                        )}
                      </div>

                      {/* Loading indicator */}
                      {isLoading === user.id && (
                        <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Reference */}
        <div className="mt-12 bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Quick Reference: Role Capabilities</h3>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-purple-700">Administrator:</span>
              <span className="text-gray-600"> Full access to all features, user management, system settings</span>
            </div>
            <div>
              <span className="font-medium text-blue-700">Coordinator:</span>
              <span className="text-gray-600"> Create shifts, manage volunteers, view all zone activities</span>
            </div>
            <div>
              <span className="font-medium text-orange-700">Dispatcher:</span>
              <span className="text-gray-600"> Receive reports, dispatch field teams, manage incidents</span>
            </div>
            <div>
              <span className="font-medium text-green-700">Volunteer:</span>
              <span className="text-gray-600"> View/RSVP shifts, update availability, submit sighting reports</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
