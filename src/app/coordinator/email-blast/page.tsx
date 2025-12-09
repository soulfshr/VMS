'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type EmailTemplate = 'GENERAL_NEWSLETTER' | 'SCHEDULE_ANNOUNCEMENT' | 'TRAINING_ANNOUNCEMENT' | 'FREEFORM';

interface Zone {
  id: string;
  name: string;
}

interface Shift {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  zone: { id: string; name: string };
  openSlots: number;
  totalSlots: number;
}

interface Filters {
  roles: string[];
  qualifications: string[];
  zones: string[];
  languages: string[];
  hasQualifications: 'any' | 'yes' | 'no';
}

interface PreviewResult {
  count: number;
  sample: Array<{ id: string; name: string; email: string; role: string }>;
}

const TEMPLATES: Record<EmailTemplate, { name: string; description: string; icon: string; defaultSubject: string; defaultContent: string }> = {
  GENERAL_NEWSLETTER: {
    name: 'General Newsletter',
    description: 'General updates and announcements',
    icon: '📰',
    defaultSubject: 'Volunteer Update',
    defaultContent: '',
  },
  SCHEDULE_ANNOUNCEMENT: {
    name: 'Schedule Announcement',
    description: 'New shifts available with zone-specific listings',
    icon: '📅',
    defaultSubject: 'New Volunteer Shifts Available',
    defaultContent: 'Our neighbors are counting on us. Whether you can spare a few hours or a full day, your presence strengthens our community\'s safety net. Please consider signing up for an open shift below.',
  },
  TRAINING_ANNOUNCEMENT: {
    name: 'Training Announcement',
    description: 'Upcoming trainings with session listings',
    icon: '🎓',
    defaultSubject: 'Upcoming Training Sessions',
    defaultContent: 'We have new training opportunities coming up! Building your skills helps strengthen our community\'s rapid response network. Check out the upcoming sessions below and RSVP to secure your spot.',
  },
  FREEFORM: {
    name: 'Freeform',
    description: 'Custom subject and body',
    icon: '✏️',
    defaultSubject: '',
    defaultContent: '',
  },
};

const ROLES = ['VOLUNTEER', 'COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR'];
const QUALIFICATIONS = ['VERIFIER', 'ZONE_LEAD', 'DISPATCHER'];
const LANGUAGES = ['English', 'Spanish', 'French', 'Portuguese', 'Arabic', 'Chinese', 'Korean', 'Vietnamese'];

