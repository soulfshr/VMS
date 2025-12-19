'use client';

import { useState, useMemo } from 'react';
import type { DevUser } from '@/types/auth';

interface SlotConfig {
  start: number;
  end: number;
  minVols: number;
  needsLead: boolean;
  needsDispatcher: boolean;
}

interface Signup {
  id: string;
  userId: string;
  userName: string;
  roleType: 'DISPATCHER' | 'ZONE_LEAD' | 'VERIFIER';
  status: string;
}

interface ZoneSlot {
  zoneId: string;
  zoneName: string;
  county: string;
  startHour: number;
  endHour: number;
  signups: Signup[];
  config: SlotConfig;
  coverage: 'full' | 'partial' | 'none';
}

interface SlotModalProps {
  date: string;
  allZoneSlots: ZoneSlot[]; // All zones for this time slot
  initialZoneId?: string; // Pre-selected zone ID (from click)
  userPrimaryZoneId?: string | null; // User's primary zone from API
  currentUser: DevUser;
  userQualifications: string[];
  onClose: () => void;
  onUpdate: () => void;
}

function formatTimeLabel(hour: number): string {
  if (hour === 0) return '12:00 AM';
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return '12:00 PM';
  return `${hour - 12}:00 PM`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function getCoverageIndicator(coverage: string) {
  switch (coverage) {
    case 'full':
      return 'bg-green-500';
    case 'partial':
      return 'bg-yellow-500';
    default:
      return 'bg-red-500';
  }
}

export default function SlotModal({
  date,
  allZoneSlots,
  initialZoneId,
  userPrimaryZoneId,
  currentUser,
  userQualifications,
  onClose,
  onUpdate,
}: SlotModalProps) {
  // Find user's primary zone or use initialZoneId or first zone
  const defaultZoneId = useMemo(() => {
    // First priority: explicit initialZoneId (from clicking a specific zone cell)
    if (initialZoneId && allZoneSlots.some(z => z.zoneId === initialZoneId)) {
      return initialZoneId;
    }
    // Second priority: user's primary zone from API (most current)
    if (userPrimaryZoneId && allZoneSlots.some(z => z.zoneId === userPrimaryZoneId)) {
      return userPrimaryZoneId;
    }
    // Third priority: user's zone from session (may be stale)
    if (currentUser.zone) {
      const userZone = allZoneSlots.find(z => z.zoneName === currentUser.zone);
      if (userZone) return userZone.zoneId;
    }
    // Fallback: first zone
    return allZoneSlots[0]?.zoneId || '';
  }, [initialZoneId, userPrimaryZoneId, currentUser.zone, allZoneSlots]);

  const [selectedZoneId, setSelectedZoneId] = useState(defaultZoneId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the currently selected zone's slot data
  const slot = useMemo(() => {
    return allZoneSlots.find(z => z.zoneId === selectedZoneId) || allZoneSlots[0];
  }, [allZoneSlots, selectedZoneId]);

  // Group zones by county for better organization (must be before early return)
  const zonesByCounty = useMemo(() => {
    const grouped = new Map<string, ZoneSlot[]>();
    for (const zone of allZoneSlots) {
      if (!grouped.has(zone.county)) {
        grouped.set(zone.county, []);
      }
      grouped.get(zone.county)!.push(zone);
    }
    return grouped;
  }, [allZoneSlots]);

  // Early return if no slot (after all hooks)
  if (!slot) {
    return null;
  }

  const dispatcher = slot.signups.find(s => s.roleType === 'DISPATCHER');
  const zoneLead = slot.signups.find(s => s.roleType === 'ZONE_LEAD');
  const verifiers = slot.signups.filter(s => s.roleType === 'VERIFIER');

  const userSignup = slot.signups.find(s => s.userId === currentUser.id);
  const isSignedUp = !!userSignup;

  // Check user qualifications
  const isQualifiedDispatcher = userQualifications.includes('DISPATCHER');
  const isQualifiedZoneLead = userQualifications.includes('ZONE_LEAD');
  const isQualifiedVerifier = userQualifications.includes('VERIFIER');

  // Check what the user can sign up for (must have qualification AND slot must be available)
  const canSignUpAsDispatcher = !dispatcher && slot.config.needsDispatcher && !isSignedUp && isQualifiedDispatcher;
  const canSignUpAsZoneLead = !zoneLead && slot.config.needsLead && !isSignedUp && isQualifiedZoneLead;
  const canSignUpAsVerifier = verifiers.length < slot.config.minVols && !isSignedUp && isQualifiedVerifier;

  const handleSignup = async (roleType: 'DISPATCHER' | 'ZONE_LEAD' | 'VERIFIER') => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/coverage/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          zoneId: slot.zoneId,
          startHour: slot.startHour,
          endHour: slot.endHour,
          roleType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to sign up');
      }

      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!userSignup) return;
    if (!confirm('Are you sure you want to cancel your signup?')) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/coverage/signup/${userSignup.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel signup');
      }

      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (roleType: string) => {
    switch (roleType) {
      case 'DISPATCHER':
        return <span className="text-lg">📡</span>;
      case 'ZONE_LEAD':
        return <span className="text-lg">👑</span>;
      case 'DISPATCH_COORDINATOR':
        return <span className="text-lg">🪄</span>;
      default:
        return <span className="text-lg">📋</span>;
    }
  };

  const getRoleLabel = (roleType: string) => {
    switch (roleType) {
      case 'DISPATCHER':
        return 'Dispatcher';
      case 'ZONE_LEAD':
        return 'Zone Lead';
      default:
        return 'Verifier';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header with date/time */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-600">
                {formatDate(date)}
              </p>
              <p className="text-sm text-gray-600">
                {formatTimeLabel(slot.startHour)} - {formatTimeLabel(slot.endHour)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Zone Tabs */}
        {allZoneSlots.length > 1 && (
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex flex-wrap gap-2">
              {Array.from(zonesByCounty.entries()).map(([county, zones]) => (
                <div key={county} className="flex flex-wrap gap-1">
                  {zonesByCounty.size > 1 && (
                    <span className="text-xs text-gray-500 self-center mr-1">{county}:</span>
                  )}
                  {zones.map(zone => {
                    const isSelected = zone.zoneId === selectedZoneId;
                    const isUserZone = zone.zoneName === currentUser.zone;
                    const indicatorColor = getCoverageIndicator(zone.coverage);

                    return (
                      <button
                        key={zone.zoneId}
                        onClick={() => setSelectedZoneId(zone.zoneId)}
                        className={`
                          relative px-3 py-1.5 text-sm rounded-lg transition-all
                          ${isSelected
                            ? 'bg-cyan-600 text-white shadow-sm'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                          }
                          ${isUserZone && !isSelected ? 'ring-2 ring-cyan-200' : ''}
                        `}
                        title={`${zone.zoneName} - ${zone.coverage} coverage${isUserZone ? ' (Your zone)' : ''}`}
                      >
                        <span className="flex items-center gap-1.5">
                          {zone.zoneName}
                          {/* Coverage indicator dot */}
                          <span
                            className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white/80' : indicatorColor}`}
                          />
                        </span>
                        {/* User's zone indicator */}
                        {isUserZone && !isSelected && (
                          <span className="absolute -top-1 -right-1 text-[10px]">*</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span> Full
              </span>
              <span className="inline-flex items-center gap-1 ml-3">
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Partial
              </span>
              <span className="inline-flex items-center gap-1 ml-3">
                <span className="w-2 h-2 rounded-full bg-red-500"></span> Gap
              </span>
              {currentUser.zone && (
                <span className="ml-3">* Your zone</span>
              )}
            </p>
          </div>
        )}

        {/* Selected Zone Header */}
        <div className="px-6 py-3 bg-cyan-50 border-b border-cyan-100">
          <h2 className="text-lg font-semibold text-gray-900">{slot.zoneName}</h2>
          <p className="text-sm text-gray-600">{slot.county}</p>
        </div>

        {/* Status overview */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg">{getRoleIcon('DISPATCHER')}</div>
              <div className="text-xs text-gray-500 mt-1">Dispatcher</div>
              <div className={`text-sm font-medium ${dispatcher ? 'text-green-600' : 'text-red-500'}`}>
                {dispatcher ? dispatcher.userName.split(' ')[0] : 'OPEN'}
              </div>
            </div>
            <div>
              <div className="text-lg">{getRoleIcon('ZONE_LEAD')}</div>
              <div className="text-xs text-gray-500 mt-1">Zone Lead</div>
              <div className={`text-sm font-medium ${zoneLead ? 'text-green-600' : 'text-red-500'}`}>
                {zoneLead ? zoneLead.userName.split(' ')[0] : 'OPEN'}
              </div>
            </div>
            <div>
              <div className="text-lg">{getRoleIcon('VERIFIER')}</div>
              <div className="text-xs text-gray-500 mt-1">Verifiers</div>
              <div className={`text-sm font-medium ${verifiers.length >= slot.config.minVols ? 'text-green-600' : 'text-yellow-600'}`}>
                {verifiers.length} of {slot.config.minVols}
              </div>
            </div>
          </div>
        </div>

        {/* Current signups */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Currently Signed Up</h3>
          {slot.signups.length === 0 ? (
            <p className="text-sm text-gray-500">No signups yet. Be the first!</p>
          ) : (
            <div className="space-y-2">
              {slot.signups.map(signup => (
                <div
                  key={signup.id}
                  className={`flex items-center gap-2 text-sm ${
                    signup.userId === currentUser.id ? 'font-medium text-cyan-700' : 'text-gray-700'
                  }`}
                >
                  {getRoleIcon(signup.roleType)}
                  <span>
                    {signup.userName}
                    {signup.userId === currentUser.id && ' (You)'}
                  </span>
                  <span className="text-gray-400 ml-auto">{getRoleLabel(signup.roleType)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-100">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="px-6 py-4 space-y-3">
          {isSignedUp ? (
            <>
              <div className="text-center text-sm text-gray-600 mb-3">
                You&apos;re signed up as <span className="font-medium">{getRoleLabel(userSignup!.roleType)}</span>
              </div>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="w-full py-2.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium disabled:opacity-50"
              >
                {loading ? 'Cancelling...' : 'Cancel My Signup'}
              </button>
            </>
          ) : (
            <>
              {canSignUpAsDispatcher && (
                <button
                  onClick={() => handleSignup('DISPATCHER')}
                  disabled={loading}
                  className="w-full py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {getRoleIcon('DISPATCHER')}
                  {loading ? 'Signing up...' : 'Sign Up as Dispatcher'}
                </button>
              )}
              {canSignUpAsZoneLead && (
                <button
                  onClick={() => handleSignup('ZONE_LEAD')}
                  disabled={loading}
                  className="w-full py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {getRoleIcon('ZONE_LEAD')}
                  {loading ? 'Signing up...' : 'Sign Up as Zone Lead'}
                </button>
              )}
              {canSignUpAsVerifier && (
                <button
                  onClick={() => handleSignup('VERIFIER')}
                  disabled={loading}
                  className="w-full py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {getRoleIcon('VERIFIER')}
                  {loading ? 'Signing up...' : `Sign Up as Verifier (${slot.config.minVols - verifiers.length} spots)`}
                </button>
              )}
              {!canSignUpAsDispatcher && !canSignUpAsZoneLead && !canSignUpAsVerifier && (
                <div className="text-center text-sm text-gray-500 py-2">
                  {userQualifications.length === 0 ? (
                    'You need qualifications to sign up for coverage slots.'
                  ) : (
                    // Check if positions are filled vs user just not qualified
                    (!isQualifiedDispatcher && !isQualifiedZoneLead && !isQualifiedVerifier) ? (
                      'You are not qualified for any available positions.'
                    ) : (
                      'All positions you are qualified for are filled.'
                    )
                  )}
                </div>
              )}
            </>
          )}

          <button
            onClick={onClose}
            className="w-full py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
