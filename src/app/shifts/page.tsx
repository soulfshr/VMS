'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, Suspense } from 'react';
import type { DevUser, Qualification } from '@/types/auth';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import GuidedTour from '@/components/onboarding/GuidedTour';

// Qualification labels - fallbacks for dynamic qualified roles
// These are used when qualified role data is not available
const defaultQualificationLabels: Record<string, string> = {
  VERIFIER: 'Verifier',
  ZONE_LEAD: 'Zone Lead',
  DISPATCHER: 'Dispatcher',
};

const defaultQualificationDescriptions: Record<string, string> = {
  VERIFIER: 'Verify community members at patrol locations',
  ZONE_LEAD: 'Lead and coordinate volunteers in your zone',
  DISPATCHER: 'Handle dispatch calls and coordinate responses',
};

// Helper to get label from slug
const getQualificationLabel = (slug: string, qualifiedRoles?: Array<{slug: string; name: string}>) => {
  const role = qualifiedRoles?.find(r => r.slug === slug);
  return role?.name || defaultQualificationLabels[slug] || slug.replace(/_/g, ' ');
};

const getQualificationDescription = (slug: string, qualifiedRoles?: Array<{slug: string; description: string | null}>) => {
  const role = qualifiedRoles?.find(r => r.slug === slug);
  return role?.description || defaultQualificationDescriptions[slug] || '';
};

interface Zone {
  id: string;
  name: string;
  county: string | null;
}

interface ShiftTypeConfig {
  id: string;
  name: string;
  color: string;
}

interface Shift {
  id: string;
  type: 'PATROL' | 'COLLECTION' | 'ON_CALL_FIELD_SUPPORT';
  typeConfigId: string | null;
  typeConfig: ShiftTypeConfig | null;
  title: string;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string;
  zone: Zone;
  minVolunteers: number;
  idealVolunteers: number;
  maxVolunteers: number;
  status: string;
  confirmedCount: number;
  pendingCount: number;
  spotsLeft: number;
  userRsvpStatus: string | null;
  // Exception fields
  hasRoleException: boolean;
  exceptionNotes: string | null;
  exceptionReviewedAt: string | null;
}

