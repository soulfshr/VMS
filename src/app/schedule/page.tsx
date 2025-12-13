'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { DevUser } from '@/types/auth';
import AssignmentModal from '@/components/schedule/AssignmentModal';
import RegionalLeadModal from '@/components/schedule/RegionalLeadModal';
import GuidedTour from '@/components/onboarding/GuidedTour';

interface TimeBlock {
  startTime: string;      // Eastern time format "6:00"
  endTime: string;        // Eastern time format "10:00"
  label: string;          // Display label "6am - 10am"
  startTimeUTC: string;   // UTC ISO string for saving
  endTimeUTC: string;     // UTC ISO string for saving
}

interface ZoneData {
  zoneId: string;
  zoneName: string;
  zoneLeads: Array<{
    id: string;
    name: string;
    rsvpId: string;
  }>;
  volunteers: Array<{
    id: string;
    name: string;
    rsvpId: string;
    status: string;
  }>;
  shifts: Array<{
    id: string;
    title: string;
    type: string;
    typeConfigName: string | null;
  }>;
}

interface CellData {
  county: string;
  date: string;
  timeBlock: TimeBlock;
  dispatcher: {
    id: string;
    name: string;
    assignmentId: string;
    isBackup: boolean;
    notes: string | null;
  } | null;
  backupDispatchers: Array<{
    id: string;
    name: string;
    assignmentId: string;
    notes: string | null;
  }>;
  zones: ZoneData[];
  coverage: 'full' | 'partial' | 'none';
  gaps: {
    needsDispatcher: boolean;
    zonesNeedingLeads: string[];
  };
}

interface Zone {
  id: string;
  name: string;
  county: string | null;
}

interface RegionalLead {
  id: string;
  userId: string;
  userName: string;
  date: string;
  isPrimary: boolean;
  notes: string | null;
}

interface DispatcherInfo {
  id: string;
  name: string;
  assignmentId: string;
  isBackup: boolean;
  notes: string | null;
}

interface RegionalDispatcher {
  date: string;
  timeBlock: TimeBlock;
  dispatcher: DispatcherInfo | null;
  backupDispatchers: Array<{
    id: string;
    name: string;
    assignmentId: string;
    notes: string | null;
  }>;
  coverage: 'full' | 'none';
}

interface CountyDispatcher {
  county: string;
  date: string;
  timeBlock: TimeBlock;
  dispatcher: DispatcherInfo | null;
  backupDispatchers: Array<{
    id: string;
    name: string;
    assignmentId: string;
    notes: string | null;
  }>;
  coverage: 'full' | 'none';
}

interface RegionalBackupDispatcher {
  date: string;
  timeBlock: TimeBlock;
  dispatchers: Array<{
    id: string;
    name: string;
    assignmentId: string;
    notes: string | null;
  }>;
}

interface ScheduleData {
  counties: string[];
  zones: Zone[];
  timeBlocks: TimeBlock[];
  dates: string[];
  schedule: CellData[];
  regionalLeads: RegionalLead[];
  dispatcherSchedulingMode: 'REGIONAL' | 'COUNTY' | 'ZONE';
  schedulingMode: 'SIMPLE' | 'FULL';
  regionalDispatchers: RegionalDispatcher[];
  countyDispatchers: CountyDispatcher[];
  regionalBackupDispatchers: RegionalBackupDispatcher[];
}

