'use client';

import { useState, useMemo } from 'react';
import type { DevUser } from '@/types/auth';

interface CoordinatorSlot {
  startHour: number;
  endHour: number;
  coordinator: {
    id: string;
    userId: string;
    userName: string;
    status: string;
  } | null;
}

interface CoordinatorDayCoverage {
  date: string;
  slots: CoordinatorSlot[];
  filledCount: number;
  totalCount: number;
}

interface CoordinatorModalProps {
  weekStart: Date;
  coordinatorCoverage: CoordinatorDayCoverage[];
  timeSlots: Array<{ start: number; end: number }>; // Zone slots (ignored, we use hourly)
  currentUser: DevUser;
  userQualifications: string[];
  onClose: () => void;
  onUpdate: () => void;
}

// Hourly slots from 6am to 6pm (12 slots)
const COORDINATOR_HOURLY_SLOTS = Array.from({ length: 12 }, (_, i) => ({
  start: 6 + i,
  end: 7 + i,
}));

function formatTimeLabel(hour: number): string {
  if (hour === 0) return '12am';
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return '12pm';
  return `${hour - 12}pm`;
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get today's date as YYYY-MM-DD string in user's local timezone
function getTodayLocal(): string {
  return new Date().toLocaleDateString('en-CA'); // 'en-CA' gives YYYY-MM-DD format
}

// Check if a date string (YYYY-MM-DD) is before today
function isDatePast(dateStr: string): boolean {
  return dateStr < getTodayLocal();
}

// Selection key format: "YYYY-MM-DD-HH" (date and start hour)
type SelectionKey = string;

function makeSelectionKey(date: string, startHour: number): SelectionKey {
  return `${date}-${startHour}`;
}

function parseSelectionKey(key: SelectionKey): { date: string; startHour: number } {
  const parts = key.split('-');
  const startHour = parseInt(parts.pop()!, 10);
  const date = parts.join('-');
  return { date, startHour };
}

// Group contiguous slots by date
interface ContiguousBlock {
  date: string;
  startHour: number;
  endHour: number;
}

function groupContiguousSlots(selections: SelectionKey[]): ContiguousBlock[] {
  if (selections.length === 0) return [];

  // Parse all selections
  const parsed = selections.map(parseSelectionKey);

  // Group by date
  const byDate = new Map<string, number[]>();
  for (const { date, startHour } of parsed) {
    if (!byDate.has(date)) {
      byDate.set(date, []);
    }
    byDate.get(date)!.push(startHour);
  }

  // For each date, find contiguous blocks
  const blocks: ContiguousBlock[] = [];

  for (const [date, hours] of byDate.entries()) {
    // Sort hours
    hours.sort((a, b) => a - b);

    let blockStart = hours[0];
    let blockEnd = hours[0] + 1;

    for (let i = 1; i < hours.length; i++) {
      if (hours[i] === blockEnd) {
        // Contiguous, extend the block
        blockEnd = hours[i] + 1;
      } else {
        // Gap found, save current block and start new one
        blocks.push({ date, startHour: blockStart, endHour: blockEnd });
        blockStart = hours[i];
        blockEnd = hours[i] + 1;
      }
    }

    // Save the last block
    blocks.push({ date, startHour: blockStart, endHour: blockEnd });
  }

  // Sort blocks by date, then start hour
  blocks.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startHour - b.startHour;
  });

  return blocks;
}

