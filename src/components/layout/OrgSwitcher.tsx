'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

interface OrgMembership {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  role: string;
  accountStatus: string;
}

interface OrgSwitcherProps {
  currentOrgName?: string | null;
  onOrgSwitch?: () => void;
}

export default function OrgSwitcher({ currentOrgName, onOrgSwitch }: OrgSwitcherProps) {
  const { data: session, update } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const memberships = (session?.user?.memberships || []) as OrgMembership[];
  const approvedMemberships = memberships.filter(m => m.accountStatus === 'APPROVED');
  const currentOrgId = session?.user?.currentOrgId;
  const currentOrg = approvedMemberships.find(m => m.organizationId === currentOrgId);
  const displayName = currentOrgName || currentOrg?.organizationName;

  // If user has only 1 org (or no org), show org name without dropdown
  if (approvedMemberships.length <= 1) {
    // Always show the badge - even if no org is selected
    const badgeName = displayName || 'No Organization';
    const hasOrg = !!displayName;
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border ${
        hasOrg ? 'bg-cyan-50 border-cyan-200' : 'bg-gray-50 border-gray-200'
      }`}>
        <svg className={`w-4 h-4 ${hasOrg ? 'text-cyan-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <span className={`font-medium max-w-[150px] truncate ${hasOrg ? 'text-cyan-700' : 'text-gray-500 italic'}`}>{badgeName}</span>
      </div>
    );
  }

  const handleSwitch = async (orgId: string) => {
    if (orgId === currentOrgId) {
      setIsOpen(false);
      return;
    }

    setSwitching(orgId);
    setError(null);

    try {
      const response = await fetch('/api/auth/set-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to switch organization');
      }

      // Update the session
      await update();

      // Close dropdown and notify parent
      setIsOpen(false);
      onOrgSwitch?.();

      // Get the selected org's slug
      const selectedOrg = approvedMemberships.find(m => m.organizationId === orgId);
      if (!selectedOrg) {
        // Fallback to reload if we can't find the org
        window.location.reload();
        return;
      }

      // Build the redirect URL based on environment
      const hostname = window.location.hostname;
      const currentPath = window.location.pathname + window.location.search;

      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        // On localhost, just reload since subdomains don't work locally
        window.location.reload();
      } else {
        // Determine if we're in dev or production environment
        const isDevEnvironment = hostname.includes('.dev.');
        const baseDomain = isDevEnvironment ? 'dev.ripple-vms.com' : 'ripple-vms.com';
        const protocol = window.location.protocol;

        // Redirect to the new org's subdomain
        const newUrl = `${protocol}//${selectedOrg.organizationSlug}.${baseDomain}${currentPath}`;
        window.location.href = newUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setSwitching(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cyan-50 hover:bg-cyan-100 rounded-lg border border-cyan-200 transition-colors"
      >
        <svg className="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <span className="font-medium text-cyan-700 max-w-[120px] truncate">{displayName || 'Select Organization'}</span>
        <svg
          className={`w-4 h-4 text-cyan-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Switch Organization</p>
            </div>

            {error && (
              <div className="px-4 py-2 text-sm text-red-600 bg-red-50">
                {error}
              </div>
            )}

            <div className="max-h-64 overflow-y-auto">
              {approvedMemberships.map((m) => (
                <button
                  key={m.organizationId}
                  onClick={() => handleSwitch(m.organizationId)}
                  disabled={switching !== null}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors disabled:opacity-50 ${
                    m.organizationId === currentOrgId ? 'bg-cyan-50' : ''
                  }`}
                >
                  <div>
                    <div className="font-medium text-gray-900">{m.organizationName}</div>
                    <div className="text-xs text-gray-500 capitalize">{m.role.toLowerCase()}</div>
                  </div>
                  {switching === m.organizationId ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-600" />
                  ) : m.organizationId === currentOrgId ? (
                    <svg className="w-5 h-5 text-cyan-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
