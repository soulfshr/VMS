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

  const canEdit = user && ['COORDINATOR', 'ADMINISTRATOR'].includes(user.role);

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

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
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
                <Link
                  href="/shifts/create"
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
                >
                  + Create Shift
                </Link>
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
              <span className="text-gray-600">Regional Lead</span>
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
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden" data-tour="schedule-grid">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border-b border-r border-gray-200 px-2 py-3 text-left text-sm font-medium text-gray-600 min-w-[100px] w-[100px] sticky left-0 z-20 bg-gray-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                      County / Time
                    </th>
                    {weekDates.map(date => (
                      <th
                        key={date.toISOString()}
                        className="border-b border-r border-gray-200 px-2 py-3 text-center text-sm font-medium text-gray-600 min-w-[120px]"
                      >
                        <div>{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                        <div className="text-gray-500">
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Regional Lead Row - spans all counties */}
                  <tr className="bg-purple-50">
                    <td className="border-b border-r border-purple-200 px-2 py-2 font-semibold text-purple-800 bg-purple-100 w-[100px] sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex items-center gap-1">
                        <span>🌐</span>
                        <span className="text-sm">Regional Lead</span>
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

                  {/* Regional Dispatcher Section - only shown in REGIONAL mode */}
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
                      {/* Time block rows for regional dispatchers */}
                      {scheduleData.timeBlocks.map(timeBlock => (
                        <tr key={`regional-${timeBlock.label}`} className="bg-cyan-50">
                          <td className="border-b border-r border-cyan-200 px-2 py-2 text-sm text-cyan-700 bg-cyan-50 w-[100px] sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                            {timeBlock.label}
                          </td>
                          {weekDates.map(date => {
                            const dateStr = formatDateLocal(date);
                            const regionalDisp = scheduleData.regionalDispatchers.find(
                              rd => rd.date === dateStr && rd.timeBlock.label === timeBlock.label
                            );

                            return (
                              <td
                                key={dateStr}
                                onClick={() => {
                                  if (canEdit) {
                                    // Create a synthetic cell for the modal
                                    const syntheticCell: CellData = {
                                      county: 'ALL',
                                      date: dateStr,
                                      timeBlock,
                                      dispatcher: regionalDisp?.dispatcher || null,
                                      backupDispatchers: regionalDisp?.backupDispatchers || [],
                                      zones: [],
                                      coverage: 'none',
                                      gaps: { needsDispatcher: !regionalDisp?.dispatcher, zonesNeedingLeads: [] },
                                    };
                                    handleCellClick(syntheticCell);
                                  }
                                }}
                                className={`border-b border-r border-cyan-200 px-3 py-2 text-sm ${
                                  canEdit ? 'cursor-pointer hover:bg-cyan-100' : ''
                                }`}
                              >
                                {regionalDisp?.dispatcher ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1">
                                      <span className="text-yellow-500 text-xs">★</span>
                                      <span className="font-medium text-gray-900">
                                        {regionalDisp.dispatcher.name.split(' ')[0]}
                                        {regionalDisp.dispatcher.notes && (
                                          <span className="ml-1 font-normal text-cyan-600">{regionalDisp.dispatcher.notes}</span>
                                        )}
                                      </span>
                                    </div>
                                    {regionalDisp.backupDispatchers.slice(0, 2).map(backup => (
                                      <div key={backup.id} className="text-xs text-gray-600">
                                        {backup.name.split(' ')[0]}
                                      </div>
                                    ))}
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
                                          coverage: 'none',
                                          gaps: { needsDispatcher: !countyDisp?.dispatcher, zonesNeedingLeads: [] },
                                        };
                                        handleCellClick(syntheticCell);
                                      }
                                    }}
                                    className={`border-b border-r border-cyan-200 px-3 py-2 text-sm ${
                                      canEdit ? 'cursor-pointer hover:bg-cyan-100' : ''
                                    }`}
                                  >
                                    {countyDisp?.dispatcher ? (
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1">
                                          <span className="text-yellow-500 text-xs">★</span>
                                          <span className="font-medium text-gray-900">
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
    </div>
    </>
  );
}