export default function CoordinatorModal({
  weekStart,
  coordinatorCoverage,
  currentUser,
  userQualifications,
  onClose,
  onUpdate,
}: CoordinatorModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<Set<SelectionKey>>(new Set());

  const isQualifiedCoordinator = userQualifications.includes('DISPATCH_COORDINATOR');

  // Generate week dates
  const weekDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    weekDates.push(date);
  }

  // Build lookup for existing signups from the coordinator coverage data
  // Note: coordinatorCoverage may use 2-hour slots from zone config, so we need to
  // check against hourly slots and see if any signup covers that hour
  const signupLookup = useMemo(() => {
    const lookup = new Map<string, CoordinatorSlot['coordinator'] & { signupId?: string }>();
    for (const day of coordinatorCoverage) {
      for (const slot of day.slots) {
        // For each hour in the slot range, mark it as covered
        for (let hour = slot.startHour; hour < slot.endHour; hour++) {
          const key = makeSelectionKey(day.date, hour);
          if (slot.coordinator) {
            lookup.set(key, { ...slot.coordinator, signupId: slot.coordinator.id });
          }
        }
      }
    }
    return lookup;
  }, [coordinatorCoverage]);

  // Find user's own signups
  const userSignups = useMemo(() => {
    const signups = new Map<string, string>(); // key -> signup id
    for (const day of coordinatorCoverage) {
      for (const slot of day.slots) {
        if (slot.coordinator?.userId === currentUser.id) {
          // Mark each hour in the slot
          for (let hour = slot.startHour; hour < slot.endHour; hour++) {
            const key = makeSelectionKey(day.date, hour);
            signups.set(key, slot.coordinator.id);
          }
        }
      }
    }
    return signups;
  }, [coordinatorCoverage, currentUser.id]);

  // Check if a slot is available for selection
  const isSlotAvailable = (dateStr: string, startHour: number): boolean => {
    const key = makeSelectionKey(dateStr, startHour);
    const coordinator = signupLookup.get(key);

    // Past date check using string comparison
    if (isDatePast(dateStr)) return false;

    // Slot is available if no coordinator assigned
    return !coordinator;
  };

  const toggleSlot = (dateStr: string, startHour: number) => {
    if (!isQualifiedCoordinator) return;

    const key = makeSelectionKey(dateStr, startHour);

    // Can't select filled slots
    if (!isSlotAvailable(dateStr, startHour)) return;

    setSelectedSlots(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const clearSelections = () => {
    setSelectedSlots(new Set());
  };

  // Calculate contiguous blocks for display
  const contiguousBlocks = useMemo(() => {
    return groupContiguousSlots(Array.from(selectedSlots));
  }, [selectedSlots]);

  const handleBatchSignup = async () => {
    if (selectedSlots.size === 0) return;

    setLoading(true);
    setError(null);

    try {
      // Convert selections to array of slots
      const slots = Array.from(selectedSlots).map(key => {
        const { date, startHour } = parseSelectionKey(key);
        return { date, startHour, endHour: startHour + 1 };
      });

      const res = await fetch('/api/coverage/signup/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slots,
          roleType: 'DISPATCH_COORDINATOR',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to sign up');
      }

      setSelectedSlots(new Set());
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (signupId: string) => {
    if (!confirm('Are you sure you want to cancel this coordinator slot?')) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/coverage/signup/${signupId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel signup');
      }

      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats based on hourly slots (future only - today or later)
  const stats = useMemo(() => {
    let totalSlots = 0;
    let filledSlots = 0;

    for (const date of weekDates) {
      const dateStr = formatDateLocal(date);
      // Skip past days using string comparison
      if (isDatePast(dateStr)) continue;

      for (const slot of COORDINATOR_HOURLY_SLOTS) {
        totalSlots++;
        const key = makeSelectionKey(dateStr, slot.start);
        if (signupLookup.has(key)) {
          filledSlots++;
        }
      }
    }

    const coveragePercent = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
    return { totalSlots, filledSlots, coveragePercent };
  }, [weekDates, signupLookup]);

  const { totalSlots, filledSlots, coveragePercent } = stats;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-purple-50">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">&#128081;</span>
                <h2 className="text-lg font-semibold text-gray-900">Dispatch Coordinator Schedule</h2>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Region-wide coordinator coverage (hourly blocks, 6am-6pm)
              </p>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className={`font-medium ${coveragePercent >= 80 ? 'text-green-600' : coveragePercent >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {coveragePercent}% covered
                </span>
                <span className="text-gray-500">
                  {filledSlots}/{totalSlots} slots filled
                </span>
                {totalSlots - filledSlots > 0 && (
                  <span className="text-red-600">
                    {totalSlots - filledSlots} gaps
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-100">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Qualification notice */}
        {!isQualifiedCoordinator && (
          <div className="px-6 py-3 bg-yellow-50 border-b border-yellow-100">
            <p className="text-sm text-yellow-700">
              You need the <strong>Dispatch Coordinator</strong> qualification to sign up for these slots.
            </p>
          </div>
        )}

        {/* Selection summary */}
        {selectedSlots.size > 0 && (
          <div className="px-6 py-3 bg-purple-50 border-b border-purple-100">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm text-purple-800">
                <span className="font-medium">{selectedSlots.size} slot{selectedSlots.size !== 1 ? 's' : ''} selected</span>
                {contiguousBlocks.length > 0 && (
                  <span className="text-purple-600 ml-2">
                    ({contiguousBlocks.length} calendar invite{contiguousBlocks.length !== 1 ? 's' : ''} will be sent)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearSelections}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                >
                  Clear
                </button>
                <button
                  onClick={handleBatchSignup}
                  disabled={loading}
                  className="px-4 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium text-sm"
                >
                  {loading ? 'Signing up...' : `Sign Up for ${selectedSlots.size} Slot${selectedSlots.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
            {/* Show contiguous blocks preview */}
            {contiguousBlocks.length > 0 && (
              <div className="mt-2 text-xs text-purple-700">
                {contiguousBlocks.map((block, i) => (
                  <span key={i}>
                    {i > 0 && ', '}
                    {new Date(block.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {' '}{formatTimeLabel(block.startHour)}-{formatTimeLabel(block.endHour)}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-auto p-4">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="w-[60px] px-2 py-3 text-left text-sm font-medium text-gray-600 border-b border-r border-gray-200 sticky left-0 bg-gray-50 z-10">
                    Time
                  </th>
                  {weekDates.map(date => {
                    const dateStr = formatDateLocal(date);
                    return (
                      <th
                        key={dateStr}
                        className="min-w-[80px] px-2 py-3 text-center text-sm font-medium text-gray-600 border-b border-r border-gray-200"
                      >
                        <div>{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                        <div className="font-normal text-xs">
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {COORDINATOR_HOURLY_SLOTS.map(slot => (
                  <tr key={`${slot.start}-${slot.end}`}>
                    <td className="border-b border-r border-gray-200 px-2 py-2 text-xs text-gray-600 bg-gray-50 font-medium whitespace-nowrap sticky left-0 z-10">
                      {formatTimeLabel(slot.start)}
                    </td>
                    {weekDates.map(date => {
                      const dateStr = formatDateLocal(date);
                      const key = makeSelectionKey(dateStr, slot.start);
                      const coordinator = signupLookup.get(key);
                      const isUserSignup = userSignups.has(key);
                      const signupId = userSignups.get(key);
                      const isSelected = selectedSlots.has(key);

                      // Check if date is in the past using string comparison
                      const isPast = isDatePast(dateStr);

                      // User is signed up for this slot
                      if (isUserSignup && signupId) {
                        return (
                          <td
                            key={dateStr}
                            className="border-b border-r border-gray-200 px-1 py-1 bg-cyan-50"
                          >
                            <div className="text-center">
                              <div className="text-xs font-medium text-cyan-700">
                                You
                              </div>
                              {!isPast && (
                                <button
                                  onClick={() => handleCancel(signupId)}
                                  disabled={loading}
                                  className="text-[10px] text-red-600 hover:text-red-800 underline disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      }

                      // Someone else is signed up
                      if (coordinator) {
                        return (
                          <td
                            key={dateStr}
                            className="border-b border-r border-gray-200 px-1 py-1 bg-green-50"
                          >
                            <div className="text-center">
                              <div className="text-xs font-medium text-green-700 truncate">
                                {coordinator.userName.split(' ')[0]}
                              </div>
                            </div>
                          </td>
                        );
                      }

                      // Slot is open
                      const canSelect = isQualifiedCoordinator && !isPast;
                      return (
                        <td
                          key={dateStr}
                          className={`border-b border-r border-gray-200 px-1 py-1 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-purple-200 border-purple-400'
                              : canSelect
                                ? 'bg-red-50 hover:bg-purple-100'
                                : 'bg-red-50'
                          }`}
                          onClick={() => {
                            if (canSelect && !loading) {
                              toggleSlot(dateStr, slot.start);
                            }
                          }}
                        >
                          <div className="text-center">
                            {isSelected ? (
                              <div className="text-xs font-medium text-purple-700">
                                &#10003;
                              </div>
                            ) : isPast ? (
                              <div className="text-[10px] text-gray-400">
                                Past
                              </div>
                            ) : (
                              <div className="text-[10px] text-red-500">
                                OPEN
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs text-gray-600 flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-green-50 border border-green-200 rounded"></span>
                Filled
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-cyan-50 border border-cyan-200 rounded"></span>
                Your signup
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-red-50 border border-red-200 rounded"></span>
                Open
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-purple-200 border border-purple-400 rounded"></span>
                Selected
              </span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