// Cancel Modal Component
function CancelModal({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  selectedCount: number;
  isSubmitting: boolean;
}) {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Cancel Shifts</h2>
        <p className="text-gray-600 mb-4">
          Are you sure you want to cancel {selectedCount} shift{selectedCount > 1 ? 's' : ''}?
          All signed-up volunteers will be notified by email.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Weather conditions, scheduling conflict..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            rows={3}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
          >
            Keep Shifts
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={isSubmitting}
            className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
          >
            {isSubmitting ? 'Cancelling...' : 'Cancel Shifts'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Confirm RSVPs Modal Component
function ConfirmRsvpsModal({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  pendingRsvpCount,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedCount: number;
  pendingRsvpCount: number;
  isSubmitting: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Confirm Pending RSVPs</h2>
        <p className="text-gray-600 mb-4">
          This will confirm all pending RSVPs across {selectedCount} selected shift{selectedCount > 1 ? 's' : ''}.
          {pendingRsvpCount > 0 && (
            <span className="block mt-2 font-medium text-cyan-700">
              {pendingRsvpCount} pending RSVP{pendingRsvpCount > 1 ? 's' : ''} will be confirmed.
            </span>
          )}
        </p>

        <p className="text-sm text-gray-500 mb-4">
          Each volunteer will receive a confirmation email with a calendar invite.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting || pendingRsvpCount === 0}
            className="flex-1 py-2 px-4 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium disabled:opacity-50"
          >
            {isSubmitting ? 'Confirming...' : 'Confirm All'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Qualified role type for dynamic role data
interface QualifiedRoleData {
  slug: string;
  name: string;
  description: string | null;
}

// Qualification Picker Modal Component
function QualificationPickerModal({
  isOpen,
  onClose,
  onSelect,
  qualifications,
  qualifiedRoles,
  shiftTitle,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (qualification: Qualification) => void;
  qualifications: Qualification[];
  qualifiedRoles?: QualifiedRoleData[];
  shiftTitle: string;
  isSubmitting: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Select Your Role</h2>
        <p className="text-gray-600 mb-4">
          You have multiple qualifications. Please select which role you want to sign up as for:
        </p>
        <p className="font-medium text-gray-900 mb-4">{shiftTitle}</p>

        <div className="space-y-3 mb-6">
          {qualifications.map((qual) => (
            <button
              key={qual}
              onClick={() => onSelect(qual)}
              disabled={isSubmitting}
              className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-cyan-500 hover:bg-cyan-50 transition-colors disabled:opacity-50"
            >
              <div className="font-medium text-gray-900">{getQualificationLabel(qual, qualifiedRoles)}</div>
              <div className="text-sm text-gray-500">{getQualificationDescription(qual, qualifiedRoles)}</div>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Bulk Edit Modal Component
interface BulkEditData {
  title?: string;
  typeConfigId?: string;
  minVolunteers?: number;
  maxVolunteers?: number;
  startHour?: number;
  endHour?: number;
}

function BulkEditModal({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  isSubmitting,
  shiftTypes,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: BulkEditData) => void;
  selectedCount: number;
  isSubmitting: boolean;
  shiftTypes: ShiftTypeConfig[];
}) {
  const [editData, setEditData] = useState<BulkEditData>({});
  const [enabledFields, setEnabledFields] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const handleSubmit = () => {
    const dataToSubmit: BulkEditData = {};
    if (enabledFields.title && editData.title) {
      dataToSubmit.title = editData.title;
    }
    if (enabledFields.typeConfigId && editData.typeConfigId) {
      dataToSubmit.typeConfigId = editData.typeConfigId;
    }
    if (enabledFields.volunteers && editData.minVolunteers !== undefined) {
      dataToSubmit.minVolunteers = editData.minVolunteers;
      dataToSubmit.maxVolunteers = editData.maxVolunteers;
    }
    if (enabledFields.time && editData.startHour !== undefined) {
      dataToSubmit.startHour = editData.startHour;
      dataToSubmit.endHour = editData.endHour;
    }
    onConfirm(dataToSubmit);
  };

  const hasChanges = Object.values(enabledFields).some(v => v);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Bulk Edit Shifts</h2>
        <p className="text-gray-600 mb-4">
          Edit {selectedCount} selected shift{selectedCount > 1 ? 's' : ''}. Only enabled fields will be updated.
        </p>

        <div className="space-y-4">
          {/* Shift Name */}
          <div className="border border-gray-200 rounded-lg p-4">
            <label className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={enabledFields.title || false}
                onChange={(e) => setEnabledFields(prev => ({ ...prev, title: e.target.checked }))}
                className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500"
              />
              <span className="font-medium text-gray-900">Rename Shifts</span>
            </label>
            {enabledFields.title && (
              <input
                type="text"
                value={editData.title || ''}
                onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter new shift name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            )}
          </div>

          {/* Shift Type */}
          <div className="border border-gray-200 rounded-lg p-4">
            <label className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={enabledFields.typeConfigId || false}
                onChange={(e) => setEnabledFields(prev => ({ ...prev, typeConfigId: e.target.checked }))}
                className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500"
              />
              <span className="font-medium text-gray-900">Change Shift Type</span>
            </label>
            {enabledFields.typeConfigId && (
              <select
                value={editData.typeConfigId || ''}
                onChange={(e) => setEditData(prev => ({ ...prev, typeConfigId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">Select type...</option>
                {shiftTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Volunteer Limits */}
          <div className="border border-gray-200 rounded-lg p-4">
            <label className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={enabledFields.volunteers || false}
                onChange={(e) => setEnabledFields(prev => ({ ...prev, volunteers: e.target.checked }))}
                className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500"
              />
              <span className="font-medium text-gray-900">Change Volunteer Limits</span>
            </label>
            {enabledFields.volunteers && (
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">Min</label>
                  <input
                    type="number"
                    min={1}
                    value={editData.minVolunteers || 1}
                    onChange={(e) => setEditData(prev => ({ ...prev, minVolunteers: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">Max</label>
                  <input
                    type="number"
                    min={1}
                    value={editData.maxVolunteers || 4}
                    onChange={(e) => setEditData(prev => ({ ...prev, maxVolunteers: parseInt(e.target.value) || 4 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Time Slot */}
          <div className="border border-gray-200 rounded-lg p-4">
            <label className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={enabledFields.time || false}
                onChange={(e) => setEnabledFields(prev => ({ ...prev, time: e.target.checked }))}
                className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500"
              />
              <span className="font-medium text-gray-900">Change Time Slot</span>
            </label>
            {enabledFields.time && (
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">Start Hour (ET)</label>
                  <select
                    value={editData.startHour ?? 6}
                    onChange={(e) => setEditData(prev => ({ ...prev, startHour: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">End Hour (ET)</label>
                  <select
                    value={editData.endHour ?? 10}
                    onChange={(e) => setEditData(prev => ({ ...prev, endHour: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !hasChanges}
            className="flex-1 py-2 px-4 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium disabled:opacity-50"
          >
            {isSubmitting ? 'Updating...' : `Update ${selectedCount} Shift${selectedCount > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// Import Schedule Modal Component
function ImportScheduleModal({
  isOpen,
  onClose,
  onSuccess,
  zones,
  shiftTypes,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  zones: Zone[];
  shiftTypes: ShiftTypeConfig[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [zoneId, setZoneId] = useState('');
  const [shiftTypeId, setShiftTypeId] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    success: number;
    failed: number;
    parsed?: { month: number; year: number; locationCode: string };
  } | null>(null);

  const handleSubmit = async () => {
    if (!file || !zoneId || !shiftTypeId) return;

    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('options', JSON.stringify({
        zoneId,
        shiftTypeId,
        status,
        shiftDurationMinutes: 120,
        offsetBeforeMinutes: 30,
      }));

      const res = await fetch('/api/shifts/import-schedule', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to import schedule');
      }

      setResult({
        success: data.results?.success || 0,
        failed: data.results?.failed || 0,
        parsed: data.parsed,
      });

      if (data.results?.success > 0) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setZoneId('');
    setShiftTypeId('');
    setStatus('DRAFT');
    setError(null);
    setResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Import Clinic Schedule</h2>
        <p className="text-gray-600 mb-4">
          Upload a .docx clinic schedule file to automatically create 2-hour shifts.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className={`rounded-lg p-3 mb-4 text-sm ${
            result.success > 0 ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-yellow-50 border border-yellow-200 text-yellow-700'
          }`}>
            {result.parsed && (
              <p className="font-medium mb-1">
                Parsed: {new Date(result.parsed.year, result.parsed.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} - {result.parsed.locationCode}
              </p>
            )}
            <p>Created {result.success} shifts{result.failed > 0 ? `, ${result.failed} failed` : ''}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Schedule File (.docx)
            </label>
            <input
              type="file"
              accept=".docx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
            />
            {file && (
              <p className="text-xs text-gray-500 mt-1">{file.name}</p>
            )}
          </div>

          {/* Zone Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Zone or Location
            </label>
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">Select zone...</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>{zone.name}</option>
              ))}
            </select>
          </div>

          {/* Shift Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shift Type
            </label>
            <select
              value={shiftTypeId}
              onChange={(e) => setShiftTypeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">Select type...</option>
              {shiftTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Initial Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'PUBLISHED')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="DRAFT">Draft (review before publishing)</option>
              <option value="PUBLISHED">Published (visible to volunteers)</option>
            </select>
          </div>

          {/* Info */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            <p className="font-medium mb-1">How it works:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Parses calendar format with appointment codes (DE, MM, CONSULTS)</li>
              <li>Creates 2-hour shifts starting 30 min before each appointment</li>
              <li>Skips CLOSED and ADMIN days</li>
              <li>Uses earliest appointment time if multiple on same day</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
          >
            {result?.success ? 'Done' : 'Cancel'}
          </button>
          {!result?.success && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !file || !zoneId || !shiftTypeId}
              className="flex-1 py-2 px-4 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium disabled:opacity-50"
            >
              {isSubmitting ? 'Importing...' : 'Import Schedule'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper to convert hex color to Tailwind-like classes
function getTypeColorClasses(hexColor: string | null | undefined): { bg: string; text: string } {
  if (!hexColor) return { bg: 'bg-gray-100', text: 'text-gray-700' };
  // Use inline style for custom colors
  return { bg: '', text: '' };
}

// Get display name for shift type (prefer typeConfig, fallback to enum label)
function getShiftTypeName(shift: { typeConfig?: { name: string } | null; type: string }): string {
  if (shift.typeConfig?.name) return shift.typeConfig.name;
  // Fallback for legacy shifts without typeConfig
  const fallbackLabels: Record<string, string> = {
    PATROL: 'Patrol',
    COLLECTION: 'Collection',
    ON_CALL_FIELD_SUPPORT: 'On-Call',
  };
  return fallbackLabels[shift.type] || shift.type;
}

function ShiftsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<DevUser | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftTypeConfig[]>([]);
  const [qualifiedRoles, setQualifiedRoles] = useState<QualifiedRoleData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterZone, setFilterZone] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('PUBLISHED');
  const [filterPendingOnly, setFilterPendingOnly] = useState<boolean>(false);
  const [filterExceptionsOnly, setFilterExceptionsOnly] = useState<boolean>(false);
  const [rsvpingShiftId, setRsvpingShiftId] = useState<string | null>(null);
  const [autoConfirmRsvp, setAutoConfirmRsvp] = useState<boolean>(false);

  // Selection state for coordinators (with shift+click range selection)
  const selectableShifts = shifts.filter(s => s.status !== 'CANCELLED');
  const {
    selectedIds: selectedShifts,
    isSelected: isShiftSelected,
    toggleSelection: toggleShiftSelection,
    selectAll: selectAllShifts,
    clearSelection,
    selectedCount,
  } = useMultiSelect({
    items: selectableShifts,
    getId: (shift) => shift.id,
  });

  // Check if all selectable shifts are selected
  const allShiftsSelected = selectableShifts.length > 0 && selectedCount === selectableShifts.length;
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Bulk edit state
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Bulk publish state
  const [isPublishing, setIsPublishing] = useState(false);

  // Import schedule state
  const [showImportModal, setShowImportModal] = useState(false);

  // Qualification picker state
  const [showQualificationPicker, setShowQualificationPicker] = useState(false);
  const [pendingRsvpShift, setPendingRsvpShift] = useState<Shift | null>(null);

  // View mode: 'cards' or 'list'
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('list');

  // Scheduling mode (SIMPLE or FULL)
  const [schedulingMode, setSchedulingMode] = useState<'SIMPLE' | 'FULL'>('SIMPLE');

  // Initialize filter from URL params
  useEffect(() => {
    if (searchParams.get('pending') === 'true') {
      setFilterPendingOnly(true);
    }
  }, [searchParams]);

  const fetchShifts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterType !== 'all') params.set('typeConfigId', filterType);
      if (filterZone !== 'all') params.set('zoneId', filterZone);
      if (filterStatus !== 'all') params.set('status', filterStatus);

      const res = await fetch(`/api/shifts?${params}`);
      if (!res.ok) throw new Error('Failed to fetch shifts');
      const data = await res.json();
      setShifts(data);
    } catch {
      setError('Failed to load shifts');
    }
  }, [filterType, filterZone, filterStatus]);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/session').then(res => res.json()),
      fetch('/api/zones').then(res => res.json()),
      fetch('/api/shift-types').then(res => res.json()).catch(() => []),
      fetch('/api/settings/public').then(res => res.json()).catch(() => ({ schedulingMode: 'SIMPLE', autoConfirmRsvp: false })),
      fetch('/api/coordinator/qualified-roles').then(res => res.json()).catch(() => []),
    ])
      .then(([sessionData, zonesData, shiftTypesData, settingsData, qualifiedRolesData]) => {
        if (!sessionData.user) {
          router.push('/login');
          return;
        }
        setUser(sessionData.user);
        if (Array.isArray(zonesData)) {
          setZones(zonesData);
        }
        if (Array.isArray(shiftTypesData)) {
          setShiftTypes(shiftTypesData);
        }
        if (Array.isArray(qualifiedRolesData)) {
          setQualifiedRoles(qualifiedRolesData);
        }
        if (settingsData?.schedulingMode) {
          setSchedulingMode(settingsData.schedulingMode);
        }
        if (settingsData?.autoConfirmRsvp !== undefined) {
          setAutoConfirmRsvp(settingsData.autoConfirmRsvp);
        }
        setIsLoading(false);
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchShifts();
    }
  }, [user, fetchShifts]);

  // Handle clicking the Sign Up button
  const handleSignUpClick = (shift: Shift) => {
    const qualifications = user?.qualifications || [];

    // If user has multiple qualifications, show picker
    if (qualifications.length > 1) {
      setPendingRsvpShift(shift);
      setShowQualificationPicker(true);
    } else {
      // If 0 or 1 qualification, sign up directly (qualification may be null or the single one)
      handleRsvp(shift.id, qualifications[0] || null);
    }
  };

  // Perform the actual RSVP with optional qualification
  const handleRsvp = async (shiftId: string, qualification: Qualification | null) => {
    setRsvpingShiftId(shiftId);
    setError(null);

    try {
      const res = await fetch(`/api/shifts/${shiftId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qualification }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to sign up');
      }

      // Refresh shifts to show updated status
      await fetchShifts();

      // Close the qualification picker if it was open
      setShowQualificationPicker(false);
      setPendingRsvpShift(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setRsvpingShiftId(null);
    }
  };

  // Handle qualification selection from picker
  const handleQualificationSelect = (qualification: Qualification) => {
    if (pendingRsvpShift) {
      handleRsvp(pendingRsvpShift.id, qualification);
    }
  };

  const handleCancelRsvp = async (shiftId: string) => {
    setRsvpingShiftId(shiftId);
    setError(null);

    try {
      const res = await fetch(`/api/shifts/${shiftId}/rsvp`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel');
      }

      await fetchShifts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setRsvpingShiftId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const formatOpts: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York',
    };
    return `${start.toLocaleTimeString('en-US', formatOpts)} - ${end.toLocaleTimeString('en-US', formatOpts)}`;
  };


  const handleCancelShifts = async (reason: string) => {
    setIsCancelling(true);
    setError(null);

    try {
      const res = await fetch('/api/shifts/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftIds: Array.from(selectedShifts),
          reason: reason || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel shifts');
      }

      // Refresh shifts and clear selection
      await fetchShifts();
      clearSelection();
      setShowCancelModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel shifts');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleConfirmRsvps = async () => {
    setIsConfirming(true);
    setError(null);

    try {
      const res = await fetch('/api/shifts/confirm-rsvps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftIds: Array.from(selectedShifts),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to confirm RSVPs');
      }

      // Refresh shifts and clear selection
      await fetchShifts();
      clearSelection();
      setShowConfirmModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm RSVPs');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleBulkEdit = async (editData: BulkEditData) => {
    setIsEditing(true);
    setError(null);

    try {
      const res = await fetch('/api/shifts/bulk-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftIds: Array.from(selectedShifts),
          ...editData,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update shifts');
      }

      // Refresh shifts and clear selection
      await fetchShifts();
      clearSelection();
      setShowBulkEditModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update shifts');
    } finally {
      setIsEditing(false);
    }
  };

  const handleBulkPublish = async () => {
    setIsPublishing(true);
    setError(null);

    try {
      const res = await fetch('/api/shifts/bulk-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftIds: Array.from(selectedShifts),
          status: 'PUBLISHED',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to publish shifts');
      }

      // Refresh shifts and clear selection
      await fetchShifts();
      clearSelection();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish shifts');
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  const canCreateShift = user.role === 'COORDINATOR' || user.role === 'DISPATCHER' || user.role === 'ADMINISTRATOR' || user.role === 'DEVELOPER';

  // Filter shifts by pending RSVPs and/or exceptions if enabled
  let filteredShifts = shifts;
  if (filterPendingOnly) {
    filteredShifts = filteredShifts.filter(shift => shift.pendingCount > 0);
  }
  if (filterExceptionsOnly) {
    // Show shifts with unreviewed exceptions
    filteredShifts = filteredShifts.filter(shift =>
      shift.hasRoleException && !shift.exceptionReviewedAt
    );
  }

  return (
    <>
      {/* Guided Tour */}
      {user && (
        <GuidedTour
          pageName="shifts"
          userRole={user.role}
          autoStart={true}
        />
      )}

    <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage Shifts</h1>
            <p className="text-gray-600">Create, delete, and edit shifts here</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/shifts/calendar"
              className="px-4 py-3 sm:py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-center"
            >
              Calendar View
            </Link>
            {canCreateShift && (
              <>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-4 py-3 sm:py-2 border border-cyan-600 text-cyan-600 rounded-lg hover:bg-cyan-50 transition-colors font-medium text-center"
                  title="Import clinic schedule from .docx file"
                >
                  Import Schedule
                </button>
                <Link
                  href="/shifts/create"
                  className="px-4 py-3 sm:py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium text-center"
                >
                  + Create Shift
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Selection Toolbar (Coordinator only) */}
        {canCreateShift && selectedCount > 0 && (
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-6 flex items-center justify-between" data-tour="bulk-actions">
            <div className="flex items-center gap-4">
              <span className="font-medium text-gray-700">
                {selectedCount} shift{selectedCount > 1 ? 's' : ''} selected
              </span>
              <span className="text-xs text-gray-500">(Shift+click to select range)</span>
              <button
                onClick={clearSelection}
                className="text-sm text-gray-600 hover:text-gray-800 underline"
              >
                Clear selection
              </button>
            </div>
            <div className="flex items-center gap-3">
              {/* Show pending count for selected shifts */}
              {(() => {
                const pendingCount = shifts
                  .filter(s => isShiftSelected(s.id))
                  .reduce((sum, s) => sum + s.pendingCount, 0);
                return pendingCount > 0 ? (
                  <button
                    onClick={() => setShowConfirmModal(true)}
                    className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
                  >
                    Confirm {pendingCount} Pending
                  </button>
                ) : null;
              })()}
              {/* Show publish button for draft shifts */}
              {(() => {
                const draftCount = shifts
                  .filter(s => isShiftSelected(s.id) && s.status === 'DRAFT')
                  .length;
                return draftCount > 0 ? (
                  <button
                    onClick={handleBulkPublish}
                    disabled={isPublishing}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                  >
                    {isPublishing ? 'Publishing...' : `Publish ${draftCount} Draft${draftCount > 1 ? 's' : ''}`}
                  </button>
                ) : null;
              })()}
              <button
                onClick={() => setShowBulkEditModal(true)}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
              >
                Edit Selected
              </button>
              <button
                onClick={() => setShowCancelModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Cancel Selected
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6" data-tour="shift-filters">
          <div className="flex flex-wrap gap-4 items-end justify-between">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shift Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="all">All Types</option>
                  {shiftTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
                <select
                  value={filterZone}
                  onChange={(e) => setFilterZone(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="all">All Zones</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </div>
              {canCreateShift && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      filterStatus === 'DRAFT' ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
                    }`}
                  >
                    <option value="PUBLISHED">Published</option>
                    <option value="DRAFT">Drafts</option>
                    <option value="all">All Statuses</option>
                  </select>
                </div>
              )}
              {canCreateShift && !autoConfirmRsvp && (
                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterPendingOnly}
                      onChange={(e) => setFilterPendingOnly(e.target.checked)}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className={`text-sm font-medium ${filterPendingOnly ? 'text-orange-600' : 'text-gray-700'}`}>
                      Pending RSVPs only
                    </span>
                  </label>
                </div>
              )}
              {canCreateShift && (
                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterExceptionsOnly}
                      onChange={(e) => setFilterExceptionsOnly(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                    />
                    <span className={`text-sm font-medium ${filterExceptionsOnly ? 'text-amber-600' : 'text-gray-700'}`}>
                      Exceptions only
                    </span>
                  </label>
                </div>
              )}
            </div>
            {/* View Toggle - Hidden on mobile (cards forced) */}
            <div className="hidden lg:flex border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                title="List View"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                title="Card View"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Shifts Display */}
        {filteredShifts.length > 0 ? (
          <>
            {/* List View - Hidden on mobile/tablet, shown when viewMode is 'list' on desktop */}
            {viewMode === 'list' && (
            <div className="hidden lg:block bg-white rounded-xl border border-gray-200 overflow-hidden" data-tour="shift-list">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {canCreateShift && (
                      <th className="w-10 px-3 py-3">
                        <input
                          type="checkbox"
                          checked={allShiftsSelected}
                          onChange={() => allShiftsSelected ? clearSelection() : selectAllShifts()}
                          className="w-4 h-4 text-red-600 rounded focus:ring-red-500 cursor-pointer"
                          title={allShiftsSelected ? 'Deselect all' : 'Select all'}
                        />
                      </th>
                    )}
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Shift</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Zone</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Spots</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="w-32 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredShifts.map((shift) => (
                    <tr
                      key={shift.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        shift.status === 'CANCELLED' ? 'bg-red-50/50 text-gray-500' : ''
                      } ${isShiftSelected(shift.id) ? 'bg-red-50' : ''}`}
                    >
                      {canCreateShift && (
                        <td className="px-3 py-3">
                          {shift.status !== 'CANCELLED' && (
                            <input
                              type="checkbox"
                              checked={isShiftSelected(shift.id)}
                              onClick={(e) => toggleShiftSelection(shift.id, e)}
                              onChange={() => {}} // Controlled by onClick for shift+click support
                              className="w-4 h-4 text-red-600 rounded focus:ring-red-500 cursor-pointer"
                            />
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                        {formatDate(shift.date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {formatTime(shift.startTime, shift.endTime)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/shifts/${shift.id}`}
                            className="text-sm font-medium text-gray-900 hover:text-cyan-600 transition-colors"
                          >
                            {shift.title}
                          </Link>
                          {/* Exception indicator for coordinators */}
                          {shift.hasRoleException && !shift.exceptionReviewedAt && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium"
                              title={shift.exceptionNotes || 'Role requirements not met'}
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{shift.zone?.name || 'No zone'}</td>
                      <td className="px-4 py-3">
                        {shift.status === 'CANCELLED' ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                            Cancelled
                          </span>
                        ) : (
                          <span
                            className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                            style={{
                              backgroundColor: shift.typeConfig?.color ? `${shift.typeConfig.color}20` : '#e5e7eb',
                              color: shift.typeConfig?.color || '#374151',
                            }}
                          >
                            {getShiftTypeName(shift)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm ${shift.spotsLeft <= 1 && shift.status !== 'CANCELLED' ? 'text-orange-600 font-medium' : 'text-gray-600'}`}>
                          {shift.confirmedCount}/{shift.maxVolunteers}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {shift.status === 'CANCELLED' ? (
                          <span className="text-xs text-red-600">Cancelled</span>
                        ) : shift.userRsvpStatus ? (
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            shift.userRsvpStatus === 'CONFIRMED'
                              ? 'bg-cyan-100 text-cyan-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {shift.userRsvpStatus === 'CONFIRMED' ? 'Confirmed' : 'Pending'}
                          </span>
                        ) : shift.spotsLeft > 0 ? (
                          <span className="text-xs text-gray-500">Open</span>
                        ) : (
                          <span className="text-xs text-gray-400">Full</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {shift.status === 'CANCELLED' ? null : shift.userRsvpStatus ? (
                          <button
                            onClick={() => handleCancelRsvp(shift.id)}
                            disabled={rsvpingShiftId === shift.id}
                            className="text-xs text-gray-600 hover:text-red-600 transition-colors disabled:opacity-50"
                          >
                            {rsvpingShiftId === shift.id ? '...' : 'Cancel'}
                          </button>
                        ) : null}
                        {canCreateShift && shift.status !== 'CANCELLED' && (
                          <>
                            <Link
                              href={`/shifts/${shift.id}/edit`}
                              className="ml-2 text-xs text-gray-600 hover:text-gray-800"
                            >
                              Edit
                            </Link>
                            <Link
                              href={`/shifts/${shift.id}/roster`}
                              className="ml-2 text-xs text-cyan-600 hover:text-cyan-700"
                            >
                              Roster{shift.pendingCount > 0 && ` (${shift.pendingCount})`}
                            </Link>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}

            {/* Card View - Always shown on mobile/tablet, shown when viewMode is 'cards' on desktop */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${viewMode === 'list' ? 'lg:hidden' : ''}`}>
              {filteredShifts.map((shift) => (
                <div
                  key={shift.id}
                  className={`bg-white rounded-xl border p-5 hover:shadow-md transition-shadow ${
                    shift.status === 'CANCELLED'
                      ? 'border-red-300 bg-red-50 opacity-75'
                      : isShiftSelected(shift.id)
                      ? 'border-red-400 ring-2 ring-red-200'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      {/* Checkbox for coordinators (non-cancelled shifts only) */}
                      {canCreateShift && shift.status !== 'CANCELLED' && (
                        <input
                          type="checkbox"
                          checked={isShiftSelected(shift.id)}
                          onClick={(e) => toggleShiftSelection(shift.id, e)}
                          onChange={() => {}} // Controlled by onClick for shift+click support
                          className="w-4 h-4 text-red-600 rounded focus:ring-red-500 cursor-pointer"
                        />
                      )}
                      {shift.status === 'CANCELLED' ? (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                          Cancelled
                        </span>
                      ) : (
                        <span
                          className="px-2 py-1 rounded text-xs font-medium"
                          style={{
                            backgroundColor: shift.typeConfig?.color ? `${shift.typeConfig.color}20` : '#e5e7eb',
                            color: shift.typeConfig?.color || '#374151',
                          }}
                        >
                          {getShiftTypeName(shift)}
                        </span>
                      )}
                    </div>
                    <span className={`text-sm ${shift.spotsLeft <= 1 ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>
                      {shift.spotsLeft}/{shift.maxVolunteers} spots
                    </span>
                  </div>

                  <Link href={`/shifts/${shift.id}`} className="block group">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 group-hover:text-cyan-600 transition-colors">
                        {shift.title}
                      </h3>
                      {/* Exception indicator for coordinators */}
                      {shift.hasRoleException && !shift.exceptionReviewedAt && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium"
                          title={shift.exceptionNotes || 'Role requirements not met'}
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </Link>
                  <p className="text-sm text-gray-500 mb-3">{shift.zone?.name || 'No zone'}</p>

                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{formatDate(shift.date)}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{formatTime(shift.startTime, shift.endTime)}</span>
                  </div>

                  {/* Show different UI based on shift status */}
                  {shift.status === 'CANCELLED' ? (
                    <div className="text-center py-2 px-4 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
                      This shift has been cancelled
                    </div>
                  ) : shift.userRsvpStatus ? (
                    <div className="space-y-2">
                      <div className={`text-center py-2 px-4 rounded-lg text-sm font-medium ${
                        shift.userRsvpStatus === 'CONFIRMED'
                          ? 'bg-cyan-100 text-cyan-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {shift.userRsvpStatus === 'CONFIRMED' ? 'Confirmed' : 'Pending Confirmation'}
                      </div>
                      <button
                        onClick={() => handleCancelRsvp(shift.id)}
                        disabled={rsvpingShiftId === shift.id}
                        className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        {rsvpingShiftId === shift.id ? 'Canceling...' : 'Cancel RSVP'}
                      </button>
                    </div>
                  ) : null}

                  {/* Coordinator: Edit and Manage links (not for cancelled shifts) */}
                  {canCreateShift && shift.status !== 'CANCELLED' && (
                    <div className="flex gap-3 mt-2">
                      <Link
                        href={`/shifts/${shift.id}/edit`}
                        className="flex-1 text-center text-sm text-gray-600 hover:text-gray-800 py-1 border border-gray-300 rounded"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/shifts/${shift.id}/roster`}
                        className="flex-1 text-center text-sm text-cyan-600 hover:text-cyan-700 py-1 border border-cyan-300 rounded"
                      >
                        Roster {shift.pendingCount > 0 && `(${shift.pendingCount})`}
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            {schedulingMode === 'SIMPLE' && !canCreateShift && !user?.qualifications?.some(q => q === 'DISPATCHER' || q === 'ZONE_LEAD') ? (
              <>
                <p className="text-gray-600 mb-2 font-medium">Shift signup is currently restricted to qualified leads.</p>
                <p className="text-gray-500 text-sm">
                  Contact your coordinator to be assigned to shifts or to complete zone lead training.
                </p>
              </>
            ) : (
              <>
                <p className="text-gray-500 mb-4">No shifts available matching your filters.</p>
                {canCreateShift && (
                  <Link
                    href="/shifts/create"
                    className="inline-block px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
                  >
                    Create First Shift
                  </Link>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      <CancelModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelShifts}
        selectedCount={selectedCount}
        isSubmitting={isCancelling}
      />

      {/* Confirm RSVPs Modal */}
      <ConfirmRsvpsModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmRsvps}
        selectedCount={selectedCount}
        pendingRsvpCount={shifts
          .filter(s => isShiftSelected(s.id))
          .reduce((sum, s) => sum + s.pendingCount, 0)}
        isSubmitting={isConfirming}
      />

      {/* Qualification Picker Modal */}
      <QualificationPickerModal
        isOpen={showQualificationPicker}
        onClose={() => {
          setShowQualificationPicker(false);
          setPendingRsvpShift(null);
        }}
        onSelect={handleQualificationSelect}
        qualifications={user?.qualifications || []}
        qualifiedRoles={qualifiedRoles}
        shiftTitle={pendingRsvpShift?.title || ''}
        isSubmitting={rsvpingShiftId !== null}
      />

      {/* Bulk Edit Modal */}
      <BulkEditModal
        isOpen={showBulkEditModal}
        onClose={() => setShowBulkEditModal(false)}
        onConfirm={handleBulkEdit}
        selectedCount={selectedCount}
        isSubmitting={isEditing}
        shiftTypes={shiftTypes}
      />

      {/* Import Schedule Modal */}
      <ImportScheduleModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => setFilterStatus('DRAFT')} // Switch to drafts view to show imported shifts
        zones={zones}
        shiftTypes={shiftTypes}
      />
    </div>
    </>
  );
}

export default function ShiftsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    }>
      <ShiftsPageContent />
    </Suspense>
  );
}
