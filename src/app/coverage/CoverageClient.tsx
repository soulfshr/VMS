'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { DevUser } from '@/types/auth';
import SlotModal from './SlotModal';
import CoordinatorModal from './CoordinatorModal';

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

interface ZoneSlotData {
  zoneId: string;
  zoneName: string;
  county: string;
  startHour: number;
  endHour: number;
  config: SlotConfig;
  signups: Signup[];
  coverage: 'full' | 'partial' | 'none';
  needsDispatcher: boolean;
  needsZoneLead: boolean;
  volunteerCount: number;
  volunteerTarget: number;
}

interface OverrideData {
  id: string;
  date: string;
  zoneId: string | null;
  overrideType: 'CLOSURE' | 'ADJUST_REQUIREMENTS' | 'SPECIAL_EVENT';
  reason: string | null;
}

interface DayData {
  date: string;
  dayOfWeek: number;
  isActive: boolean;
  isClosed?: boolean;
  closureReason?: string | null;
  overrides?: OverrideData[];
  slots: ZoneSlotData[];
}

interface CountyGroup {
  county: string;
  zones: Array<{
    id: string;
    name: string;
  }>;
}

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

interface WeekData {
  startDate: string;
  endDate: string;
  days: DayData[];
  counties: CountyGroup[];
  timeSlots: Array<{ start: number; end: number }>;
  coordinatorCoverage: CoordinatorDayCoverage[];
  stats: {
    totalSlots: number;
    coveredSlots: number;
    criticalGaps: number;
    coordinatorSlots: number;
    coordinatorFilled: number;
    coordinatorGaps: number;
  };
  userQualifications?: string[];
  userPrimaryZone?: { id: string; name: string } | null;
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

function formatTimeLabel(hour: number): string {
  if (hour === 0) return '12am';
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return '12pm';
  return `${hour - 12}pm`;
}

function getSlotLabel(start: number, end: number): string {
  return `${formatTimeLabel(start)}-${formatTimeLabel(end)}`;
}

export default function CoverageClient() {
  const router = useRouter();
  const [user, setUser] = useState<DevUser | null>(null);
  const [userQualifications, setUserQualifications] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [selectedCounty, setSelectedCounty] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'region' | 'zone'>('region');
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    return new Date(now.setDate(diff));
  });

  // Modal state - now stores all zone slots for the selected time slot
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSlotData, setSelectedSlotData] = useState<{
    date: string;
    allZoneSlots: ZoneSlotData[];
    initialZoneId?: string;
  } | null>(null);

  // Coordinator modal state
  const [coordinatorModalOpen, setCoordinatorModalOpen] = useState(false);

  // Date override modal state (for coordinators)
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [selectedOverrideDate, setSelectedOverrideDate] = useState<string | null>(null);

  // Refresh trigger for MySignups component
  const [signupRefreshKey, setSignupRefreshKey] = useState(0);

  // Check authentication
  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (!data.user) {
          router.push('/login');
        } else {
          setUser(data.user);
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  // Fetch coverage data
  const fetchCoverage = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const startDate = formatDateLocal(currentWeekStart);
      const url = new URL('/api/coverage/week', window.location.origin);
      url.searchParams.set('date', startDate);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Failed to fetch coverage');
      const data = await res.json();
      setWeekData(data);

      // Set user qualifications from API response
      if (data.userQualifications) {
        setUserQualifications(data.userQualifications);
      }

      // Set initial selected zone if in zone mode
      if (data.counties?.length > 0 && data.counties[0].zones?.length > 0 && !selectedZone) {
        setSelectedZone(data.counties[0].zones[0].id);
      }
    } catch (error) {
      console.error('Error fetching coverage:', error);
    } finally {
      setLoading(false);
    }
  }, [user, currentWeekStart, selectedZone]);

  useEffect(() => {
    fetchCoverage();
  }, [fetchCoverage]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newDate);
  };

  const goToToday = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    setCurrentWeekStart(new Date(now.setDate(diff)));
  };

  const formatWeekRange = () => {
    const end = new Date(currentWeekStart);
    end.setDate(end.getDate() + 6);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${currentWeekStart.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}, ${end.getFullYear()}`;
  };

  // Handle slot click - accepts all zone slots for the time slot
  const handleSlotClick = (allZoneSlots: ZoneSlotData[], date: string, initialZoneId?: string) => {
    setSelectedSlotData({
      date,
      allZoneSlots,
      initialZoneId,
    });
    setModalOpen(true);
  };

  // Generate dates for the week
  const weekDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(currentWeekStart);
    date.setDate(date.getDate() + i);
    weekDates.push(date);
  }

  // Check if user can manage overrides (coordinator, admin, or developer)
  const canManageOverrides = user?.role === 'COORDINATOR' || user?.role === 'ADMINISTRATOR' || user?.role === 'DEVELOPER';

  // Handle day header click for coordinators
  const handleDayHeaderClick = (dateStr: string) => {
    if (canManageOverrides) {
      setSelectedOverrideDate(dateStr);
      setOverrideModalOpen(true);
    }
  };

  // Get coverage status color
  const getCoverageColor = (coverage: string) => {
    switch (coverage) {
      case 'full':
        return 'bg-green-100 border-green-300 hover:bg-green-200';
      case 'partial':
        return 'bg-yellow-100 border-yellow-300 hover:bg-yellow-200';
      default:
        return 'bg-red-50 border-red-200 hover:bg-red-100';
    }
  };

  const getCoverageIcon = (coverage: string) => {
    switch (coverage) {
      case 'full':
        return <span className="text-green-600">&#10003;</span>;
      case 'partial':
        return <span className="text-yellow-600">&#9888;</span>;
      default:
        return <span className="text-red-600">!</span>;
    }
  };

  // Calculate aggregated coverage for a time slot across all zones in a county (or all)
  const getAggregatedSlot = (dayData: DayData, timeStart: number, county?: string) => {
    const slots = dayData.slots.filter(
      s => s.startHour === timeStart && (!county || county === 'all' || s.county === county)
    );

    if (slots.length === 0) return null;

    const totalZones = slots.length;
    const fullCoverage = slots.filter(s => s.coverage === 'full').length;
    const partialCoverage = slots.filter(s => s.coverage === 'partial').length;

    let coverage: 'full' | 'partial' | 'none' = 'none';
    if (fullCoverage === totalZones) coverage = 'full';
    else if (fullCoverage > 0 || partialCoverage > 0) coverage = 'partial';

    return {
      coverage,
      fullCount: fullCoverage,
      totalCount: totalZones,
      slots,
    };
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Coverage Schedule</h1>
          <p className="text-gray-600 mt-1">
            Sign up for 2-hour coverage slots
            {weekData?.stats && (
              <span className="ml-2 text-sm">
                 | {Math.round((weekData.stats.coveredSlots / Math.max(weekData.stats.totalSlots, 1)) * 100)}% coverage
                {weekData.stats.criticalGaps > 0 && (
                  <span className="text-red-600 ml-1">
                    ({weekData.stats.criticalGaps} critical gaps)
                  </span>
                )}
              </span>
            )}
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6">
          {/* Week navigation */}
          <div className="flex items-center justify-center gap-1 sm:gap-2 mb-3">
            <button
              onClick={() => navigateWeek('prev')}
              className="p-2 sm:px-3 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              aria-label="Previous week"
            >
              <span className="hidden sm:inline">&larr; Prev</span>
              <span className="sm:hidden">&larr;</span>
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm sm:text-base"
            >
              Today
            </button>
            <button
              onClick={() => navigateWeek('next')}
              className="p-2 sm:px-3 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              aria-label="Next week"
            >
              <span className="hidden sm:inline">Next &rarr;</span>
              <span className="sm:hidden">&rarr;</span>
            </button>
            <span className="ml-2 sm:ml-4 font-medium text-gray-900 text-sm sm:text-base whitespace-nowrap">
              {formatWeekRange()}
            </span>
          </div>

          {/* View toggle and filters */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {/* View mode toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('region')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    viewMode === 'region'
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Region
                </button>
                <button
                  onClick={() => setViewMode('zone')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    viewMode === 'zone'
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  By Zone
                </button>
              </div>

              {/* County filter (region mode) or zone selector (zone mode) */}
              {viewMode === 'region' ? (
                <select
                  value={selectedCounty}
                  onChange={e => setSelectedCounty(e.target.value)}
                  className="px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="all">All Counties</option>
                  {weekData?.counties.map(c => (
                    <option key={c.county} value={c.county}>
                      {c.county}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={selectedZone}
                  onChange={e => setSelectedZone(e.target.value)}
                  className="px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  {weekData?.counties.map(c => (
                    <optgroup key={c.county} label={c.county}>
                      {c.zones.map(z => (
                        <option key={z.id} value={z.id}>
                          {z.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1" title="Full coverage">
                <div className="w-3 h-3 rounded bg-green-100 border border-green-300"></div>
                <span className="text-gray-500">Full</span>
              </div>
              <div className="flex items-center gap-1" title="Partial coverage">
                <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></div>
                <span className="text-gray-500">Partial</span>
              </div>
              <div className="flex items-center gap-1" title="No coverage">
                <div className="w-3 h-3 rounded bg-red-50 border border-red-200"></div>
                <span className="text-gray-500">Gap</span>
              </div>
            </div>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
          </div>
        ) : weekData ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="overflow-auto">
              <table className="w-full border-collapse" style={{ minWidth: '700px' }}>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-100">
                    <th className="w-[80px] min-w-[80px] px-2 py-3 text-left text-sm font-medium text-gray-600 border-b border-r border-gray-200 bg-gray-100">
                      Time
                    </th>
                    {weekDates.map(date => {
                      const dateStr = formatDateLocal(date);
                      const dayData = weekData.days.find(d => d.date === dateStr);
                      const isActive = dayData?.isActive !== false;
                      const isClosed = dayData?.isClosed;
                      const hasOverrides = dayData?.overrides && dayData.overrides.length > 0;

                      return (
                        <th
                          key={dateStr}
                          onClick={() => handleDayHeaderClick(dateStr)}
                          className={`min-w-[85px] px-2 py-3 text-center text-sm font-medium border-b border-r border-gray-200 ${
                            isActive ? 'text-gray-600 bg-gray-100' : 'text-gray-400 bg-gray-50'
                          } ${canManageOverrides ? 'cursor-pointer hover:bg-gray-200' : ''}`}
                          title={canManageOverrides ? 'Click to add/view date override' : undefined}
                        >
                          <div className="flex items-center justify-center gap-1">
                            {date.toLocaleDateString('en-US', { weekday: 'short' })}
                            {isClosed && <span className="text-red-500 text-xs">&#128274;</span>}
                            {hasOverrides && !isClosed && <span className="text-yellow-500 text-xs">*</span>}
                          </div>
                          <div className="font-normal">
                            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                          {isClosed && dayData?.closureReason && (
                            <div className="text-[10px] text-red-500 font-normal truncate max-w-[80px]">
                              {dayData.closureReason}
                            </div>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* Coordinator Summary Row */}
                  <tr className="bg-purple-50 border-b-2 border-purple-200">
                    <td className="border-b border-r border-purple-200 px-2 py-3 text-sm font-medium text-purple-700 bg-purple-100">
                      <button
                        onClick={() => setCoordinatorModalOpen(true)}
                        className="flex items-center gap-1 hover:text-purple-900 transition-colors"
                        title="Click to manage coordinator schedule"
                      >
                        <span>&#128081;</span>
                        <span className="hidden sm:inline">Coord</span>
                      </button>
                    </td>
                    {weekDates.map(date => {
                      const dateStr = formatDateLocal(date);
                      const coordDay = weekData?.coordinatorCoverage?.find(d => d.date === dateStr);
                      const filledCount = coordDay?.filledCount || 0;
                      const totalCount = coordDay?.totalCount || 0;

                      // Show "Past" label for past dates
                      if (isDatePast(dateStr)) {
                        return (
                          <td
                            key={dateStr}
                            className="border-b border-r border-purple-200 px-2 py-2 text-center bg-gray-50 cursor-pointer"
                            onClick={() => setCoordinatorModalOpen(true)}
                          >
                            <div className="text-[10px] text-gray-400">Past</div>
                          </td>
                        );
                      }

                      let statusColor = 'bg-red-100 text-red-700 border-red-200';
                      let icon = '!';
                      if (totalCount === 0) {
                        statusColor = 'bg-gray-100 text-gray-400 border-gray-200';
                        icon = '-';
                      } else if (filledCount === totalCount) {
                        statusColor = 'bg-green-100 text-green-700 border-green-300';
                        icon = '✓';
                      } else if (filledCount > 0) {
                        statusColor = 'bg-yellow-100 text-yellow-700 border-yellow-300';
                        icon = '⚠';
                      }

                      return (
                        <td
                          key={dateStr}
                          className={`border-b border-r border-purple-200 px-2 py-2 text-center cursor-pointer transition-colors hover:opacity-80 ${statusColor}`}
                          onClick={() => setCoordinatorModalOpen(true)}
                          title={`${filledCount}/${totalCount} coordinator slots filled`}
                        >
                          <div className="text-lg">{icon}</div>
                          <div className="text-xs mt-0.5">
                            {filledCount}/{totalCount}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {viewMode === 'region' ? (
                    // Region view - aggregated by time slot
                    weekData.timeSlots.map(slot => (
                      <tr key={`${slot.start}-${slot.end}`}>
                        <td className="border-b border-r border-gray-200 px-2 py-3 text-sm text-gray-600 bg-gray-50 font-medium">
                          {getSlotLabel(slot.start, slot.end)}
                        </td>
                        {weekDates.map(date => {
                          const dateStr = formatDateLocal(date);
                          const dayData = weekData.days.find(d => d.date === dateStr);
                          const isPast = isDatePast(dateStr);

                          if (!dayData || !dayData.isActive) {
                            return (
                              <td
                                key={dateStr}
                                className="border-b border-r border-gray-200 px-2 py-2 text-center text-gray-400 bg-gray-50"
                              >
                                -
                              </td>
                            );
                          }

                          const aggregated = getAggregatedSlot(dayData, slot.start, selectedCounty);

                          if (!aggregated) {
                            return (
                              <td
                                key={dateStr}
                                className="border-b border-r border-gray-200 px-2 py-2 text-center text-gray-400"
                              >
                                -
                              </td>
                            );
                          }

                          // Show "Past" label for past dates
                          if (isPast) {
                            return (
                              <td
                                key={dateStr}
                                className="border-b border-r border-gray-200 px-2 py-2 text-center bg-gray-50 cursor-pointer"
                                onClick={() => {
                                  if (aggregated.slots.length > 0) {
                                    handleSlotClick(aggregated.slots, dateStr);
                                  }
                                }}
                              >
                                <div className="text-[10px] text-gray-400">Past</div>
                              </td>
                            );
                          }

                          return (
                            <td
                              key={dateStr}
                              className={`border-b border-r border-gray-200 px-2 py-2 text-center cursor-pointer transition-colors ${getCoverageColor(aggregated.coverage)}`}
                              onClick={() => {
                                // Pass all zones for this time slot - modal shows zone tabs
                                if (aggregated.slots.length > 0) {
                                  handleSlotClick(aggregated.slots, dateStr);
                                }
                              }}
                            >
                              <div className="text-lg">{getCoverageIcon(aggregated.coverage)}</div>
                              <div className="text-xs text-gray-600 mt-0.5">
                                {aggregated.fullCount}/{aggregated.totalCount}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  ) : (
                    // Zone view - specific zone details
                    weekData.timeSlots.map(slot => {
                      const selectedZoneData = weekData.counties
                        .flatMap(c => c.zones)
                        .find(z => z.id === selectedZone);

                      return (
                        <tr key={`${slot.start}-${slot.end}`}>
                          <td className="border-b border-r border-gray-200 px-2 py-3 text-sm text-gray-600 bg-gray-50 font-medium">
                            {getSlotLabel(slot.start, slot.end)}
                          </td>
                          {weekDates.map(date => {
                            const dateStr = formatDateLocal(date);
                            const dayData = weekData.days.find(d => d.date === dateStr);
                            const isPast = isDatePast(dateStr);

                            if (!dayData || !dayData.isActive) {
                              return (
                                <td
                                  key={dateStr}
                                  className="border-b border-r border-gray-200 px-2 py-2 text-center text-gray-400 bg-gray-50"
                                >
                                  -
                                </td>
                              );
                            }

                            const zoneSlot = dayData.slots.find(
                              s => s.zoneId === selectedZone && s.startHour === slot.start
                            );

                            if (!zoneSlot) {
                              return (
                                <td
                                  key={dateStr}
                                  className="border-b border-r border-gray-200 px-2 py-2 text-center text-gray-400"
                                >
                                  -
                                </td>
                              );
                            }

                            // Get all zones for this time slot for the modal
                            const allSlotsForTime = dayData.slots.filter(s => s.startHour === slot.start);

                            // Show "Past" label for past dates
                            if (isPast) {
                              return (
                                <td
                                  key={dateStr}
                                  className="border-b border-r border-gray-200 px-2 py-2 text-center bg-gray-50 cursor-pointer"
                                  onClick={() => handleSlotClick(allSlotsForTime, dateStr, zoneSlot.zoneId)}
                                >
                                  <div className="text-[10px] text-gray-400">Past</div>
                                </td>
                              );
                            }

                            const dispatcher = zoneSlot.signups.find(s => s.roleType === 'DISPATCHER');
                            const zoneLead = zoneSlot.signups.find(s => s.roleType === 'ZONE_LEAD');
                            const verifiers = zoneSlot.signups.filter(s => s.roleType === 'VERIFIER');

                            return (
                              <td
                                key={dateStr}
                                className={`border-b border-r border-gray-200 px-2 py-2 cursor-pointer transition-colors ${getCoverageColor(zoneSlot.coverage)}`}
                                onClick={() => handleSlotClick(allSlotsForTime, dateStr, zoneSlot.zoneId)}
                              >
                                <div className="text-xs space-y-0.5">
                                  {/* Dispatcher */}
                                  <div className="flex items-center gap-1">
                                    <span title="Dispatcher">&#128222;</span>
                                    <span className={dispatcher ? 'text-gray-800' : 'text-gray-400'}>
                                      {dispatcher ? dispatcher.userName.split(' ')[0] : 'OPEN'}
                                    </span>
                                  </div>
                                  {/* Zone Lead */}
                                  <div className="flex items-center gap-1">
                                    <span title="Zone Lead">&#128081;</span>
                                    <span className={zoneLead ? 'text-gray-800' : 'text-gray-400'}>
                                      {zoneLead ? zoneLead.userName.split(' ')[0] : 'OPEN'}
                                    </span>
                                  </div>
                                  {/* Volunteers */}
                                  <div className="flex items-center gap-1">
                                    <span title="Verifiers">&#128101;</span>
                                    <span className={verifiers.length >= zoneSlot.volunteerTarget ? 'text-gray-800' : 'text-gray-400'}>
                                      {verifiers.length}/{zoneSlot.volunteerTarget}
                                    </span>
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            No coverage data available
          </div>
        )}

        {/* My Signups Section */}
        {user && (
          <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">My Upcoming Coverage</h2>
            <MySignups userId={user.id} refreshKey={signupRefreshKey} onUpdate={fetchCoverage} />
          </div>
        )}
      </div>

      {/* Slot Modal */}
      {modalOpen && selectedSlotData && user && (
        <SlotModal
          date={selectedSlotData.date}
          allZoneSlots={selectedSlotData.allZoneSlots}
          initialZoneId={selectedSlotData.initialZoneId}
          userPrimaryZoneId={weekData?.userPrimaryZone?.id}
          currentUser={user}
          userQualifications={userQualifications}
          onClose={() => {
            setModalOpen(false);
            setSelectedSlotData(null);
          }}
          onUpdate={() => {
            fetchCoverage();
            setSignupRefreshKey(prev => prev + 1);
          }}
        />
      )}

      {/* Coordinator Modal */}
      {coordinatorModalOpen && weekData && user && (
        <CoordinatorModal
          weekStart={currentWeekStart}
          coordinatorCoverage={weekData.coordinatorCoverage}
          timeSlots={weekData.timeSlots}
          currentUser={user}
          userQualifications={userQualifications}
          onClose={() => setCoordinatorModalOpen(false)}
          onUpdate={() => {
            fetchCoverage();
            setSignupRefreshKey(prev => prev + 1);
          }}
        />
      )}

      {/* Date Override Modal */}
      {overrideModalOpen && selectedOverrideDate && weekData && (
        <DateOverrideModal
          date={selectedOverrideDate}
          existingOverrides={weekData.days.find(d => d.date === selectedOverrideDate)?.overrides || []}
          zones={weekData.counties.flatMap(c => c.zones.map(z => ({ id: z.id, name: z.name, county: c.county })))}
          onClose={() => {
            setOverrideModalOpen(false);
            setSelectedOverrideDate(null);
          }}
          onUpdate={() => {
            fetchCoverage();
          }}
        />
      )}
    </div>
  );
}

// My Signups sub-component
function MySignups({ userId, refreshKey, onUpdate }: { userId: string; refreshKey: number; onUpdate: () => void }) {
  const [signups, setSignups] = useState<Array<{
    id: string;
    date: string;
    zoneName: string;
    startHour: number;
    endHour: number;
    roleType: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSignups = async () => {
      try {
        const res = await fetch('/api/coverage/signup');
        if (res.ok) {
          const data = await res.json();
          setSignups(data.signups || []);
        }
      } catch (error) {
        console.error('Error fetching signups:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSignups();
  }, [userId, refreshKey]);

  const handleCancel = async (signupId: string) => {
    if (!confirm('Are you sure you want to cancel this signup?')) return;

    try {
      const res = await fetch(`/api/coverage/signup/${signupId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSignups(prev => prev.filter(s => s.id !== signupId));
        onUpdate();
      }
    } catch (error) {
      console.error('Error cancelling signup:', error);
    }
  };

  const getRoleIcon = (roleType: string) => {
    switch (roleType) {
      case 'DISPATCHER':
        return <span title="Dispatcher">&#128222;</span>;
      case 'ZONE_LEAD':
        return <span title="Zone Lead">&#128081;</span>;
      case 'DISPATCH_COORDINATOR':
        return <span title="Dispatch Coordinator">&#128081;</span>;
      default:
        return <span title="Verifier">&#128101;</span>;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return <div className="text-gray-500 text-sm">Loading...</div>;
  }

  if (signups.length === 0) {
    return (
      <div className="text-gray-500 text-sm">
        No upcoming coverage signups. Click on any slot above to sign up!
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {signups.slice(0, 5).map(signup => (
        <div
          key={signup.id}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">{getRoleIcon(signup.roleType)}</span>
            <div>
              <div className="font-medium text-gray-900">
                {formatDate(signup.date)}: {formatTimeLabel(signup.startHour)}-{formatTimeLabel(signup.endHour)}
              </div>
              <div className="text-sm text-gray-600">
                {signup.zoneName} ({signup.roleType.replace('_', ' ')})
              </div>
            </div>
          </div>
          <button
            onClick={() => handleCancel(signup.id)}
            className="text-red-600 hover:text-red-800 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      ))}
      {signups.length > 5 && (
        <div className="text-sm text-gray-500 text-center">
          +{signups.length - 5} more signups
        </div>
      )}
    </div>
  );
}

// Date Override Modal for coordinators
interface OverrideModalProps {
  date: string;
  existingOverrides: OverrideData[];
  zones: Array<{ id: string; name: string; county: string }>;
  onClose: () => void;
  onUpdate: () => void;
}

function DateOverrideModal({ date, existingOverrides, zones, onClose, onUpdate }: OverrideModalProps) {
  const [overrideType, setOverrideType] = useState<'CLOSURE' | 'ADJUST_REQUIREMENTS' | 'SPECIAL_EVENT'>('CLOSURE');
  const [zoneId, setZoneId] = useState<string>(''); // empty = all zones
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const handleCreate = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/coverage/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          zoneId: zoneId || null,
          overrideType,
          reason: reason || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create override');
      }

      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create override');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (overrideId: string) => {
    if (!confirm('Are you sure you want to delete this override?')) return;

    try {
      const response = await fetch(`/api/coverage/overrides/${overrideId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete override');
      }

      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete override');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Date Override</h2>
          <p className="text-sm text-gray-600">{formattedDate}</p>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Existing overrides */}
          {existingOverrides.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Current Overrides</h3>
              <div className="space-y-2">
                {existingOverrides.map(override => (
                  <div key={override.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900 text-sm">
                        {override.overrideType.replace('_', ' ')}
                      </div>
                      <div className="text-xs text-gray-600">
                        {override.zoneId ? zones.find(z => z.id === override.zoneId)?.name : 'All Zones'}
                        {override.reason && ` - ${override.reason}`}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(override.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create new override */}
          <h3 className="text-sm font-medium text-gray-700 mb-3">Add New Override</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Override Type</label>
              <select
                value={overrideType}
                onChange={(e) => setOverrideType(e.target.value as 'CLOSURE' | 'ADJUST_REQUIREMENTS' | 'SPECIAL_EVENT')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="CLOSURE">Closure (no coverage needed)</option>
                <option value="SPECIAL_EVENT">Special Event (add note)</option>
                <option value="ADJUST_REQUIREMENTS">Adjust Requirements</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Apply To</label>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Zones</option>
                {zones.map(zone => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name} ({zone.county})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Reason {overrideType === 'CLOSURE' ? '(e.g., Christmas Day)' : '(optional)'}
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={overrideType === 'CLOSURE' ? 'Holiday name or reason' : 'Optional note'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {overrideType === 'ADJUST_REQUIREMENTS' && (
              <div className="p-3 bg-yellow-50 text-yellow-700 rounded-lg text-sm">
                Note: To adjust volunteer requirements for specific slots, use the Coverage Config page.
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="px-4 py-2 text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Add Override'}
          </button>
        </div>
      </div>
    </div>
  );
}
