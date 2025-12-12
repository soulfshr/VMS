'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { DevUser } from '@/types/auth';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import GuidedTour from '@/components/onboarding/GuidedTour';

interface Zone {
  id: string;
  name: string;
  county: string | null;
  isPrimary?: boolean;
}

interface Training {
  id: string;
  name: string;
  slug: string;
  completedAt: string | null;
}

interface UpcomingShift {
  id: string;
  title: string;
  date: string;
  isZoneLead: boolean;
}

interface QualifiedRole {
  id: string;
  name: string;
  slug: string;
  color: string;
}

interface Volunteer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  primaryLanguage: string;
  otherLanguages: string[];
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  lastLoginAt?: string | null;  // Only available for developers
  qualifiedRoles: QualifiedRole[];
  zones: Zone[];
  completedTrainings: Training[];
  upcomingShifts: UpcomingShift[];
  totalConfirmedShifts: number;
}

interface VolunteersData {
  volunteers: Volunteer[];
  zones: Zone[];
  qualifiedRoles: QualifiedRole[];
  total: number;
}

interface ImportResult {
  success: boolean;
  created: number;
  updated: number;
  errors: { row: number; email: string; error: string }[];
  total: number;
}

// Field definitions for volunteer import with column mapping
interface ImportFieldDefinition {
  key: string;
  label: string;
  required: boolean;
  description: string;
}

const IMPORT_FIELD_DEFINITIONS: ImportFieldDefinition[] = [
  { key: 'name', label: 'Name', required: true, description: 'Full name of the volunteer' },
  { key: 'email', label: 'Email', required: true, description: 'Email address (must be unique)' },
  { key: 'phone', label: 'Phone or Signal Handle', required: false, description: 'Phone number or Signal handle' },
  { key: 'role', label: 'User Type', required: false, description: 'User type: VOLUNTEER, COORDINATOR, DISPATCHER, ADMINISTRATOR' },
  { key: 'primaryLanguage', label: 'Primary Language', required: false, description: 'Primary language (default: English)' },
  { key: 'zones', label: 'Zones', required: false, description: 'Zone names (semicolon-separated)' },
  { key: 'qualifications', label: 'Qualifications', required: false, description: 'Qualifications (semicolon-separated)' },
];

