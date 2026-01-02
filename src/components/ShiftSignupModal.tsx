'use client';

import { useState, useEffect, useMemo } from 'react';

interface QualifiedRole {
  id: string;
  name: string;
  slug: string;
  color: string;
  description: string | null;
}

interface RoleRequirement {
  id: string;
  minRequired: number;
  maxAllowed: number | null;
  qualifiedRole: QualifiedRole;
}

interface ShiftVolunteer {
  id: string;
  userId: string;
  status: 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'NO_SHOW';
  qualification: string | null;
  qualifiedRoleId: string | null;
  isZoneLead: boolean;
  user: {
    id: string;
    name: string;
  };
  qualifiedRole?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

interface ShiftDetails {
  id: string;
  title: string;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  zone: { id: string; name: string } | null;
  typeConfig: {
    id: string;
    name: string;
    slug: string;
    color: string;
    qualifiedRoleRequirements?: RoleRequirement[];
  } | null;
  minVolunteers: number;
  maxVolunteers: number;
  confirmedCount: number;
  spotsLeft: number;
  volunteers: ShiftVolunteer[];
  userRsvpStatus: string | null;
  userRsvpId: string | null;
  userQualifications: string[]; // User's qualification slugs from API
}

interface ShiftSignupModalProps {
  shiftId: string;
  currentUserId: string;
  onClose: () => void;
  onUpdate: () => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ShiftSignupModal({
  shiftId,
  currentUserId,
  onClose,
  onUpdate,
}: ShiftSignupModalProps) {
  const [shift, setShift] = useState<ShiftDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch shift details
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/shifts/${shiftId}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to load shift');
        }
        const shiftData = await res.json();
        setShift(shiftData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load shift');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [shiftId]);

  // Calculate available roles for signup
  const availableRoles = useMemo(() => {
    if (!shift) return [];

    const roleRequirements = shift.typeConfig?.qualifiedRoleRequirements || [];
    const userQuals = shift.userQualifications || [];
    const confirmedVolunteers = shift.volunteers.filter(v => v.status === 'CONFIRMED');

    // For each role requirement, check if user qualifies and slots are available
    return roleRequirements
      .map(req => {
        const role = req.qualifiedRole;
        // Count how many volunteers are signed up for this specific role
        const filledCount = confirmedVolunteers.filter(
          v => v.qualifiedRoleId === role.id
        ).length;

        // Check if user has this qualification
        const userHasQual = userQuals.includes(role.slug);

        // Check if there are spots available (maxAllowed null means unlimited)
        const spotsAvailable = req.maxAllowed === null || filledCount < req.maxAllowed;

        return {
          role,
          requirement: req,
          filledCount,
          spotsAvailable,
          userQualified: userHasQual,
          canSignUp: userHasQual && spotsAvailable,
        };
      })
      .filter(r => r.canSignUp); // Only show roles user can sign up for
  }, [shift]);

  // Handle signup for a specific role
  const handleSignup = async (qualifiedRoleId?: string) => {
    if (!shift) return;
    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/shifts/${shiftId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qualifiedRoleId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to sign up');
      }

      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle cancel
  const handleCancel = async () => {
    if (!shift) return;
    if (!confirm('Are you sure you want to cancel your signup?')) return;

    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/shifts/${shiftId}/rsvp`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel');
      }

      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setActionLoading(false);
    }
  };

  // Compute user's signup state
  const isSignedUp = shift?.userRsvpStatus != null;
  const isFull = shift && shift.spotsLeft <= 0;
  const isPending = shift?.userRsvpStatus === 'PENDING';
  const isConfirmed = shift?.userRsvpStatus === 'CONFIRMED';
  const userVolunteer = shift?.volunteers.find(v => v.userId === currentUserId);

  // Check if user can sign up (has role requirements and not already signed up)
  const hasRoleRequirements = (shift?.typeConfig?.qualifiedRoleRequirements?.length || 0) > 0;
  const canSignUpForRole = !isSignedUp && shift?.status === 'PUBLISHED' && availableRoles.length > 0;

  // For shifts without role requirements, allow generic signup if not full
  const canSignUpGeneric = !isSignedUp && !isFull && shift?.status === 'PUBLISHED' && !hasRoleRequirements;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-gray-500 mt-4 text-center">Loading shift details...</p>
        </div>
      </div>
    );
  }

  if (error && !shift) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={onClose}
            className="w-full py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!shift) return null;

  // Separate volunteers by status
  const confirmedVolunteers = shift.volunteers.filter(v => v.status === 'CONFIRMED');
  const pendingVolunteers = shift.volunteers.filter(v => v.status === 'PENDING');

  // Get role status summary for display
  const roleRequirements = shift.typeConfig?.qualifiedRoleRequirements || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-600">{formatDate(shift.date)}</p>
              <p className="text-sm text-gray-600">
                {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
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

        {/* Shift Info */}
        <div className="px-6 py-3 bg-cyan-50 border-b border-cyan-100">
          <h2 className="text-lg font-semibold text-gray-900">{shift.title}</h2>
          <div className="flex items-center gap-2 mt-1">
            {shift.zone && (
              <span className="text-sm text-gray-600">{shift.zone.name}</span>
            )}
            {shift.typeConfig && (
              <span
                className="px-2 py-0.5 text-xs font-medium rounded-full"
                style={{
                  backgroundColor: shift.typeConfig.color + '20',
                  color: shift.typeConfig.color,
                }}
              >
                {shift.typeConfig.name}
              </span>
            )}
          </div>
          {shift.description && (
            <p className="text-sm text-gray-600 mt-2">{shift.description}</p>
          )}
        </div>

        {/* Role Status Overview (if shift has role requirements) */}
        {roleRequirements.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className={`grid grid-cols-${Math.min(roleRequirements.length, 3)} gap-4 text-center`}>
              {roleRequirements.map(req => {
                const filledCount = confirmedVolunteers.filter(
                  v => v.qualifiedRoleId === req.qualifiedRole.id
                ).length;
                const isFilled = req.maxAllowed !== null && filledCount >= req.maxAllowed;
                const needsMore = filledCount < req.minRequired;

                return (
                  <div key={req.id}>
                    <div
                      className="text-2xl font-bold"
                      style={{ color: req.qualifiedRole.color }}
                    >
                      {filledCount}
                      {req.maxAllowed !== null && `/${req.maxAllowed}`}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{req.qualifiedRole.name}</div>
                    <div className={`text-xs mt-0.5 ${isFilled ? 'text-green-600' : needsMore ? 'text-red-500' : 'text-yellow-600'}`}>
                      {isFilled ? 'Full' : needsMore ? `Need ${req.minRequired - filledCount} more` : 'Open'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Generic Status Overview (if no role requirements) */}
        {!hasRoleRequirements && (
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {shift.confirmedCount}
                </div>
                <div className="text-xs text-gray-500">Confirmed</div>
              </div>
              <div>
                <div
                  className={`text-2xl font-bold ${
                    shift.spotsLeft > 0 ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {shift.spotsLeft}
                </div>
                <div className="text-xs text-gray-500">Spots Left</div>
              </div>
            </div>
          </div>
        )}

        {/* Current Signups */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Currently Signed Up</h3>
          {shift.volunteers.length === 0 ? (
            <p className="text-sm text-gray-500">No signups yet. Be the first!</p>
          ) : (
            <div className="space-y-2">
              {confirmedVolunteers.map(volunteer => (
                <div
                  key={volunteer.id}
                  className={`flex items-center gap-2 text-sm ${
                    volunteer.userId === currentUserId
                      ? 'font-medium text-cyan-700'
                      : 'text-gray-700'
                  }`}
                >
                  <span>
                    {volunteer.user.name}
                    {volunteer.userId === currentUserId && ' (You)'}
                  </span>
                  {volunteer.qualifiedRole && (
                    <span
                      className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: volunteer.qualifiedRole.color + '20',
                        color: volunteer.qualifiedRole.color,
                      }}
                    >
                      {volunteer.qualifiedRole.name}
                    </span>
                  )}
                  {volunteer.isZoneLead && !volunteer.qualifiedRole && (
                    <span className="ml-auto text-xs text-amber-600 font-medium">Zone Lead</span>
                  )}
                </div>
              ))}
              {pendingVolunteers.length > 0 && (
                <>
                  <div className="text-xs text-gray-400 mt-3 mb-1">Pending Confirmation</div>
                  {pendingVolunteers.map(volunteer => (
                    <div
                      key={volunteer.id}
                      className={`flex items-center gap-2 text-sm opacity-60 ${
                        volunteer.userId === currentUserId
                          ? 'font-medium text-cyan-700'
                          : 'text-gray-700'
                      }`}
                    >
                      <span className="text-lg">⏳</span>
                      <span>
                        {volunteer.user.name}
                        {volunteer.userId === currentUserId && ' (You)'}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Error Message */}
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
                {isConfirmed ? (
                  <>
                    You&apos;re confirmed for this shift
                    {userVolunteer?.qualifiedRole && (
                      <span
                        className="ml-1 px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: userVolunteer.qualifiedRole.color + '20',
                          color: userVolunteer.qualifiedRole.color,
                        }}
                      >
                        as {userVolunteer.qualifiedRole.name}
                      </span>
                    )}
                  </>
                ) : isPending ? (
                  'Your signup is pending confirmation'
                ) : (
                  `Status: ${shift.userRsvpStatus}`
                )}
              </div>
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="w-full py-2.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium disabled:opacity-50"
              >
                {actionLoading ? 'Cancelling...' : 'Cancel My Signup'}
              </button>
            </>
          ) : canSignUpForRole ? (
            <>
              {/* Role-specific signup buttons */}
              {availableRoles.map(({ role, requirement }) => {
                const filledCount = confirmedVolunteers.filter(
                  v => v.qualifiedRoleId === role.id
                ).length;
                const spotsText = requirement.maxAllowed !== null
                  ? `${requirement.maxAllowed - filledCount} spot${requirement.maxAllowed - filledCount !== 1 ? 's' : ''} left`
                  : 'Open';

                return (
                  <button
                    key={role.id}
                    onClick={() => handleSignup(role.id)}
                    disabled={actionLoading}
                    className="w-full py-2.5 text-white rounded-lg transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ backgroundColor: role.color }}
                  >
                    {actionLoading ? 'Signing up...' : `Sign Up as ${role.name}`}
                    <span className="text-xs opacity-80">({spotsText})</span>
                  </button>
                );
              })}
            </>
          ) : canSignUpGeneric ? (
            <button
              onClick={() => handleSignup()}
              disabled={actionLoading}
              className="w-full py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium disabled:opacity-50"
            >
              {actionLoading ? 'Signing up...' : 'Sign Up for this Shift'}
            </button>
          ) : (
            <div className="text-center text-sm text-gray-500 py-2">
              {shift.status !== 'PUBLISHED' ? (
                'This shift is not open for signups'
              ) : isFull && !hasRoleRequirements ? (
                'This shift is full'
              ) : hasRoleRequirements && availableRoles.length === 0 ? (
                shift.userQualifications?.length === 0 ? (
                  'You need qualifications to sign up for this shift'
                ) : (
                  'All positions you are qualified for are filled'
                )
              ) : (
                'Unable to sign up for this shift'
              )}
            </div>
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
