'use client';

import type { NextShift } from '@/types/dashboard';

interface NextShiftWidgetProps {
  nextShift: NextShift;
  onCancelRsvp?: (shiftId: string) => void;
  cancellingShiftId?: string | null;
}

export function NextShiftWidget({ nextShift, onCancelRsvp, cancellingShiftId }: NextShiftWidgetProps) {
  return (
    <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl border border-cyan-200" data-tour="next-shift">
      <div className="p-4 border-b border-cyan-200/50 flex items-center gap-2">
        <span className="text-xl">📅</span>
        <h2 className="font-semibold text-gray-900">Your Next Shift</h2>
      </div>
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: nextShift.shiftType?.color || '#14b8a6' }}
                />
                <span className="font-semibold text-gray-900 text-lg">
                  {nextShift.shiftType?.name || nextShift.title}
                </span>
                {nextShift.userRole && nextShift.userRole.color && (
                  <span
                    className="px-2 py-0.5 text-xs rounded-full font-medium"
                    style={{
                      backgroundColor: `${nextShift.userRole.color}20`,
                      color: nextShift.userRole.color,
                    }}
                  >
                    {nextShift.userRole.name}
                  </span>
                )}
              </div>
              {onCancelRsvp && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onCancelRsvp(nextShift.id);
                  }}
                  disabled={cancellingShiftId === nextShift.id}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Cancel RSVP"
                >
                  {cancellingShiftId === nextShift.id ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
              )}
            </div>
            <div className="text-gray-600 mb-3">
              <span className="font-medium">
                {new Date(nextShift.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  timeZone: 'America/New_York'
                })}
              </span>
              <span className="mx-2">•</span>
              <span>
                {new Date(nextShift.startTime).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZone: 'America/New_York'
                })} - {new Date(nextShift.endTime).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZone: 'America/New_York'
                })}
              </span>
              {nextShift.zone && (
                <>
                  <span className="mx-2">•</span>
                  <span>{nextShift.zone.name}</span>
                </>
              )}
            </div>

            {/* Teammates Section */}
            {nextShift.teammates.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-500 mb-2">
                  Your teammates ({nextShift.teammates.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {nextShift.teammates.map((teammate) => {
                    const displayName = teammate.name || 'Unknown';
                    return (
                      <div
                        key={teammate.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-full text-sm border border-gray-200"
                      >
                        <span className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                          {displayName.charAt(0)}
                        </span>
                        <span className="text-gray-700">{displayName.split(' ')[0]}</span>
                        {teammate.qualifiedRole && (
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: teammate.qualifiedRole.color }}
                            title={teammate.qualifiedRole.name}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dispatch Support Section */}
            {(nextShift.dispatchCoordinators.length > 0 || nextShift.dispatcher) && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Shift Support</p>
                <div className="space-y-1.5">
                  {nextShift.dispatchCoordinators.length > 0 && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Coordinator{nextShift.dispatchCoordinators.length > 1 ? 's' : ''}:</span>{' '}
                      {nextShift.dispatchCoordinators.map((c, i) => (
                        <span key={c.id}>
                          {i > 0 && ', '}
                          {c.name}
                          {c.isPrimary && <span className="text-amber-500 ml-0.5">★</span>}
                          {c.notes && <span className="text-gray-400 text-xs ml-1">({c.notes})</span>}
                        </span>
                      ))}
                    </p>
                  )}
                  {nextShift.dispatcher && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Dispatcher:</span> {nextShift.dispatcher.name}
                      {nextShift.dispatcher.notes && (
                        <span className="text-gray-400 text-xs ml-1">({nextShift.dispatcher.notes})</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