export default function VolunteersPage() {
  const router = useRouter();
  const [user, setUser] = useState<DevUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VolunteersData | null>(null);
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [expandedVolunteer, setExpandedVolunteer] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [editingQualifications, setEditingQualifications] = useState<string | null>(null);
  const [updatingQualifications, setUpdatingQualifications] = useState<string | null>(null);

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'mapping' | 'importing' | 'results'>('upload');
  const [importData, setImportData] = useState<string>('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add volunteer modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingVolunteer, setAddingVolunteer] = useState(false);
  const [addVolunteerForm, setAddVolunteerForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'VOLUNTEER',
    zoneId: '',
    primaryLanguage: 'English',
    qualifiedRoleIds: [] as string[],
  });
  const [addVolunteerError, setAddVolunteerError] = useState<string | null>(null);

  // Bulk action state
  const [showBulkActionModal, setShowBulkActionModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<'activate' | 'deactivate' | 'delete' | null>(null);
  const [isBulkActioning, setIsBulkActioning] = useState(false);

  // Edit volunteer modal state (for single volunteer editing)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingVolunteerId, setEditingVolunteerId] = useState<string | null>(null);
  const [editVolunteerForm, setEditVolunteerForm] = useState({
    name: '',
    email: '',
    phone: '',
    primaryLanguage: 'English',
    otherLanguages: [] as string[],
  });
  const [editVolunteerError, setEditVolunteerError] = useState<string | null>(null);
  const [savingVolunteerEdit, setSavingVolunteerEdit] = useState(false);

  // Bulk edit state
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditForm, setBulkEditForm] = useState<{
    role: string;
    addQualifiedRoles: string[];
    removeQualifiedRoles: string[];
    addZones: string[];
    removeZones: string[];
  }>({
    role: '',
    addQualifiedRoles: [],
    removeQualifiedRoles: [],
    addZones: [],
    removeZones: [],
  });

  // Multi-select with shift+click support
  const volunteers = data?.volunteers ?? [];
  const {
    selectedIds: selectedVolunteers,
    isSelected: isVolunteerSelected,
    toggleSelection: toggleVolunteerSelection,
    selectAll,
    clearSelection,
    selectedCount,
  } = useMultiSelect({
    items: volunteers,
    getId: (volunteer) => volunteer.id,
  });

  // Check authentication
  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (!data.user) {
          router.push('/login');
        } else if (!['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'].includes(data.user.role)) {
          router.push('/dashboard');
        } else {
          setUser(data.user);
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  // Fetch volunteers
  const fetchVolunteers = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (zoneFilter !== 'all') params.set('zone', zoneFilter);
      if (roleFilter !== 'all') params.set('role', roleFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/volunteers?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch volunteers');
      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching volunteers:', error);
    } finally {
      setLoading(false);
    }
  }, [user, search, zoneFilter, roleFilter, statusFilter]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchVolunteers();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchVolunteers]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMINISTRATOR':
        return 'bg-red-100 text-red-800';
      case 'COORDINATOR':
        return 'bg-purple-100 text-purple-800';
      case 'DISPATCHER':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Handle role change
  const handleRoleChange = async (volunteerId: string, newRole: string) => {
    if (!user || !['ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) return;

    setUpdatingRole(volunteerId);
    try {
      const res = await fetch(`/api/volunteers/${volunteerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        // Update local state
        setData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            volunteers: prev.volunteers.map(v =>
              v.id === volunteerId ? { ...v, role: newRole } : v
            ),
          };
        });
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to update role');
      }
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Failed to update role');
    } finally {
      setUpdatingRole(null);
    }
  };

  // Handle active status toggle
  const handleToggleActive = async (volunteerId: string, isActive: boolean) => {
    if (!user || !['ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) return;

    try {
      const res = await fetch(`/api/volunteers/${volunteerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });

      if (res.ok) {
        setData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            volunteers: prev.volunteers.map(v =>
              v.id === volunteerId ? { ...v, isActive } : v
            ),
          };
        });
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // Handle qualified role toggle
  const handleQualifiedRoleToggle = async (volunteerId: string, qualifiedRoleId: string, currentRoles: QualifiedRole[]) => {
    if (!user || !['ADMINISTRATOR', 'COORDINATOR', 'DISPATCHER'].includes(user.role)) return;

    setUpdatingQualifications(volunteerId);
    const currentIds = currentRoles.map(r => r.id);
    const newIds = currentIds.includes(qualifiedRoleId)
      ? currentIds.filter(id => id !== qualifiedRoleId)
      : [...currentIds, qualifiedRoleId];

    try {
      const res = await fetch(`/api/volunteers/${volunteerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qualifiedRoleIds: newIds }),
      });

      if (res.ok) {
        const result = await res.json();
        setData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            volunteers: prev.volunteers.map(v =>
              v.id === volunteerId ? { ...v, qualifiedRoles: result.qualifiedRoles } : v
            ),
          };
        });
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to update qualified roles');
      }
    } catch (error) {
      console.error('Error updating qualified roles:', error);
      alert('Failed to update qualified roles');
    } finally {
      setUpdatingQualifications(null);
    }
  };

  // Parse CSV text into headers and rows (handles quoted fields)
  const parseCSVRaw = (csvText: string): { headers: string[]; rows: string[][] } => {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseRow = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseRow(lines[0]);
    const rows = lines.slice(1).map(parseRow);

    return { headers, rows };
  };

  // Auto-map columns based on common header variations
  const autoMapColumns = (headers: string[]): Record<string, string> => {
    const mapping: Record<string, string> = {};
    const headerLower = headers.map(h => h.toLowerCase().replace(/[\s_-]/g, ''));

    IMPORT_FIELD_DEFINITIONS.forEach(field => {
      const fieldLower = field.key.toLowerCase();
      const labelLower = field.label.toLowerCase().replace(/[\s_-]/g, '');

      // Try to find matching header
      const matchIndex = headerLower.findIndex(h => {
        // Exact matches
        if (h === fieldLower || h === labelLower) return true;
        // Common variations
        if (field.key === 'name' && (h === 'fullname' || h === 'volunteername')) return true;
        if (field.key === 'email' && (h === 'emailaddress' || h === 'mail')) return true;
        if (field.key === 'phone' && (h === 'phonenumber' || h === 'signal' || h === 'signalhandle')) return true;
        if (field.key === 'primaryLanguage' && (h === 'language' || h === 'lang')) return true;
        if (field.key === 'zones' && (h === 'zone' || h === 'area')) return true;
        if (field.key === 'qualifications' && (h === 'qualification' || h === 'quals')) return true;
        return false;
      });

      if (matchIndex !== -1) {
        mapping[field.key] = headers[matchIndex];
      }
    });

    return mapping;
  };

  // Parse CSV data using column mapping
  const parseCSVWithMapping = (headers: string[], rows: string[][], mapping: Record<string, string>) => {
    const volunteers = [];

    for (let i = 0; i < rows.length; i++) {
      const values = rows[i];
      const volunteer: Record<string, string | string[]> = {};

      IMPORT_FIELD_DEFINITIONS.forEach(field => {
        const csvColumn = mapping[field.key];
        if (csvColumn) {
          const colIndex = headers.indexOf(csvColumn);
          const value = colIndex !== -1 ? (values[colIndex] || '') : '';

          if (field.key === 'zones') {
            // Support both semicolons and colons as separators
            volunteer.zones = value.split(/[;:]/).map(z => z.trim()).filter(Boolean);
          } else if (field.key === 'qualifications') {
            // Support both semicolons and colons as separators, fix common typos
            volunteer.qualifications = value.split(/[;:]/).map(q => {
              const upper = q.trim().toUpperCase();
              // Fix common typos
              if (upper === 'DIPSATCHER') return 'DISPATCHER';
              return upper;
            }).filter(Boolean);
          } else if (field.key === 'role') {
            volunteer.role = value.toUpperCase();
          } else {
            volunteer[field.key] = value;
          }
        }
      });

      if (volunteer.email && volunteer.name) {
        volunteers.push(volunteer);
      }
    }

    return volunteers;
  };

  // Legacy parse function for backward compatibility
  const parseCSV = (csvText: string) => {
    const { headers, rows } = parseCSVRaw(csvText);
    const mapping = autoMapColumns(headers);
    return parseCSVWithMapping(headers, rows, mapping);
  };

  // Handle file upload and proceed to mapping step
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportData(text);
      proceedToMapping(text);
    };
    reader.readAsText(file);
  };

  // Process CSV and proceed to column mapping step
  const proceedToMapping = (csvText: string) => {
    const { headers, rows } = parseCSVRaw(csvText);

    if (headers.length === 0 || rows.length === 0) {
      alert('No valid data found in the CSV file');
      return;
    }

    setCsvHeaders(headers);
    setCsvRows(rows);

    // Auto-map columns
    const autoMapping = autoMapColumns(headers);
    setColumnMapping(autoMapping);

    setImportStep('mapping');
  };

  // Handle bulk import using column mapping
  const handleImport = async () => {
    // Validate required mappings
    const requiredFields = IMPORT_FIELD_DEFINITIONS.filter(f => f.required);
    const missingFields = requiredFields.filter(f => !columnMapping[f.key]);
    if (missingFields.length > 0) {
      alert(`Please map these required columns: ${missingFields.map(f => f.label).join(', ')}`);
      return;
    }

    setImporting(true);
    setImportStep('importing');
    setImportResult(null);

    try {
      const volunteers = parseCSVWithMapping(csvHeaders, csvRows, columnMapping);
      if (volunteers.length === 0) {
        alert('No valid volunteers found in the CSV data');
        setImporting(false);
        setImportStep('mapping');
        return;
      }

      const res = await fetch('/api/volunteers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volunteers }),
      });

      const result = await res.json();
      setImportResult(result);
      setImportStep('results');

      if (result.created > 0 || result.updated > 0) {
        fetchVolunteers();
      }
    } catch (error) {
      console.error('Error importing volunteers:', error);
      alert('Failed to import volunteers');
      setImportStep('mapping');
    } finally {
      setImporting(false);
    }
  };

  // Close import modal and reset
  const closeImportModal = () => {
    setShowImportModal(false);
    setImportStep('upload');
    setImportData('');
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMapping({});
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle adding a single volunteer
  const handleAddVolunteer = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingVolunteer(true);
    setAddVolunteerError(null);

    try {
      const volunteerData = {
        name: addVolunteerForm.name,
        email: addVolunteerForm.email,
        phone: addVolunteerForm.phone || undefined,
        role: addVolunteerForm.role,
        primaryLanguage: addVolunteerForm.primaryLanguage,
        zones: addVolunteerForm.zoneId ? [data?.zones.find(z => z.id === addVolunteerForm.zoneId)?.name || ''] : [],
        qualifications: addVolunteerForm.qualifiedRoleIds.map(id => data?.qualifiedRoles.find(qr => qr.id === id)?.slug || '').filter(Boolean),
      };

      const res = await fetch('/api/volunteers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volunteers: [volunteerData] }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to add volunteer');
      }

      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors[0].error);
      }

      // Success - close modal and refresh list
      setShowAddModal(false);
      setAddVolunteerForm({
        name: '',
        email: '',
        phone: '',
        role: 'VOLUNTEER',
        zoneId: '',
        primaryLanguage: 'English',
        qualifiedRoleIds: [],
      });
      fetchVolunteers();
    } catch (error) {
      setAddVolunteerError(error instanceof Error ? error.message : 'Failed to add volunteer');
    } finally {
      setAddingVolunteer(false);
    }
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setAddVolunteerForm({
      name: '',
      email: '',
      phone: '',
      role: 'VOLUNTEER',
      zoneId: '',
      primaryLanguage: 'English',
      qualifiedRoleIds: [],
    });
    setAddVolunteerError(null);
  };

  // Bulk action handler
  const handleBulkAction = async () => {
    if (!bulkAction || selectedCount === 0) return;

    setIsBulkActioning(true);
    try {
      const selectedIds = Array.from(selectedVolunteers);

      if (bulkAction === 'activate' || bulkAction === 'deactivate') {
        // Update active status for all selected
        const isActive = bulkAction === 'activate';
        await Promise.all(
          selectedIds.map(id =>
            fetch(`/api/volunteers/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isActive }),
            })
          )
        );
      } else if (bulkAction === 'delete') {
        // Delete all selected volunteers
        await Promise.all(
          selectedIds.map(id =>
            fetch(`/api/volunteers/${id}`, {
              method: 'DELETE',
            })
          )
        );
      }

      // Refresh data and clear selection
      await fetchVolunteers();
      clearSelection();
      setShowBulkActionModal(false);
      setBulkAction(null);
    } catch (error) {
      console.error('Bulk action failed:', error);
      alert('Failed to complete bulk action');
    } finally {
      setIsBulkActioning(false);
    }
  };

  const openBulkActionModal = (action: 'activate' | 'deactivate' | 'delete') => {
    setBulkAction(action);
    setShowBulkActionModal(true);
  };

  // Open edit modal for a single volunteer
  const openEditModal = (volunteer: Volunteer) => {
    setEditingVolunteerId(volunteer.id);
    setEditVolunteerForm({
      name: volunteer.name,
      email: volunteer.email,
      phone: volunteer.phone || '',
      primaryLanguage: volunteer.primaryLanguage,
      otherLanguages: volunteer.otherLanguages || [],
    });
    setEditVolunteerError(null);
    setShowEditModal(true);
  };

  // Close edit modal
  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingVolunteerId(null);
    setEditVolunteerForm({
      name: '',
      email: '',
      phone: '',
      primaryLanguage: 'English',
      otherLanguages: [],
    });
    setEditVolunteerError(null);
  };

  // Save volunteer edit
  const handleSaveVolunteerEdit = async () => {
    if (!editingVolunteerId) return;

    setSavingVolunteerEdit(true);
    setEditVolunteerError(null);

    try {
      const res = await fetch(`/api/volunteers/${editingVolunteerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editVolunteerForm.name,
          email: editVolunteerForm.email,
          phone: editVolunteerForm.phone || null,
          primaryLanguage: editVolunteerForm.primaryLanguage,
          otherLanguages: editVolunteerForm.otherLanguages,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update volunteer');
      }

      // Update local state
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          volunteers: prev.volunteers.map(v =>
            v.id === editingVolunteerId
              ? {
                  ...v,
                  name: editVolunteerForm.name,
                  email: editVolunteerForm.email,
                  phone: editVolunteerForm.phone || null,
                  primaryLanguage: editVolunteerForm.primaryLanguage,
                  otherLanguages: editVolunteerForm.otherLanguages,
                }
              : v
          ),
        };
      });

      closeEditModal();
    } catch (error) {
      setEditVolunteerError(error instanceof Error ? error.message : 'Failed to update volunteer');
    } finally {
      setSavingVolunteerEdit(false);
    }
  };

  // Bulk edit handler
  const handleBulkEdit = async () => {
    if (selectedCount === 0) return;

    // Check if any changes were made
    const hasChanges = bulkEditForm.role ||
      bulkEditForm.addQualifiedRoles.length > 0 ||
      bulkEditForm.removeQualifiedRoles.length > 0 ||
      bulkEditForm.addZones.length > 0 ||
      bulkEditForm.removeZones.length > 0;

    if (!hasChanges) {
      alert('Please select at least one change to apply');
      return;
    }

    setIsBulkEditing(true);
    try {
      const selectedIds = Array.from(selectedVolunteers);

      // Process each selected volunteer
      const updates = selectedIds.map(async (id) => {
        const volunteer = volunteers.find(v => v.id === id);
        if (!volunteer) return;

        const updateData: Record<string, unknown> = {};

        // Update role if specified
        if (bulkEditForm.role) {
          updateData.role = bulkEditForm.role;
        }

        // Update qualified roles if specified
        if (bulkEditForm.addQualifiedRoles.length > 0 || bulkEditForm.removeQualifiedRoles.length > 0) {
          const currentIds = volunteer.qualifiedRoles.map(r => r.id);
          let newIds = [...currentIds];

          // Add new roles
          bulkEditForm.addQualifiedRoles.forEach(roleId => {
            if (!newIds.includes(roleId)) {
              newIds.push(roleId);
            }
          });

          // Remove roles
          newIds = newIds.filter(id => !bulkEditForm.removeQualifiedRoles.includes(id));

          updateData.qualifiedRoleIds = newIds;
        }

        // Update zones if specified
        if (bulkEditForm.addZones.length > 0 || bulkEditForm.removeZones.length > 0) {
          const currentZoneIds = volunteer.zones.map(z => z.id);
          let newZoneIds = [...currentZoneIds];

          // Add new zones
          bulkEditForm.addZones.forEach(zoneId => {
            if (!newZoneIds.includes(zoneId)) {
              newZoneIds.push(zoneId);
            }
          });

          // Remove zones
          newZoneIds = newZoneIds.filter(id => !bulkEditForm.removeZones.includes(id));

          updateData.zoneIds = newZoneIds;
        }

        if (Object.keys(updateData).length > 0) {
          await fetch(`/api/volunteers/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData),
          });
        }
      });

      await Promise.all(updates);

      // Refresh data and clear selection
      await fetchVolunteers();
      clearSelection();
      setShowBulkEditModal(false);
      resetBulkEditForm();
    } catch (error) {
      console.error('Bulk edit failed:', error);
      alert('Failed to update some volunteers');
    } finally {
      setIsBulkEditing(false);
    }
  };

  const resetBulkEditForm = () => {
    setBulkEditForm({
      role: '',
      addQualifiedRoles: [],
      removeQualifiedRoles: [],
      addZones: [],
      removeZones: [],
    });
  };

  const openBulkEditModal = () => {
    resetBulkEditForm();
    setShowBulkEditModal(true);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  const isAdmin = ['ADMINISTRATOR', 'DEVELOPER'].includes(user.role);
  const isDeveloper = user.role === 'DEVELOPER';
  const canEditQualifications = ['ADMINISTRATOR', 'COORDINATOR', 'DISPATCHER'].includes(user.role);

  return (
    <>
      {/* Guided Tour */}
      {user && (
        <GuidedTour
          pageName="volunteers"
          userRole={user.role}
          autoStart={true}
        />
      )}

    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Volunteer Roster</h1>
            <p className="text-gray-600 mt-1">
              View and manage all volunteers across the organization
            </p>
          </div>
          {isAdmin && (
            <div className="mt-4 md:mt-0 flex gap-3">
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Volunteer
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2 border border-cyan-600 text-cyan-600 rounded-lg hover:bg-cyan-50 transition-colors flex items-center gap-2"
                data-tour="bulk-import"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Import CSV
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6" data-tour="volunteer-filters">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="lg:col-span-2" data-tour="volunteer-search">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, email, or phone..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              />
            </div>

            {/* Zone filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
              <select
                value={zoneFilter}
                onChange={e => setZoneFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              >
                <option value="all">All Zones</option>
                {data?.zones.map(zone => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>

            {/* User Type filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User Type</label>
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              >
                <option value="all">All User Types</option>
                <option value="VOLUNTEER">Volunteer</option>
                <option value="COORDINATOR">Coordinator</option>
                <option value="DISPATCHER">Dispatcher</option>
                <option value="ADMINISTRATOR">Administrator</option>
              </select>
            </div>

            {/* Status filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-3xl font-bold text-cyan-600">{data.total}</p>
              <p className="text-sm text-gray-600">Total Volunteers</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-3xl font-bold text-green-600">
                {data.volunteers.filter(v => v.isActive).length}
              </p>
              <p className="text-sm text-gray-600">Active</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-3xl font-bold text-blue-600">
                {data.volunteers.filter(v => v.completedTrainings.some(t => t.slug === 'DISPATCHER')).length}
              </p>
              <p className="text-sm text-gray-600">Qualified Dispatchers</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-3xl font-bold text-purple-600">
                {data.volunteers.filter(v => v.completedTrainings.some(t => t.slug === 'ZONE_LEAD')).length}
              </p>
              <p className="text-sm text-gray-600">Qualified Zone Leads</p>
            </div>
          </div>
        )}

        {/* Selection Toolbar (Admin only) - Sticky when scrolling */}
        {isAdmin && selectedCount > 0 && (
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-6 flex items-center justify-between sticky top-[100px] z-30 shadow-md">
            <div className="flex items-center gap-4">
              <span className="font-medium text-gray-700">
                {selectedCount} volunteer{selectedCount > 1 ? 's' : ''} selected
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
              <button
                onClick={openBulkEditModal}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Selected
              </button>
              <button
                onClick={() => openBulkActionModal('activate')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
              >
                Activate
              </button>
              <button
                onClick={() => openBulkActionModal('deactivate')}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium text-sm"
              >
                Deactivate
              </button>
              <button
                onClick={() => openBulkActionModal('delete')}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Volunteer List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
          </div>
        ) : data && data.volunteers.length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden" data-tour="volunteer-row">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {isAdmin && (
                      <th className="w-10 px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedCount > 0 && selectedCount === volunteers.length}
                          onChange={() => {
                            if (selectedCount === volunteers.length) {
                              clearSelection();
                            } else {
                              selectAll();
                            }
                          }}
                          className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500 cursor-pointer"
                          title="Select all"
                        />
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Volunteer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email & Signal
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Zones
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qualified Roles
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shifts
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    {isDeveloper && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Login
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.volunteers.map(volunteer => (
                    <>
                      <tr
                        key={volunteer.id}
                        className={`hover:bg-gray-50 cursor-pointer ${!volunteer.isActive ? 'opacity-60' : ''} ${isVolunteerSelected(volunteer.id) ? 'bg-cyan-50' : ''}`}
                        onClick={() => setExpandedVolunteer(expandedVolunteer === volunteer.id ? null : volunteer.id)}
                      >
                        {isAdmin && (
                          <td className="px-3 py-4" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isVolunteerSelected(volunteer.id)}
                              onClick={(e) => toggleVolunteerSelection(volunteer.id, e)}
                              onChange={() => {}} // Controlled by onClick for shift+click support
                              className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-cyan-600 text-white flex items-center justify-center text-sm font-medium">
                              {volunteer.name.charAt(0)}
                            </div>
                            <div className="ml-4">
                              <div className="font-medium text-gray-900">{volunteer.name}</div>
                              <span className="text-xs text-gray-500">{volunteer.primaryLanguage}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{volunteer.email}</div>
                          {volunteer.phone && (
                            <div className="text-sm text-gray-500">{volunteer.phone}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          {isAdmin ? (
                            <select
                              value={volunteer.role}
                              onChange={e => handleRoleChange(volunteer.id, e.target.value)}
                              disabled={updatingRole === volunteer.id || volunteer.id === user.id}
                              className={`px-2 py-1 rounded text-xs font-medium border-0 cursor-pointer ${getRoleBadgeColor(volunteer.role)} ${
                                updatingRole === volunteer.id ? 'opacity-50' : ''
                              } ${volunteer.id === user.id ? 'cursor-not-allowed' : ''}`}
                              title={volunteer.id === user.id ? 'Cannot change your own role' : 'Change role'}
                            >
                              <option value="VOLUNTEER">VOLUNTEER</option>
                              <option value="COORDINATOR">COORDINATOR</option>
                              <option value="DISPATCHER">DISPATCHER</option>
                              <option value="ADMINISTRATOR">ADMINISTRATOR</option>
                            </select>
                          ) : (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(volunteer.role)}`}>
                              {volunteer.role}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {volunteer.zones.length > 0 ? (
                              volunteer.zones.map(zone => (
                                <span
                                  key={zone.id}
                                  className={`px-2 py-0.5 rounded text-xs ${
                                    zone.isPrimary
                                      ? 'bg-cyan-100 text-cyan-800 font-medium'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  {zone.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-500 text-sm">No zones</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                          {canEditQualifications && editingQualifications === volunteer.id ? (
                            <div className="space-y-2">
                              {(data?.qualifiedRoles || []).map(qr => (
                                <label key={qr.id} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={(volunteer.qualifiedRoles || []).some(r => r.id === qr.id)}
                                    onChange={() => handleQualifiedRoleToggle(volunteer.id, qr.id, volunteer.qualifiedRoles || [])}
                                    disabled={updatingQualifications === volunteer.id}
                                    className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500"
                                  />
                                  <span
                                    className="px-2 py-0.5 rounded text-xs"
                                    style={{
                                      backgroundColor: `${qr.color}20`,
                                      color: qr.color,
                                    }}
                                  >
                                    {qr.name}
                                  </span>
                                </label>
                              ))}
                              <button
                                onClick={() => setEditingQualifications(null)}
                                className="text-xs text-gray-500 hover:text-gray-700"
                              >
                                Done
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {(volunteer.qualifiedRoles || []).length > 0 ? (
                                (volunteer.qualifiedRoles || []).map(qr => (
                                  <span
                                    key={qr.id}
                                    className="px-2 py-0.5 rounded text-xs"
                                    style={{
                                      backgroundColor: `${qr.color}20`,
                                      color: qr.color,
                                    }}
                                  >
                                    {qr.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-500 text-sm">None</span>
                              )}
                              {canEditQualifications && (
                                <button
                                  onClick={() => setEditingQualifications(volunteer.id)}
                                  className="ml-1 text-gray-400 hover:text-cyan-600"
                                  title="Edit qualified roles"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="text-sm font-medium text-gray-900">
                            {volunteer.totalConfirmedShifts}
                          </div>
                          <div className="text-xs text-gray-500">completed</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center" onClick={e => e.stopPropagation()}>
                          {isAdmin ? (
                            <button
                              onClick={() => handleToggleActive(volunteer.id, !volunteer.isActive)}
                              className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                                volunteer.isActive
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-red-100 text-red-800 hover:bg-red-200'
                              }`}
                            >
                              {volunteer.isActive ? 'Active' : 'Inactive'}
                            </button>
                          ) : (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              volunteer.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {volunteer.isActive ? 'Active' : 'Inactive'}
                            </span>
                          )}
                        </td>
                        {isDeveloper && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {volunteer.lastLoginAt
                              ? new Date(volunteer.lastLoginAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })
                              : <span className="text-gray-500">Never</span>
                            }
                          </td>
                        )}
                      </tr>
                      {/* Expanded Details */}
                      {expandedVolunteer === volunteer.id && (
                        <tr key={`${volunteer.id}-details`}>
                          <td colSpan={isAdmin ? 8 : (isDeveloper ? 8 : 7)} className="px-6 py-4 bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* Upcoming Shifts */}
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Upcoming Shifts</h4>
                                {volunteer.upcomingShifts.length > 0 ? (
                                  <ul className="space-y-1">
                                    {volunteer.upcomingShifts.map(shift => (
                                      <li key={shift.id} className="text-sm">
                                        <Link
                                          href={`/shifts/${shift.id}`}
                                          className="text-cyan-600 hover:text-cyan-800"
                                          onClick={e => e.stopPropagation()}
                                        >
                                          {shift.title}
                                        </Link>
                                        <span className="text-gray-500 ml-2">
                                          {formatDate(shift.date)}
                                        </span>
                                        {shift.isZoneLead && (
                                          <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                                            Zone Lead
                                          </span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-gray-500">No upcoming shifts</p>
                                )}
                              </div>

                              {/* Additional Info */}
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Additional Info</h4>
                                <div className="space-y-1 text-sm">
                                  <p>
                                    <span className="text-gray-500">Languages:</span>{' '}
                                    {[volunteer.primaryLanguage, ...volunteer.otherLanguages].join(', ')}
                                  </p>
                                  <p>
                                    <span className="text-gray-500">Member since:</span>{' '}
                                    {formatDate(volunteer.createdAt)}
                                  </p>
                                  <p>
                                    <span className="text-gray-500">Verified:</span>{' '}
                                    {volunteer.isVerified ? 'Yes' : 'No'}
                                  </p>
                                </div>
                              </div>

                              {/* Quick Actions */}
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Actions</h4>
                                <div className="space-y-2">
                                  {isAdmin && (
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        openEditModal(volunteer);
                                      }}
                                      className="w-full px-3 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 flex items-center justify-center gap-2"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                      </svg>
                                      Edit Details
                                    </button>
                                  )}
                                  <a
                                    href={`mailto:${volunteer.email}`}
                                    className="block px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-center"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    Send Email
                                  </a>
                                  {volunteer.phone && (
                                    <a
                                      href={`tel:${volunteer.phone}`}
                                      className="block px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-center"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      Call
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <p className="text-gray-500">No volunteers found matching your filters.</p>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Import Volunteers</h2>
                <button
                  onClick={closeImportModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Progress indicator */}
              <div className="mb-6">
                <div className="flex items-center gap-2">
                  {['Upload', 'Map Columns', 'Import'].map((stepName, i) => {
                    const stepKeys = ['upload', 'mapping', 'importing'];
                    const currentIndex = stepKeys.indexOf(importStep);
                    const isActive = i === currentIndex || (importStep === 'results' && i === 2);
                    const isComplete = i < currentIndex || importStep === 'results';
                    return (
                      <div key={stepName} className="flex items-center">
                        {i > 0 && <div className={`w-8 h-0.5 ${isComplete || isActive ? 'bg-cyan-600' : 'bg-gray-200'}`} />}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                          isActive ? 'bg-cyan-600 text-white' : isComplete ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-200 text-gray-500'
                        }`}>
                          {isComplete && !isActive ? '✓' : i + 1}
                        </div>
                      </div>
                    );
                  })}
                  <span className="ml-3 text-sm text-gray-600">
                    {importStep === 'upload' && 'Upload CSV'}
                    {importStep === 'mapping' && 'Map Columns'}
                    {importStep === 'importing' && 'Importing...'}
                    {importStep === 'results' && 'Complete'}
                  </span>
                </div>
              </div>

              {/* Step 1: Upload */}
              {importStep === 'upload' && (
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">
                      Upload a CSV file or paste CSV data. You&apos;ll be able to map columns in the next step.
                    </p>
                  </div>

                  {/* Download Template */}
                  <div className="mb-4 p-3 bg-cyan-50 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-cyan-800">Need a template?</p>
                      <p className="text-xs text-cyan-600">Download a CSV template with example data</p>
                    </div>
                    <button
                      onClick={() => {
                        const template = `name,email,phone,role,primaryLanguage,zones,qualifications
John Doe,john.doe@example.com,919-555-1234,VOLUNTEER,English,Durham Zone 1;Durham Zone 2,VERIFIER
Maria Garcia,maria.garcia@example.com,919-555-5678,COORDINATOR,Spanish,Wake Zone 1,VERIFIER;ZONE_LEAD
James Wilson,james.wilson@example.com,919-555-9012,VOLUNTEER,English,Orange Zone 1,
Ana Martinez,ana.martinez@example.com,919-555-3456,DISPATCHER,Spanish,Durham Zone 3,DISPATCHER;VERIFIER
Michael Chen,michael.chen@example.com,919-555-7890,VOLUNTEER,Mandarin,Wake Zone 2,VERIFIER`;
                        const blob = new Blob([template], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'volunteer_import_template.csv';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="px-3 py-1.5 bg-cyan-600 text-white text-sm rounded-lg hover:bg-cyan-700 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download Template
                    </button>
                  </div>

                  {/* File Upload */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Upload CSV File</label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100"
                    />
                  </div>

                  {/* Or paste data */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Or Paste CSV Data</label>
                    <textarea
                      value={importData}
                      onChange={e => setImportData(e.target.value)}
                      placeholder={`name,email,phone,role,primaryLanguage,zones
John Doe,john@example.com,555-1234,VOLUNTEER,English,Zone 1;Zone 2
Jane Smith,jane@example.com,555-5678,COORDINATOR,Spanish,Zone 3`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 font-mono text-sm"
                      rows={8}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={closeImportModal}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => proceedToMapping(importData)}
                      disabled={!importData.trim()}
                      className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Continue to Mapping →
                    </button>
                  </div>
                </>
              )}

              {/* Step 2: Column Mapping */}
              {importStep === 'mapping' && (
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600">
                      Match your CSV columns to the volunteer fields. Required fields are marked with *.
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Found {csvRows.length} rows with {csvHeaders.length} columns
                    </p>
                  </div>

                  {/* Column mapping grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    {IMPORT_FIELD_DEFINITIONS.map(field => (
                      <div key={field.key} className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-700">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <select
                          value={columnMapping[field.key] || ''}
                          onChange={(e) => setColumnMapping(prev => ({
                            ...prev,
                            [field.key]: e.target.value,
                          }))}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                        >
                          <option value="">-- Select column --</option>
                          {csvHeaders.map(header => (
                            <option key={header} value={header}>{header}</option>
                          ))}
                        </select>
                        <span className="text-xs text-gray-500">{field.description}</span>
                      </div>
                    ))}
                  </div>

                  {/* Preview of first few rows */}
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Data Preview (first 3 rows)</h3>
                    <div className="bg-gray-50 rounded-lg p-3 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-gray-500">
                            {csvHeaders.map(h => (
                              <th key={h} className="pb-2 pr-4 whitespace-nowrap font-medium">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="text-gray-700 font-mono">
                          {csvRows.slice(0, 3).map((row, i) => (
                            <tr key={i} className="border-t border-gray-200">
                              {row.map((cell, j) => (
                                <td key={j} className="py-1 pr-4 whitespace-nowrap max-w-[150px] truncate">
                                  {cell || <span className="text-gray-300">—</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setImportStep('upload')}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={!columnMapping.name || !columnMapping.email}
                      className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Import {csvRows.length} Volunteers
                    </button>
                  </div>
                </>
              )}

              {/* Step 3: Importing */}
              {importStep === 'importing' && (
                <div className="py-8 text-center">
                  <div className="animate-spin w-12 h-12 border-4 border-cyan-600 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-gray-600">Importing volunteers...</p>
                  <p className="text-sm text-gray-500 mt-1">This may take a moment</p>
                </div>
              )}

              {/* Step 4: Results */}
              {importStep === 'results' && importResult && (
                <>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-green-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-green-600">{importResult.created}</p>
                        <p className="text-sm text-green-700">Created</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-blue-600">{importResult.updated}</p>
                        <p className="text-sm text-blue-700">Updated</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-red-600">{importResult.errors.length}</p>
                        <p className="text-sm text-red-700">Errors</p>
                      </div>
                    </div>

                    {importResult.errors.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Errors:</h3>
                        <div className="bg-red-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                          {importResult.errors.map((err, idx) => (
                            <p key={idx} className="text-sm text-red-700">
                              Row {err.row} ({err.email}): {err.error}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={closeImportModal}
                      className="w-full px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
                    >
                      Done
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Confirmation Modal */}
      {showBulkActionModal && bulkAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {bulkAction === 'activate' && 'Activate Volunteers'}
              {bulkAction === 'deactivate' && 'Deactivate Volunteers'}
              {bulkAction === 'delete' && 'Delete Volunteers'}
            </h2>
            <p className="text-gray-600 mb-4">
              {bulkAction === 'activate' && `Are you sure you want to activate ${selectedCount} volunteer${selectedCount > 1 ? 's' : ''}?`}
              {bulkAction === 'deactivate' && `Are you sure you want to deactivate ${selectedCount} volunteer${selectedCount > 1 ? 's' : ''}?`}
              {bulkAction === 'delete' && (
                <span className="text-red-600">
                  Are you sure you want to permanently delete {selectedCount} volunteer{selectedCount > 1 ? 's' : ''}? This action cannot be undone.
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBulkActionModal(false);
                  setBulkAction(null);
                }}
                disabled={isBulkActioning}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAction}
                disabled={isBulkActioning}
                className={`flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50 ${
                  bulkAction === 'delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : bulkAction === 'deactivate'
                    ? 'bg-yellow-600 hover:bg-yellow-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isBulkActioning ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Volunteer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Add Volunteer</h2>
                <button
                  onClick={closeAddModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Add a new volunteer to the system. They will receive an email to set their password.
              </p>

              {addVolunteerError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {addVolunteerError}
                </div>
              )}

              <form onSubmit={handleAddVolunteer} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={addVolunteerForm.name}
                    onChange={(e) => setAddVolunteerForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    placeholder="John Doe"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={addVolunteerForm.email}
                    onChange={(e) => setAddVolunteerForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    placeholder="john@example.com"
                  />
                </div>

                {/* Phone or Signal */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone or Signal Handle
                  </label>
                  <input
                    type="text"
                    value={addVolunteerForm.phone}
                    onChange={(e) => setAddVolunteerForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    placeholder="919-555-1234 or @signal_handle"
                  />
                </div>

                {/* User Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    User Type
                  </label>
                  <select
                    value={addVolunteerForm.role}
                    onChange={(e) => setAddVolunteerForm(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  >
                    <option value="VOLUNTEER">Volunteer</option>
                    <option value="COORDINATOR">Coordinator</option>
                    <option value="DISPATCHER">Dispatcher</option>
                    <option value="ADMINISTRATOR">Administrator</option>
                  </select>
                </div>

                {/* Zone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Primary Zone
                  </label>
                  <select
                    value={addVolunteerForm.zoneId}
                    onChange={(e) => setAddVolunteerForm(prev => ({ ...prev, zoneId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  >
                    <option value="">No zone assigned</option>
                    {data?.zones.map(zone => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Primary Language */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Primary Language
                  </label>
                  <select
                    value={addVolunteerForm.primaryLanguage}
                    onChange={(e) => setAddVolunteerForm(prev => ({ ...prev, primaryLanguage: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  >
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="Mandarin">Mandarin</option>
                    <option value="French">French</option>
                    <option value="Vietnamese">Vietnamese</option>
                    <option value="Arabic">Arabic</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Qualifications */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Qualifications
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Select the shift positions this volunteer is qualified for.
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {(data?.qualifiedRoles || []).map(qr => (
                      <label key={qr.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={addVolunteerForm.qualifiedRoleIds.includes(qr.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAddVolunteerForm(prev => ({
                                ...prev,
                                qualifiedRoleIds: [...prev.qualifiedRoleIds, qr.id]
                              }));
                            } else {
                              setAddVolunteerForm(prev => ({
                                ...prev,
                                qualifiedRoleIds: prev.qualifiedRoleIds.filter(id => id !== qr.id)
                              }));
                            }
                          }}
                          className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                        />
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor: qr.color ? `${qr.color}20` : '#e5e7eb',
                            color: qr.color || '#374151'
                          }}
                        >
                          {qr.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Submit buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeAddModal}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingVolunteer}
                    className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addingVolunteer ? 'Adding...' : 'Add Volunteer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Volunteer Modal (Admin only - edit name, phone, languages) */}
      {showEditModal && editingVolunteerId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Edit Volunteer Details</h2>
                <button
                  onClick={closeEditModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {editVolunteerError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {editVolunteerError}
                </div>
              )}

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editVolunteerForm.name}
                    onChange={(e) => setEditVolunteerForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={editVolunteerForm.email}
                    onChange={(e) => setEditVolunteerForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">This is the volunteer&apos;s login email</p>
                </div>

                {/* Phone or Signal */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone or Signal Handle
                  </label>
                  <input
                    type="text"
                    value={editVolunteerForm.phone}
                    onChange={(e) => setEditVolunteerForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    placeholder="919-555-1234 or @signal_handle"
                  />
                </div>

                {/* Primary Language */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Primary Language
                  </label>
                  <select
                    value={editVolunteerForm.primaryLanguage}
                    onChange={(e) => setEditVolunteerForm(prev => ({ ...prev, primaryLanguage: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  >
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="Mandarin">Mandarin</option>
                    <option value="French">French</option>
                    <option value="Vietnamese">Vietnamese</option>
                    <option value="Arabic">Arabic</option>
                    <option value="Korean">Korean</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Other Languages */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Other Languages
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {editVolunteerForm.otherLanguages.map((lang, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded"
                      >
                        {lang}
                        <button
                          type="button"
                          onClick={() => setEditVolunteerForm(prev => ({
                            ...prev,
                            otherLanguages: prev.otherLanguages.filter((_, i) => i !== idx)
                          }))}
                          className="text-gray-500 hover:text-red-600"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value && !editVolunteerForm.otherLanguages.includes(e.target.value)) {
                        setEditVolunteerForm(prev => ({
                          ...prev,
                          otherLanguages: [...prev.otherLanguages, e.target.value]
                        }));
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  >
                    <option value="">Add another language...</option>
                    {['English', 'Spanish', 'Mandarin', 'French', 'Vietnamese', 'Arabic', 'Korean', 'Hindi', 'Other']
                      .filter(lang => lang !== editVolunteerForm.primaryLanguage && !editVolunteerForm.otherLanguages.includes(lang))
                      .map(lang => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))
                    }
                  </select>
                </div>

                {/* Submit buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    disabled={savingVolunteerEdit}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveVolunteerEdit}
                    disabled={savingVolunteerEdit || !editVolunteerForm.name.trim() || !editVolunteerForm.email.trim()}
                    className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingVolunteerEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Edit {selectedCount} Volunteer{selectedCount > 1 ? 's' : ''}
                </h2>
                <button
                  onClick={() => setShowBulkEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-6">
                Select the changes you want to apply to all selected volunteers. Leave fields empty to keep their current values.
              </p>

              <div className="space-y-6">
                {/* User Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Change User Type
                  </label>
                  <select
                    value={bulkEditForm.role}
                    onChange={(e) => setBulkEditForm(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  >
                    <option value="">-- No change --</option>
                    <option value="VOLUNTEER">Volunteer</option>
                    <option value="COORDINATOR">Coordinator</option>
                    <option value="DISPATCHER">Dispatcher</option>
                    <option value="ADMINISTRATOR">Administrator</option>
                  </select>
                </div>

                {/* Qualified Roles - Add */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add Qualified Roles
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {(data?.qualifiedRoles || []).map(qr => (
                      <label
                        key={qr.id}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                          bulkEditForm.addQualifiedRoles.includes(qr.id)
                            ? 'bg-cyan-50 border-2 border-cyan-500'
                            : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={bulkEditForm.addQualifiedRoles.includes(qr.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBulkEditForm(prev => ({
                                ...prev,
                                addQualifiedRoles: [...prev.addQualifiedRoles, qr.id],
                                removeQualifiedRoles: prev.removeQualifiedRoles.filter(id => id !== qr.id),
                              }));
                            } else {
                              setBulkEditForm(prev => ({
                                ...prev,
                                addQualifiedRoles: prev.addQualifiedRoles.filter(id => id !== qr.id),
                              }));
                            }
                          }}
                          className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500"
                        />
                        <span
                          className="text-sm font-medium"
                          style={{ color: qr.color }}
                        >
                          {qr.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Qualified Roles - Remove */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Remove Qualified Roles
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {(data?.qualifiedRoles || []).map(qr => (
                      <label
                        key={qr.id}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                          bulkEditForm.removeQualifiedRoles.includes(qr.id)
                            ? 'bg-red-50 border-2 border-red-500'
                            : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={bulkEditForm.removeQualifiedRoles.includes(qr.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBulkEditForm(prev => ({
                                ...prev,
                                removeQualifiedRoles: [...prev.removeQualifiedRoles, qr.id],
                                addQualifiedRoles: prev.addQualifiedRoles.filter(id => id !== qr.id),
                              }));
                            } else {
                              setBulkEditForm(prev => ({
                                ...prev,
                                removeQualifiedRoles: prev.removeQualifiedRoles.filter(id => id !== qr.id),
                              }));
                            }
                          }}
                          className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                        />
                        <span
                          className="text-sm font-medium"
                          style={{ color: qr.color }}
                        >
                          {qr.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Zones - Add */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add Zones
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                    {(data?.zones || []).map(zone => (
                      <label
                        key={zone.id}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                          bulkEditForm.addZones.includes(zone.id)
                            ? 'bg-cyan-50 border-2 border-cyan-500'
                            : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={bulkEditForm.addZones.includes(zone.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBulkEditForm(prev => ({
                                ...prev,
                                addZones: [...prev.addZones, zone.id],
                                removeZones: prev.removeZones.filter(id => id !== zone.id),
                              }));
                            } else {
                              setBulkEditForm(prev => ({
                                ...prev,
                                addZones: prev.addZones.filter(id => id !== zone.id),
                              }));
                            }
                          }}
                          className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500"
                        />
                        <span className="text-sm text-gray-700">{zone.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Zones - Remove */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Remove Zones
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                    {(data?.zones || []).map(zone => (
                      <label
                        key={zone.id}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                          bulkEditForm.removeZones.includes(zone.id)
                            ? 'bg-red-50 border-2 border-red-500'
                            : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={bulkEditForm.removeZones.includes(zone.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBulkEditForm(prev => ({
                                ...prev,
                                removeZones: [...prev.removeZones, zone.id],
                                addZones: prev.addZones.filter(id => id !== zone.id),
                              }));
                            } else {
                              setBulkEditForm(prev => ({
                                ...prev,
                                removeZones: prev.removeZones.filter(id => id !== zone.id),
                              }));
                            }
                          }}
                          className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                        />
                        <span className="text-sm text-gray-700">{zone.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Summary of changes */}
                {(bulkEditForm.role || bulkEditForm.addQualifiedRoles.length > 0 || bulkEditForm.removeQualifiedRoles.length > 0 || bulkEditForm.addZones.length > 0 || bulkEditForm.removeZones.length > 0) && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Changes to Apply:</h3>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {bulkEditForm.role && (
                        <li>• Set user type to: <span className="font-medium">{bulkEditForm.role}</span></li>
                      )}
                      {bulkEditForm.addQualifiedRoles.length > 0 && (
                        <li>• Add qualified roles: <span className="font-medium text-cyan-600">
                          {bulkEditForm.addQualifiedRoles.map(id => data?.qualifiedRoles.find(qr => qr.id === id)?.name).join(', ')}
                        </span></li>
                      )}
                      {bulkEditForm.removeQualifiedRoles.length > 0 && (
                        <li>• Remove qualified roles: <span className="font-medium text-red-600">
                          {bulkEditForm.removeQualifiedRoles.map(id => data?.qualifiedRoles.find(qr => qr.id === id)?.name).join(', ')}
                        </span></li>
                      )}
                      {bulkEditForm.addZones.length > 0 && (
                        <li>• Add zones: <span className="font-medium text-cyan-600">
                          {bulkEditForm.addZones.map(id => data?.zones.find(z => z.id === id)?.name).join(', ')}
                        </span></li>
                      )}
                      {bulkEditForm.removeZones.length > 0 && (
                        <li>• Remove zones: <span className="font-medium text-red-600">
                          {bulkEditForm.removeZones.map(id => data?.zones.find(z => z.id === id)?.name).join(', ')}
                        </span></li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowBulkEditModal(false);
                    resetBulkEditForm();
                  }}
                  disabled={isBulkEditing}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkEdit}
                  disabled={isBulkEditing || (!bulkEditForm.role && bulkEditForm.addQualifiedRoles.length === 0 && bulkEditForm.removeQualifiedRoles.length === 0 && bulkEditForm.addZones.length === 0 && bulkEditForm.removeZones.length === 0)}
                  className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBulkEditing ? 'Applying Changes...' : `Apply to ${selectedCount} Volunteer${selectedCount > 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
