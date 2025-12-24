'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  organizationId: string | null;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface AllOrg {
  id: string;
  name: string;
  slug: string;
}

export default function OrganizationUsersPage() {
  const params = useParams();
  const orgId = params.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [allOrganizations, setAllOrganizations] = useState<AllOrg[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search for users to add
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Move user modal
  const [movingUser, setMovingUser] = useState<User | null>(null);
  const [targetOrgId, setTargetOrgId] = useState<string>('');

  useEffect(() => {
    fetchUsers();
    fetchAllOrganizations();
  }, [orgId]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/developer/organizations/${orgId}/users`);
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setOrganization(data.organization);
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllOrganizations = async () => {
    try {
      const res = await fetch('/api/developer/organizations');
      if (res.ok) {
        const data = await res.json();
        setAllOrganizations(data.organizations || []);
      }
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Search in orphaned users first
      const res = await fetch(`/api/developer/organizations/__none__/users`);
      if (res.ok) {
        const data = await res.json();
        const query = searchQuery.toLowerCase();
        const filtered = data.users.filter((u: User) =>
          u.name.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query)
        );
        setSearchResults(filtered);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const addUserToOrg = async (userId: string) => {
    try {
      const res = await fetch(`/api/developer/organizations/${orgId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        fetchUsers();
        setSearchQuery('');
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Failed to add user:', err);
    }
  };

  const removeUserFromOrg = async (userId: string) => {
    if (!confirm('Remove this user from the organization? They will become orphaned.')) {
      return;
    }

    try {
      const res = await fetch(`/api/developer/organizations/${orgId}/users`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      console.error('Failed to remove user:', err);
    }
  };

  const moveUserToOrg = async () => {
    if (!movingUser || !targetOrgId) return;

    try {
      const res = await fetch(`/api/developer/organizations/${targetOrgId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: movingUser.id }),
      });

      if (res.ok) {
        fetchUsers();
        setMovingUser(null);
        setTargetOrgId('');
      }
    } catch (err) {
      console.error('Failed to move user:', err);
    }
  };

  const isOrphaned = orgId === '__none__';
  const pageTitle = isOrphaned ? 'Orphaned Users' : `${organization?.name || 'Organization'} - Users`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/developer/organizations"
          className="text-purple-600 hover:text-purple-700 text-sm mb-2 inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Organizations
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
        {organization && (
          <p className="text-gray-600 mt-1">
            {organization.slug}.ripple-vms.com
          </p>
        )}
        {isOrphaned && (
          <p className="text-gray-600 mt-1">
            Users without an organization assignment
          </p>
        )}
      </div>

      {/* Add User Section (only for non-orphaned orgs) */}
      {!isOrphaned && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Add User to Organization</h2>
          <p className="text-sm text-gray-500 mb-3">Search for orphaned users to add to this organization</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
              placeholder="Search by name or email..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            <button
              onClick={searchUsers}
              disabled={isSearching}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-3 border border-gray-200 rounded-lg divide-y">
              {searchResults.map(user => (
                <div key={user.id} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                  <button
                    onClick={() => addUserToOrg(user.id)}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Add to Org
                  </button>
                </div>
              ))}
            </div>
          )}

          {searchQuery && searchResults.length === 0 && !isSearching && (
            <p className="mt-3 text-sm text-gray-500">No orphaned users found matching &quot;{searchQuery}&quot;</p>
          )}
        </div>
      )}

      {/* Users List */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {users.length} User{users.length !== 1 ? 's' : ''}
          </h2>
        </div>

        {users.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {isOrphaned ? 'No orphaned users found' : 'No users in this organization'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {users.map(user => (
              <div key={user.id} className="p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{user.name}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      user.role === 'DEVELOPER' ? 'bg-purple-100 text-purple-700' :
                      user.role === 'ADMINISTRATOR' ? 'bg-red-100 text-red-700' :
                      user.role === 'COORDINATOR' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {user.role}
                    </span>
                    {!user.isActive && (
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Last login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setMovingUser(user);
                      setTargetOrgId('');
                    }}
                    className="px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  >
                    Move
                  </button>
                  {!isOrphaned && (
                    <button
                      onClick={() => removeUserFromOrg(user.id)}
                      className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Move User Modal */}
      {movingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMovingUser(null)}
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Move User
            </h2>
            <p className="text-gray-600 mb-4">
              Move <strong>{movingUser.name}</strong> to a different organization
            </p>

            <select
              value={targetOrgId}
              onChange={(e) => setTargetOrgId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 mb-4"
            >
              <option value="">Select organization...</option>
              {allOrganizations
                .filter(o => o.id !== orgId)
                .map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              {orgId !== '__none__' && (
                <option value="__none__">No Organization (orphan)</option>
              )}
            </select>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setMovingUser(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={moveUserToOrg}
                disabled={!targetOrgId}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Move User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