// Format date as YYYY-MM-DD in local timezone (not UTC)
function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function SchedulePage() {
  const router = useRouter();
  const [user, setUser] = useState<DevUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [selectedCounty, setSelectedCounty] = useState<string>('all');
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    return new Date(now.setDate(diff));
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<CellData | null>(null);
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());
  const [regionalLeadModalOpen, setRegionalLeadModalOpen] = useState(false);
  const [selectedRegionalLeadDate, setSelectedRegionalLeadDate] = useState<string | null>(null);
  const [backupDispatchersExpanded, setBackupDispatchersExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    dispatcherSchedulingMode: 'ZONE' as 'REGIONAL' | 'COUNTY' | 'ZONE',
    schedulingMode: 'SIMPLE' as 'SIMPLE' | 'FULL',
  });

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

  // Fetch schedule data
  const fetchSchedule = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const startDate = formatDateLocal(currentWeekStart);
      const endDate = new Date(currentWeekStart);
      endDate.setDate(endDate.getDate() + 6);
      const endDateStr = formatDateLocal(endDate);

      const url = new URL('/api/schedule', window.location.origin);
      url.searchParams.set('startDate', startDate);
      url.searchParams.set('endDate', endDateStr);
      if (selectedCounty !== 'all') {
        url.searchParams.set('county', selectedCounty);
      }

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Failed to fetch schedule');
      const data = await res.json();
      setScheduleData(data);
    } catch (error) {
      console.error('Error fetching schedule:', error);
    } finally {
      setLoading(false);
    }
  }, [user, currentWeekStart, selectedCounty]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // Sync settings form with schedule data
  useEffect(() => {
    if (scheduleData) {
      setSettingsForm({
        dispatcherSchedulingMode: scheduleData.dispatcherSchedulingMode || 'ZONE',
        schedulingMode: scheduleData.schedulingMode || 'SIMPLE',
      });
    }
  }, [scheduleData]);

  const canEdit = user && ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role);

  // Save schedule settings
  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      const res = await fetch('/api/coordinator/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      setShowSettings(false);
      fetchSchedule(); // Refresh schedule with new settings
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSettingsSaving(false);
    }
  };

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

  const handleCellClick = (cell: CellData) => {
    if (canEdit) {
      setSelectedCell(cell);
      setModalOpen(true);
    }
  };

  const handleRegionalLeadClick = (dateStr: string) => {
    if (canEdit) {
      setSelectedRegionalLeadDate(dateStr);
      setRegionalLeadModalOpen(true);
    }
  };

  const getRegionalLeadsForDate = (dateStr: string): RegionalLead[] => {
    if (!scheduleData?.regionalLeads) return [];
    return scheduleData.regionalLeads
      .filter(rl => rl.date === dateStr)
      .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
  };

  const toggleCellExpanded = (cellKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCells(prev => {
      const next = new Set(prev);
      if (next.has(cellKey)) {
        next.delete(cellKey);
      } else {
        next.add(cellKey);
      }
      return next;
    });
  };

  const formatWeekRange = () => {
    const end = new Date(currentWeekStart);
    end.setDate(end.getDate() + 6);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${currentWeekStart.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}, ${end.getFullYear()}`;
  };

  const getCoverageColor = (coverage: string) => {
    switch (coverage) {
      case 'full':
        return 'bg-green-50 border-green-200';
      case 'partial':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };


  // Generate dates for the week
  const weekDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(currentWeekStart);
    date.setDate(date.getDate() + i);
    weekDates.push(date);
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  return (
    <>
      {/* Guided Tour */}
      {user && (
        <GuidedTour
          pageName="schedule"
          userRole={user.role}
          autoStart={true}
        />
      )}

    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Weekly Schedule</h1>
          <p className="text-gray-600 mt-1">
            View dispatcher and zone lead assignments
            {canEdit && ' • Click cells to edit assignments'}
          </p>
        </div>

        {/* Controls - Sticky */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 sticky top-0 z-30">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Week navigation */}
            <div className="flex items-center gap-2" data-tour="week-nav">
              <button
                onClick={() => navigateWeek('prev')}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                ← Prev
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Today
              </button>
              <button
                onClick={() => navigateWeek('next')}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Next →
              </button>
              <span className="ml-4 font-medium text-gray-900">
                Week of {formatWeekRange()}
              </span>
            </div>

            {/* County filter and Create button */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2" data-tour="county-filter">
                <label className="text-sm text-gray-600">Filter:</label>
                <select
                  value={selectedCounty}
                  onChange={e => setSelectedCounty(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="all">All Counties</option>
                  {scheduleData?.counties.map(county => (
                    <option key={county} value={county}>
                      {county} County
                    </option>
                  ))}
                </select>
              </div>
              {canEdit && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSettings(true)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                    title="Schedule Settings"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <Link
                    href="/shifts/create"
                    className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
                  >
                    + Create Shift
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-gray-200 text-sm" data-tour="coverage-legend">
            <span className="text-gray-500 font-medium">Coverage:</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-100 border border-green-300"></div>
              <span className="text-gray-600">Full</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-300"></div>
              <span className="text-gray-600">Partial</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-100 border border-gray-300"></div>
              <span className="text-gray-600">None</span>
            </div>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-2">
              <span>🎧</span>
              <span className="text-gray-600">Dispatcher</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🌐</span>
              <span className="text-gray-600">Dispatch Coordinator</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-amber-600 font-medium text-xs">Need X</span>
              <span className="text-gray-600">Gap</span>
            </div>
          </div>
        </div>

        {/* Schedule Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
          </div>
        ) : scheduleData ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200" data-tour="schedule-grid">
            {/* Scrollable container with max-height for internal scroll with sticky header */}
            <div className="overflow-auto max-h-[calc(100vh-220px)]">
              <table className="w-full border-collapse table-fixed">
                {/* Sticky Header Row - sticks within scroll container */}
                <thead className="sticky top-0 z-20">
                  <tr className="bg-gray-100">
                    <th className="w-[100px] min-w-[100px] px-2 py-3 text-left text-sm font-medium text-gray-600 border-b border-r border-gray-200 bg-gray-100 sticky left-0 z-30 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                      County / Time
                    </th>
                    {weekDates.map(date => (
                      <th
                        key={date.toISOString()}
                        className="w-[calc((100%-100px)/7)] min-w-[120px] px-2 py-3 text-center text-sm font-medium text-gray-600 border-b border-r border-gray-200 bg-gray-100"
                      >
                        <div>{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                        <div className="text-gray-500 font-normal">
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Dispatch Coordinator Row - spans all counties */}
                  <tr className="bg-purple-50">
                    <td className="border-b border-r border-purple-200 px-2 py-2 font-semibold text-purple-800 bg-purple-100 w-[100px] sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex items-center gap-1">
                        <span>🌐</span>
                        <span className="text-sm">Dispatch Coord</span>
                      </div>
                      <div className="text-xs font-normal text-purple-600 mt-0.5">All day</div>
                    </td>
                    {weekDates.map(date => {
                      const dateStr = formatDateLocal(date);
                      const leads = getRegionalLeadsForDate(dateStr);
                      const primaryLead = leads.find(l => l.isPrimary);
                      const backupLeads = leads.filter(l => !l.isPrimary);

                      return (
                        <td
                          key={dateStr}
                          onClick={() => handleRegionalLeadClick(dateStr)}
                          className={`border-b border-r border-purple-200 px-3 py-2 text-sm ${
                            canEdit ? 'cursor-pointer hover:bg-purple-100' : ''
                          }`}
                        >
                          {leads.length > 0 ? (
                            <div className="space-y-1">
                              {primaryLead && (
                                <div className="flex items-center gap-1">
                                  <span className="text-yellow-500 text-xs">★</span>
                                  <span className="font-medium text-gray-900">
                                    {primaryLead.userName.split(' ')[0]}
                                    {primaryLead.notes && (
                                      <span className="ml-1 font-normal text-purple-600">{primaryLead.notes}</span>
                                    )}
                                  </span>
                                </div>
                              )}
                              {backupLeads.slice(0, 2).map(lead => (
                                <div key={lead.id} className="text-xs text-gray-600">
                                  {lead.userName.split(' ')[0]}
                                  {lead.notes && (
                                    <span className="ml-1 text-purple-600">{lead.notes}</span>
                                  )}
                                </div>
                              ))}
                              {backupLeads.length > 2 && (
                                <div className="text-xs text-purple-600">
                                  +{backupLeads.length - 2} more
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-gray-400 text-xs">
                              {canEdit ? 'Click to assign' : '—'}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Backup Dispatchers Section - shown when there are any regional backups */}
                  {scheduleData.regionalBackupDispatchers?.some(rb => rb.dispatchers.length > 0) && (
                    <>
                      {/* Backup Dispatchers Header - Collapsible */}
                      <tr
                        className="bg-cyan-50 cursor-pointer hover:bg-cyan-100 transition-colors"
                        onClick={() => setBackupDispatchersExpanded(!backupDispatchersExpanded)}
                      >
                        <td className="border-b border-r border-cyan-200 px-2 py-2 font-semibold text-cyan-800 bg-cyan-100 w-[100px] sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                          <div className="flex items-center gap-1">
                            <span className={`transition-transform ${backupDispatchersExpanded ? 'rotate-90' : ''}`}>▶</span>
                            <span className="text-sm">Backup Disp.</span>
                          </div>
                          <div className="text-xs font-normal text-cyan-600 mt-0.5">Region-wide</div>
                        </td>
                        <td colSpan={7} className="border-b border-cyan-200 bg-cyan-50 text-xs text-cyan-600 px-3">
                          {!backupDispatchersExpanded && 'Click to expand'}
                        </td>
                      </tr>
                      {/* Time block rows for backup dispatchers - only shown when expanded */}
                      {backupDispatchersExpanded && scheduleData.timeBlocks.map(timeBlock => (
                        <tr key={`backup-${timeBlock.label}`} className="bg-cyan-50">
                          <td className="border-b border-r border-cyan-200 px-2 py-2 text-sm text-cyan-700 bg-cyan-50 w-[100px] sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                            {timeBlock.label}
                          </td>
                          {weekDates.map(date => {
                            const dateStr = formatDateLocal(date);
                            const backupData = scheduleData.regionalBackupDispatchers?.find(
                              rb => rb.date === dateStr && rb.timeBlock.label === timeBlock.label
                            );
                            const dispatchers = backupData?.dispatchers || [];
                            const firstDispatcher = dispatchers[0] || null;

                            return (
                              <td
                                key={dateStr}
                                onClick={() => {
                                  if (canEdit) {
                                    // Create synthetic cell for backup dispatcher modal
                                    const syntheticCell: CellData = {
                                      county: 'REGIONAL', // Special marker for backup dispatchers
                                      date: dateStr,
                                      timeBlock,
                                      dispatcher: firstDispatcher ? {
                                        id: firstDispatcher.id,
                                        name: firstDispatcher.name,
                                        assignmentId: firstDispatcher.assignmentId,
                                        isBackup: true,
                                        notes: firstDispatcher.notes,
                                      } : null,
                                      backupDispatchers: dispatchers.slice(1),
                                      zones: [],
                                      coverage: dispatchers.length > 0 ? 'full' : 'none',
                                      gaps: { needsDispatcher: dispatchers.length === 0, zonesNeedingLeads: [] },
                                    };
                                    handleCellClick(syntheticCell);
                                  }
                                }}
                                className={`border-b border-r border-cyan-200 px-3 py-2 text-sm bg-cyan-50 ${
                                  canEdit ? 'cursor-pointer hover:bg-cyan-100' : ''
                                }`}
                              >
                                {dispatchers.length > 0 ? (
                                  <div className="space-y-1">
                                    {dispatchers.slice(0, 3).map(d => (
                                      <div key={d.id} className="text-xs text-gray-700">
                                        {d.name.split(' ')[0]}
                                        {d.notes && (
                                          <span className="ml-1 text-cyan-600">{d.notes}</span>
                                        )}
                                      </div>
                                    ))}
                                    {dispatchers.length > 3 && (
                                      <div className="text-xs text-cyan-600">
                                        +{dispatchers.length - 3} more
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-gray-400 text-xs">
                                    {canEdit ? 'Click to assign' : '—'}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  )}

                  {/* Regional Dispatcher Section - only shown in REGIONAL mode */}
                  {/* Aggregates dispatchers from ALL counties by time slot */}
                  {scheduleData.dispatcherSchedulingMode === 'REGIONAL' && (
                    <>
                      {/* Regional Dispatcher Header */}
                      <tr className="bg-cyan-50">
                        <td className="border-b border-r border-cyan-200 px-2 py-2 font-semibold text-cyan-800 bg-cyan-100 w-[100px] sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                          <div className="flex items-center gap-1">
                            <span>🎧</span>
                            <span className="text-sm">Dispatcher</span>
                          </div>
                          <div className="text-xs font-normal text-cyan-600 mt-0.5">All counties</div>
                        </td>
                        <td colSpan={7} className="border-b border-cyan-200 bg-cyan-50"></td>
                      </tr>
                      {/* Time block rows - aggregate county dispatchers by time */}
                      {scheduleData.timeBlocks.map(timeBlock => (
                        <tr key={`regional-${timeBlock.label}`} className="bg-cyan-50">
                          <td className="border-b border-r border-cyan-200 px-2 py-2 text-sm text-cyan-700 bg-cyan-50 w-[100px] sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                            {timeBlock.label}
                          </td>
                          {weekDates.map(date => {
                            const dateStr = formatDateLocal(date);
                            // Aggregate all county dispatchers for this date + time block
                            const dispatchersForTimeSlot = scheduleData.countyDispatchers
                              .filter(cd => cd.date === dateStr && cd.timeBlock.label === timeBlock.label && cd.dispatcher)
                              .map(cd => cd.dispatcher!);
                            const hasAnyDispatcher = dispatchersForTimeSlot.length > 0;
                            // Get unique dispatcher names (first name only)
                            const dispatcherNames = [...new Set(dispatchersForTimeSlot.map(d => d.name.split(' ')[0]))];

                            return (
                              <td
                                key={dateStr}
                                onClick={() => {
                                  if (canEdit) {
                                    // Create a synthetic cell for the modal - assigns for ALL counties
                                    const syntheticCell: CellData = {
                                      county: 'ALL',
                                      date: dateStr,
                                      timeBlock,
                                      dispatcher: null, // Modal will handle multi-county assignment
                                      backupDispatchers: [],
                                      zones: [],
                                      coverage: hasAnyDispatcher ? 'full' : 'none',
                                      gaps: { needsDispatcher: !hasAnyDispatcher, zonesNeedingLeads: [] },
                                    };
                                    handleCellClick(syntheticCell);
                                  }
                                }}
                                className={`border-b border-r px-3 py-2 text-sm ${
                                  hasAnyDispatcher ? 'bg-green-100 border-green-200' : 'bg-red-50 border-red-200'
                                } ${canEdit ? 'cursor-pointer hover:bg-opacity-80' : ''}`}
                              >
                                {hasAnyDispatcher ? (
                                  <div className="space-y-0.5">
                                    <div className="flex items-start gap-1 min-w-0">
                                      <span className="text-yellow-500 text-xs flex-shrink-0">★</span>
                                      <span className="font-medium text-gray-900 break-words text-xs">
                                        {dispatcherNames.join(', ')}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-red-400 text-xs font-medium">
                                    {canEdit ? '⚠ Click to assign' : '—'}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  )}

                  {(selectedCounty === 'all' ? scheduleData.counties : [selectedCounty]).map(county => (
                    <>
                      {/* County header row */}
                      <tr key={`${county}-header`} className="bg-gray-50">
                        <td
                          colSpan={8}
                          className="border-b border-gray-200 px-2 py-2 font-semibold text-gray-800"
                        >
                          {county} County
                        </td>
                      </tr>

                      {/* County Dispatcher Section - only shown in COUNTY mode */}
                      {scheduleData.dispatcherSchedulingMode === 'COUNTY' && (
                        <>
                          {/* County Dispatcher Header */}
                          <tr key={`${county}-dispatcher-header`} className="bg-cyan-50">
                            <td className="border-b border-r border-cyan-200 px-2 py-2 font-semibold text-cyan-800 bg-cyan-100 w-[100px] sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                              <div className="flex items-center gap-1">
                                <span>🎧</span>
                                <span className="text-sm">Dispatcher</span>
                              </div>
                            </td>
                            <td colSpan={7} className="border-b border-cyan-200 bg-cyan-50"></td>
                          </tr>
                          {/* Time block rows for county dispatchers */}
                          {scheduleData.timeBlocks.map(timeBlock => (
                            <tr key={`${county}-dispatcher-${timeBlock.label}`} className="bg-cyan-50">
                              <td className="border-b border-r border-cyan-200 px-2 py-2 text-sm text-cyan-700 bg-cyan-50 w-[100px] sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                                {timeBlock.label}
                              </td>
                              {weekDates.map(date => {
                                const dateStr = formatDateLocal(date);
                                const countyDisp = scheduleData.countyDispatchers.find(
                                  cd => cd.county === county && cd.date === dateStr && cd.timeBlock.label === timeBlock.label
                                );

                                return (
                                  <td
                                    key={dateStr}
                                    onClick={() => {
                                      if (canEdit) {
                                        // Create a synthetic cell for the modal
                                        const syntheticCell: CellData = {
                                          county,
                                          date: dateStr,
                                          timeBlock,
                                          dispatcher: countyDisp?.dispatcher || null,
                                          backupDispatchers: countyDisp?.backupDispatchers || [],
                                          zones: [],
                                          coverage: countyDisp?.coverage || 'none',
                                          gaps: { needsDispatcher: !countyDisp?.dispatcher, zonesNeedingLeads: [] },
                                        };
                                        handleCellClick(syntheticCell);
                                      }
                                    }}
                                    className={`border-b border-r px-3 py-2 text-sm ${
                                      countyDisp?.coverage === 'full' ? 'bg-green-100 border-green-200' : 'bg-red-50 border-red-200'
                                    } ${canEdit ? 'cursor-pointer hover:bg-opacity-80' : ''}`}
                                  >
                                    {countyDisp?.dispatcher ? (
                                      <div className="space-y-1">
                                        <div className="flex items-start gap-1 min-w-0">
                                          <span className="text-yellow-500 text-xs flex-shrink-0">★</span>
                                          <span className="font-medium text-gray-900 break-words">
                                            {countyDisp.dispatcher.name.split(' ')[0]}
                                            {countyDisp.dispatcher.notes && (
                                              <span className="ml-1 font-normal text-cyan-600">{countyDisp.dispatcher.notes}</span>
                                            )}
                                          </span>
                                        </div>
                                        {countyDisp.backupDispatchers.slice(0, 2).map(backup => (
                                          <div key={backup.id} className="text-xs text-gray-600">
                                            {backup.name.split(' ')[0]}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-red-400 text-xs font-medium">
                                        {canEdit ? '⚠ Click to assign' : '—'}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </>
                      )}

                      {/* Time block rows */}
                      {scheduleData.timeBlocks.map(timeBlock => (
                        <tr key={`${county}-${timeBlock.label}`}>
                          <td className="border-b border-r border-gray-200 px-2 py-2 text-sm text-gray-600 bg-gray-50 w-[100px] sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                            {timeBlock.label}
                          </td>
                          {weekDates.map(date => {
                            const dateStr = formatDateLocal(date);
                            const cellKey = `${county}-${dateStr}-${timeBlock.label}`;
                            const cell = scheduleData.schedule.find(
                              s =>
                                s.county === county &&
                                s.date === dateStr &&
                                s.timeBlock.label === timeBlock.label
                            );
                            const isExpanded = expandedCells.has(cellKey);

                            return (
                              <td
                                key={dateStr}
                                onClick={() =>
                                  handleCellClick(
                                    cell || {
                                      county,
                                      date: dateStr,
                                      timeBlock,
                                      dispatcher: null,
                                      backupDispatchers: [],
                                      zones: [],
                                      coverage: 'none',
                                      gaps: { needsDispatcher: false, zonesNeedingLeads: [] },
                                    }
                                  )
                                }
                                className={`border-b border-r border-gray-200 px-3 py-2 text-sm ${
                                  cell ? getCoverageColor(cell.coverage) : 'bg-white'
                                } ${canEdit ? 'cursor-pointer hover:bg-opacity-80' : ''}`}
                              >
                                {cell ? (
                                  <div className="space-y-1">
                                    {/* Dispatcher - only show in ZONE mode */}
                                    {scheduleData.dispatcherSchedulingMode === 'ZONE' && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs">🎧</span>
                                        <span className={cell.dispatcher ? 'font-medium text-gray-900' : 'text-gray-400'}>
                                          {cell.dispatcher?.name || '—'}
                                        </span>
                                      </div>
                                    )}
                                    {/* Zone Leads - only show zones with actual shifts */}
                                    {cell.zones.slice(0, isExpanded ? undefined : 3).map(zoneData => {
                                      const zoneLead = zoneData.zoneLeads[0];
                                      const volunteerCount = zoneData.zoneLeads.length + zoneData.volunteers.length;
                                      return (
                                        <div key={zoneData.zoneId} className="text-xs text-gray-600 flex items-center gap-1">
                                          <span className="font-medium">{zoneData.zoneName.split(' ')[1]}:</span>
                                          {zoneLead ? (
                                            <span className="text-gray-800">{zoneLead.name.split(' ')[0]}</span>
                                          ) : (
                                            <span className="text-gray-400">—</span>
                                          )}
                                          {/* Show volunteer count only in FULL mode */}
                                          {scheduleData.schedulingMode === 'FULL' && volunteerCount > 1 && (
                                            <span className="text-gray-400 text-[10px]">+{volunteerCount - 1}</span>
                                          )}
                                        </div>
                                      );
                                    })}
                                    {/* Expand/collapse */}
                                    {cell.zones.length > 3 && (
                                      <button
                                        onClick={e => toggleCellExpanded(cellKey, e)}
                                        className="text-xs text-cyan-600 hover:text-cyan-800"
                                      >
                                        {isExpanded ? 'Show less' : `+${cell.zones.length - 3} more`}
                                      </button>
                                    )}
                                    {/* Gap indicators - show what's missing */}
                                    {((scheduleData.dispatcherSchedulingMode === 'ZONE' && cell.gaps?.needsDispatcher) || (cell.gaps?.zonesNeedingLeads?.length ?? 0) > 0) && (
                                      <div className="mt-1 space-y-0.5">
                                        {scheduleData.dispatcherSchedulingMode === 'ZONE' && cell.gaps?.needsDispatcher && (
                                          <div className="text-[10px] text-amber-600 font-medium">
                                            Need dispatcher
                                          </div>
                                        )}
                                        {(cell.gaps?.zonesNeedingLeads?.length ?? 0) > 0 && (
                                          <div className="text-[10px] text-amber-600 font-medium">
                                            {cell.gaps.zonesNeedingLeads.length <= 2
                                              ? `${cell.gaps.zonesNeedingLeads.map(z => z.split(' ')[1]).join(', ')} need leads`
                                              : `${cell.gaps.zonesNeedingLeads.length} zones need leads`}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-gray-500 text-xs">No shifts</div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            No schedule data available
          </div>
        )}

      </div>

      {/* Assignment Modal */}
      {modalOpen && selectedCell && scheduleData && (
        <AssignmentModal
          cell={selectedCell}
          zones={scheduleData.zones.filter(z => z.county === selectedCell.county)}
          onClose={() => {
            setModalOpen(false);
            setSelectedCell(null);
          }}
          onSave={() => {
            setModalOpen(false);
            setSelectedCell(null);
            fetchSchedule();
          }}
          dispatcherMode={scheduleData.dispatcherSchedulingMode}
          schedulingMode={scheduleData.schedulingMode}
        />
      )}

      {/* Regional Lead Modal */}
      {regionalLeadModalOpen && selectedRegionalLeadDate && scheduleData && (
        <RegionalLeadModal
          date={selectedRegionalLeadDate}
          existingLeads={getRegionalLeadsForDate(selectedRegionalLeadDate)}
          onClose={() => {
            setRegionalLeadModalOpen(false);
            setSelectedRegionalLeadDate(null);
          }}
          onSave={() => {
            fetchSchedule();
          }}
        />
      )}

      {/* Schedule Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Schedule Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Dispatcher Scheduling Mode */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Dispatcher Scheduling Mode</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Controls how dispatchers are assigned to time blocks
                </p>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="dispatcherMode"
                      value="REGIONAL"
                      checked={settingsForm.dispatcherSchedulingMode === 'REGIONAL'}
                      onChange={() => setSettingsForm(prev => ({ ...prev, dispatcherSchedulingMode: 'REGIONAL' }))}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">Regional</span>
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Low Activity</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        One dispatcher covers all counties. Best for quiet periods.
                      </p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="dispatcherMode"
                      value="COUNTY"
                      checked={settingsForm.dispatcherSchedulingMode === 'COUNTY'}
                      onChange={() => setSettingsForm(prev => ({ ...prev, dispatcherSchedulingMode: 'COUNTY' }))}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">County</span>
                        <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">Medium Activity</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        One dispatcher per county. Standard configuration.
                      </p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="dispatcherMode"
                      value="ZONE"
                      checked={settingsForm.dispatcherSchedulingMode === 'ZONE'}
                      onChange={() => setSettingsForm(prev => ({ ...prev, dispatcherSchedulingMode: 'ZONE' }))}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">Zone</span>
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">High Activity</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Dispatchers assigned at zone level. Maximum coverage.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Volunteer Scheduling Mode */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Volunteer Scheduling Mode</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Controls which volunteer positions appear in the schedule
                </p>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="schedulingMode"
                      value="SIMPLE"
                      checked={settingsForm.schedulingMode === 'SIMPLE'}
                      onChange={() => setSettingsForm(prev => ({ ...prev, schedulingMode: 'SIMPLE' }))}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-gray-900">Simple - Leaders Only</span>
                      <p className="text-sm text-gray-500 mt-1">
                        Only show zone leads. Volunteers manage themselves.
                      </p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="schedulingMode"
                      value="FULL"
                      checked={settingsForm.schedulingMode === 'FULL'}
                      onChange={() => setSettingsForm(prev => ({ ...prev, schedulingMode: 'FULL' }))}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-gray-900">Full - All Volunteers</span>
                      <p className="text-sm text-gray-500 mt-1">
                        Show all volunteer assignments in the schedule grid.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={settingsSaving}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium disabled:opacity-50"
              >
                {settingsSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
