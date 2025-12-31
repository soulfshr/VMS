'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { QualifiedRole, UserZone, UpcomingTraining } from '@/types/dashboard';

// Qualified Roles Card
interface QualifiedRolesCardProps {
  qualifiedRoles: QualifiedRole[];
}

export function QualifiedRolesCard({ qualifiedRoles }: QualifiedRolesCardProps) {
  if (!qualifiedRoles || qualifiedRoles.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">My Qualified Roles</h3>
      </div>
      <div className="p-4">
        <div className="flex flex-wrap gap-2">
          {qualifiedRoles.map((role) => (
            <span
              key={role.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
              style={{
                backgroundColor: `${role.color}20`,
                color: role.color,
                border: `1px solid ${role.color}40`,
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: role.color }}
              />
              {role.name}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          These roles determine which shift positions you can fill.
        </p>
      </div>
    </div>
  );
}

// ICE Sightings Card
interface SightingsCardProps {
  zones: UserZone[];
  sightingCounts: Record<string, number>;
}

export function SightingsCard({ zones, sightingCounts }: SightingsCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (zones.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">🚨</span>
          <h3 className="font-semibold text-gray-900">ICE Sightings Today</h3>
        </div>
        <ChevronIcon expanded={expanded} />
      </button>
      {expanded && (
        <div className="border-t border-gray-200">
          <div className="p-4 space-y-3">
            {zones.map((userZone) => (
              <div key={userZone.zone.id} className="flex justify-between items-center">
                <span className="text-gray-600">{userZone.zone.name}</span>
                <span className={`font-medium ${
                  (sightingCounts[userZone.zone.id] || 0) > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {sightingCounts[userZone.zone.id] || 0} active
                </span>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-gray-200 space-y-2">
            <Link
              href="/report"
              className="w-full py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium inline-block text-center"
            >
              Report New Sighting
            </Link>
            <Link
              href="/sightings"
              className="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium inline-block text-center"
            >
              View All Sightings
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// Upcoming Trainings Card
interface TrainingsCardProps {
  trainings: UpcomingTraining[];
}

export function TrainingsCard({ trainings }: TrainingsCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xl">📚</span>
          <h3 className="font-semibold text-gray-900">Upcoming Trainings</h3>
        </div>
        <Link
          href="/trainings"
          className="text-sm text-cyan-600 hover:text-cyan-700"
        >
          View all →
        </Link>
      </div>
      <div className="divide-y divide-gray-100">
        {trainings.length > 0 ? (
          trainings.map((training) => (
            <Link
              key={training.id}
              href={`/trainings/${training.id}`}
              className="block p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                  style={{ backgroundColor: training.trainingType?.color || '#8b5cf6' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {training.title}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(training.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      timeZone: 'America/New_York'
                    })} • {new Date(training.startTime).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      timeZone: 'America/New_York'
                    })}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-400">
                      {training.currentAttendees}{training.maxAttendees ? `/${training.maxAttendees}` : ''} signed up
                    </span>
                    {training.userRsvp ? (
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        training.userRsvp.status === 'CONFIRMED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {training.userRsvp.status === 'CONFIRMED' ? 'Confirmed' : 'Pending'}
                      </span>
                    ) : (
                      <span className="text-xs text-cyan-600 font-medium">Sign up →</span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="p-4 text-center text-gray-500 text-sm">
            No upcoming trainings scheduled
          </div>
        )}
      </div>
    </div>
  );
}

// Helper: Chevron icon
function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