export default function CoordinatorEmailBlastPage() {
  const [step, setStep] = useState(1);
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [filters, setFilters] = useState<Filters>({
    roles: [],
    qualifications: [],
    zones: [],
    languages: [],
    hasQualifications: 'any',
  });
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  // Date range for SCHEDULE_ANNOUNCEMENT (defaults to next 14 days)
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });
  const [zones, setZones] = useState<Zone[]>([]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [history, setHistory] = useState<Array<{
    id: string;
    subject: string;
    template: string;
    status: string;
    recipientCount: number;
    sentCount: number;
    failedCount: number;
    sentAt: string;
    createdAt: string;
    sentBy: { name: string };
  }>>([]);

  // Shift selection for SCHEDULE_ANNOUNCEMENT
  const [availableShifts, setAvailableShifts] = useState<Shift[]>([]);
  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<string>>(new Set());
  const [isLoadingShifts, setIsLoadingShifts] = useState(false);

  // Fetch zones on mount
  useEffect(() => {
    fetch('/api/admin/zones')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setZones(data.filter((z: Zone & { isActive: boolean }) => z.isActive));
        }
      })
      .catch(console.error);

    // Fetch history
    fetch('/api/admin/email-blast?limit=5')
      .then(res => res.json())
      .then(data => {
        if (data.blasts) {
          setHistory(data.blasts);
        }
      })
      .catch(console.error);
  }, []);

  // Fetch shifts when date range changes and template is SCHEDULE_ANNOUNCEMENT
  useEffect(() => {
    if (template !== 'SCHEDULE_ANNOUNCEMENT') return;

    const fetchShifts = async () => {
      setIsLoadingShifts(true);
      try {
        const res = await fetch(
          `/api/shifts?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&status=PUBLISHED&hasOpenings=true`
        );
        if (res.ok) {
          const data = await res.json();
          setAvailableShifts(data.shifts || []);
          // Auto-select all shifts initially
          setSelectedShiftIds(new Set((data.shifts || []).map((s: Shift) => s.id)));
        }
      } catch (err) {
        console.error('Error fetching shifts:', err);
      }
      setIsLoadingShifts(false);
    };

    fetchShifts();
  }, [template, dateRange.startDate, dateRange.endDate]);

  // Fetch preview when filters change
  const fetchPreview = useCallback(async () => {
    setIsLoadingPreview(true);
    try {
      const res = await fetch('/api/admin/email-blast/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters }),
      });
      const data = await res.json();
      setPreview(data);
    } catch (err) {
      console.error('Error fetching preview:', err);
    }
    setIsLoadingPreview(false);
  }, [filters]);

  useEffect(() => {
    if (step >= 2) {
      fetchPreview();
    }
  }, [step, fetchPreview]);

  const handleTemplateSelect = (t: EmailTemplate) => {
    setTemplate(t);
    setSubject(TEMPLATES[t].defaultSubject);
    setContent(TEMPLATES[t].defaultContent);
    setStep(2);
  };

  const handleFilterChange = (type: keyof Filters, value: string) => {
    setFilters(prev => {
      if (type === 'hasQualifications') {
        return { ...prev, hasQualifications: value as 'any' | 'yes' | 'no' };
      }
      const arr = prev[type] as string[];
      if (arr.includes(value)) {
        return { ...prev, [type]: arr.filter(v => v !== value) };
      }
      return { ...prev, [type]: [...arr, value] };
    });
  };

  const handleSelectAllShifts = () => {
    if (selectedShiftIds.size === availableShifts.length) {
      // Deselect all
      setSelectedShiftIds(new Set());
    } else {
      // Select all
      setSelectedShiftIds(new Set(availableShifts.map(s => s.id)));
    }
  };

  const handleToggleShift = (shiftId: string) => {
    setSelectedShiftIds(prev => {
      const next = new Set(prev);
      if (next.has(shiftId)) {
        next.delete(shiftId);
      } else {
        next.add(shiftId);
      }
      return next;
    });
  };

  const handleSend = async () => {
    if (!template || !subject || !content) return;

    setIsSending(true);
    try {
      const payload: {
        template: EmailTemplate;
        subject: string;
        content: string;
        filters: Filters;
        dateRange?: { startDate: string; endDate: string };
        selectedShiftIds?: string[];
      } = { template, subject, content, filters };

      // Include dateRange and selected shifts for SCHEDULE_ANNOUNCEMENT
      if (template === 'SCHEDULE_ANNOUNCEMENT') {
        payload.dateRange = dateRange;
        payload.selectedShiftIds = Array.from(selectedShiftIds);
      }

      const res = await fetch('/api/admin/email-blast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        setSendResult({ success: true, message: data.message });
      } else {
        setSendResult({ success: false, message: data.error || 'Failed to send' });
      }
    } catch (err) {
      setSendResult({ success: false, message: 'Network error' });
    }
    setIsSending(false);
  };

  const resetForm = () => {
    setStep(1);
    setTemplate(null);
    setFilters({ roles: [], qualifications: [], zones: [], languages: [], hasQualifications: 'any' });
    setSubject('');
    setContent('');
    setDateRange({
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
    setPreview(null);
    setSendResult(null);
    setAvailableShifts([]);
    setSelectedShiftIds(new Set());
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Success screen
  if (sendResult?.success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✅</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Blast Complete!</h2>
          <p className="text-gray-600 mb-6">{sendResult.message}</p>
          <button
            onClick={resetForm}
            className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/coordinator" className="hover:text-cyan-600">Coordinator Console</Link>
          <span>/</span>
          <span className="text-gray-900">Email Blast</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Send Email Blast</h1>
        <p className="text-gray-600 mt-1">Send bulk emails to volunteers with filtering options</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4 mb-8">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {s}
            </div>
            <span className={`text-sm ${step >= s ? 'text-gray-900' : 'text-gray-500'}`}>
              {s === 1 && 'Template'}
              {s === 2 && 'Recipients'}
              {s === 3 && 'Compose'}
              {s === 4 && 'Send'}
            </span>
            {s < 4 && <div className="w-8 h-0.5 bg-gray-200" />}
          </div>
        ))}
      </div>

      {/* Step 1: Template Selection */}
      {step === 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(Object.keys(TEMPLATES) as EmailTemplate[]).map(t => (
            <button
              key={t}
              onClick={() => handleTemplateSelect(t)}
              className={`text-left p-6 bg-white rounded-xl border-2 transition-all ${
                template === t
                  ? 'border-cyan-500 bg-cyan-50'
                  : 'border-gray-200 hover:border-cyan-300'
              }`}
            >
              <div className="text-3xl mb-2">{TEMPLATES[t].icon}</div>
              <h3 className="font-semibold text-gray-900">{TEMPLATES[t].name}</h3>
              <p className="text-sm text-gray-500 mt-1">{TEMPLATES[t].description}</p>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Recipient Filters */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Filter Recipients</h3>

            {/* User Types */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">User Types</label>
              <div className="flex flex-wrap gap-2">
                {ROLES.map(role => (
                  <label
                    key={role}
                    className={`px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                      filters.roles.includes(role)
                        ? 'bg-cyan-100 border-cyan-500 text-cyan-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-cyan-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={filters.roles.includes(role)}
                      onChange={() => handleFilterChange('roles', role)}
                    />
                    {role.charAt(0) + role.slice(1).toLowerCase()}
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">Leave empty to include all roles</p>
            </div>

            {/* Qualification Status */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Qualification Status</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'any', label: 'Any' },
                  { value: 'yes', label: 'Has Qualifications' },
                  { value: 'no', label: 'No Qualifications' },
                ].map(opt => (
                  <label
                    key={opt.value}
                    className={`px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                      filters.hasQualifications === opt.value
                        ? 'bg-cyan-100 border-cyan-500 text-cyan-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-cyan-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="hasQualifications"
                      className="sr-only"
                      checked={filters.hasQualifications === opt.value}
                      onChange={() => handleFilterChange('hasQualifications', opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Specific Qualifications */}
            {filters.hasQualifications === 'any' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Specific Qualifications</label>
                <div className="flex flex-wrap gap-2">
                  {QUALIFICATIONS.map(q => (
                    <label
                      key={q}
                      className={`px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                        filters.qualifications.includes(q)
                          ? 'bg-purple-100 border-purple-500 text-purple-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:border-purple-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={filters.qualifications.includes(q)}
                        onChange={() => handleFilterChange('qualifications', q)}
                      />
                      {q.replace(/_/g, ' ')}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">Leave empty to include all</p>
              </div>
            )}

            {/* Zones */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Zones</label>
              <div className="flex flex-wrap gap-2">
                {zones.map(zone => (
                  <label
                    key={zone.id}
                    className={`px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                      filters.zones.includes(zone.id)
                        ? 'bg-blue-100 border-blue-500 text-blue-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={filters.zones.includes(zone.id)}
                      onChange={() => handleFilterChange('zones', zone.id)}
                    />
                    {zone.name}
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">Leave empty to include all zones</p>
            </div>

            {/* Languages */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Languages</label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map(lang => (
                  <label
                    key={lang}
                    className={`px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                      filters.languages.includes(lang)
                        ? 'bg-orange-100 border-orange-500 text-orange-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-orange-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={filters.languages.includes(lang)}
                      onChange={() => handleFilterChange('languages', lang)}
                    />
                    {lang}
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">Leave empty to include all languages</p>
            </div>
          </div>

          {/* Preview Count */}
          <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-cyan-900">
                  {isLoadingPreview ? (
                    'Counting recipients...'
                  ) : (
                    <>
                      <span className="text-2xl font-bold">{preview?.count ?? 0}</span> recipients will receive this email
                    </>
                  )}
                </p>
                {preview && preview.sample.length > 0 && (
                  <p className="text-sm text-cyan-700 mt-1">
                    Including: {preview.sample.map(s => s.name).join(', ')}
                    {preview.count > 5 && ` and ${preview.count - 5} more`}
                  </p>
                )}
                <p className="text-xs text-cyan-600 mt-1">
                  Only active users with email notifications enabled will receive emails. Inactive users are excluded.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!preview || preview.count === 0}
              className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Compose */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Compose Your Message</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                placeholder="Email subject line"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={10}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                placeholder={
                  template === 'FREEFORM'
                    ? 'Write your message here...'
                    : 'Enter the main content of your message. This will be inserted into the template.'
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                You can use {'{{volunteerName}}'} to personalize with the recipient&apos;s name
              </p>
            </div>
          </div>

          {/* Date Range and Shift Selection for Schedule Announcement */}
          {template === 'SCHEDULE_ANNOUNCEMENT' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                <span className="text-xl">📅</span>
                Select Shifts to Include
              </h4>
              <p className="text-sm text-blue-700 mb-4">
                Choose which shifts with openings to include in the email. Recipients will see shifts from their assigned zone(s).
              </p>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-blue-900 mb-1">From Date</label>
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={e => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-900 mb-1">To Date</label>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={e => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  />
                </div>
              </div>

              {/* Shift List with Select All */}
              <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                {/* Header with Select All */}
                <div className="flex items-center gap-3 px-4 py-3 bg-blue-100 border-b border-blue-200">
                  <input
                    type="checkbox"
                    id="selectAllShifts"
                    checked={availableShifts.length > 0 && selectedShiftIds.size === availableShifts.length}
                    onChange={handleSelectAllShifts}
                    className="w-4 h-4 text-blue-600 rounded border-blue-300 focus:ring-blue-500"
                  />
                  <label htmlFor="selectAllShifts" className="text-sm font-medium text-blue-900 cursor-pointer">
                    Select All ({selectedShiftIds.size}/{availableShifts.length} selected)
                  </label>
                </div>

                {/* Shift List */}
                {isLoadingShifts ? (
                  <div className="p-4 text-center text-blue-700">
                    <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
                    Loading shifts...
                  </div>
                ) : availableShifts.length === 0 ? (
                  <div className="p-4 text-center text-blue-600">
                    No shifts with openings found in this date range
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-blue-100">
                    {availableShifts.map(shift => (
                      <label
                        key={shift.id}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors ${
                          selectedShiftIds.has(shift.id) ? 'bg-blue-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedShiftIds.has(shift.id)}
                          onChange={() => handleToggleShift(shift.id)}
                          className="w-4 h-4 text-blue-600 rounded border-blue-300 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 truncate">{shift.title}</span>
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                              {shift.zone.name}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDate(shift.date)} • {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                          </div>
                        </div>
                        <span className="text-sm text-green-600 font-medium">
                          {shift.openSlots} open
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs text-blue-600 mt-2">
                Only selected shifts will be included in the email
              </p>
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={!subject || !content || (template === 'SCHEDULE_ANNOUNCEMENT' && selectedShiftIds.size === 0)}
              className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Preview →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Preview & Send */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Review & Send</h3>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Template</p>
                <p className="font-medium">{template && TEMPLATES[template].name}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Subject</p>
                <p className="font-medium">{subject}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Recipients</p>
                <p className="font-medium">{preview?.count ?? 0} volunteers</p>
              </div>

              {template === 'SCHEDULE_ANNOUNCEMENT' && (
                <div>
                  <p className="text-sm text-gray-500">Shifts Included</p>
                  <p className="font-medium">{selectedShiftIds.size} shifts selected</p>
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-sm text-gray-500 mb-2">Message Preview</p>
                <div className="bg-gray-50 rounded-lg p-4 border">
                  <p className="whitespace-pre-wrap">{content}</p>
                </div>
              </div>
            </div>
          </div>

          {sendResult?.success === false && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700">{sendResult.message}</p>
            </div>
          )}

          <div className="flex justify-between items-start">
            <button
              onClick={() => setStep(3)}
              disabled={isSending}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              ← Back
            </button>
            <div className="text-right">
              <button
                onClick={handleSend}
                disabled={isSending}
                className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isSending ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Sending to {preview?.count ?? 0} recipients...
                  </>
                ) : (
                  <>
                    Send to {preview?.count ?? 0} Recipients
                  </>
                )}
              </button>
              {isSending && (
                <p className="text-sm text-gray-500 mt-2">
                  This may take a moment for larger recipient lists.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent History */}
      {step === 1 && history.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Email Blasts</h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y">
            {history.map(blast => (
              <div key={blast.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{blast.subject}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(blast.sentAt || blast.createdAt).toLocaleDateString()} by {blast.sentBy.name}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-2 py-1 text-xs rounded-full ${
                      blast.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-700'
                        : blast.status === 'SENDING'
                        ? 'bg-yellow-100 text-yellow-700'
                        : blast.status === 'FAILED'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {blast.status}
                  </span>
                  <p className="text-sm text-gray-500 mt-1">
                    {blast.sentCount}/{blast.recipientCount} sent
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
