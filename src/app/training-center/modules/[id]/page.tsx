'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// HTML escape function for XSS prevention in markdown rendering
function escapeHtml(str: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  };
  return str.replace(/[&<>"']/g, (char) => escapeMap[char] || char);
}

type SectionType = 'VIDEO' | 'TEXT' | 'QUIZ' | 'RESOURCE' | 'ATTESTATION';

interface QuizOption {
  id: string;
  optionText: string;
  isCorrect: boolean;
  sortOrder: number;
}

interface QuizQuestion {
  id: string;
  questionText: string;
  type: string;
  points: number;
  sortOrder: number;
  explanation: string | null;
  options: QuizOption[];
}

interface Quiz {
  id: string;
  passingScore: number;
  maxAttempts: number | null;
  shuffleQuestions: boolean;
  questions: QuizQuestion[];
}

interface Section {
  id: string;
  title: string;
  type: SectionType;
  sortOrder: number;
  videoUrl: string | null;
  videoDuration: number | null;
  textContent: string | null;
  resourceUrl: string | null;
  resourceName: string | null;
  attestationText: string | null;
  quiz: Quiz | null;
}

interface QualifiedRole {
  id: string;
  name: string;
  color?: string;
}

interface Enrollment {
  id: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  userId: string;
  startedAt: string | null;
  completedAt: string | null;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

interface TrainingModule {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  estimatedMinutes: number;
  isRequired: boolean;
  isPublished: boolean;
  sortOrder: number;
  grantsQualifiedRole: QualifiedRole | null; // DEPRECATED
  grantsQualifiedRoles: QualifiedRole[]; // NEW: Multiple roles
  sections: Section[];
  enrollments?: Enrollment[];
}

export default function ModuleEditorPage() {
  const params = useParams();
  const router = useRouter();
  const moduleId = params.id as string;

  const [trainingModule, setModule] = useState<TrainingModule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'sections' | 'learners'>('sections');

  // Reset modal state
  const [resetModal, setResetModal] = useState<{
    enrollment: Enrollment;
    revokeQualification: boolean;
  } | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Form state for module details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [isRequired, setIsRequired] = useState(false);

  // Qualified roles state
  const [availableRoles, setAvailableRoles] = useState<QualifiedRole[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  // Section creation state
  const [isAddingSectionType, setIsAddingSectionType] = useState<SectionType | null>(null);
  const [newSectionTitle, setNewSectionTitle] = useState('');

  const fetchModule = useCallback(async () => {
    try {
      const res = await fetch(`/api/training-center/modules/${moduleId}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/training-center/modules');
          return;
        }
        throw new Error('Failed to fetch module');
      }
      const data = await res.json();
      setModule(data.module);
      setTitle(data.module.title);
      setDescription(data.module.description || '');
      setEstimatedMinutes(data.module.estimatedMinutes);
      setIsRequired(data.module.isRequired);
      // Set selected role IDs from module's granted roles
      setSelectedRoleIds(data.module.grantsQualifiedRoles?.map((r: QualifiedRole) => r.id) || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load module');
    } finally {
      setIsLoading(false);
    }
  }, [moduleId, router]);

  useEffect(() => {
    fetchModule();
  }, [fetchModule]);

  // Fetch available qualified roles
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await fetch('/api/admin/qualified-roles');
        if (res.ok) {
          const data = await res.json();
          setAvailableRoles(data.filter((r: QualifiedRole & { isActive?: boolean }) => r.isActive !== false));
        }
      } catch (err) {
        console.error('Failed to fetch qualified roles:', err);
      }
    };
    fetchRoles();
  }, []);

  const handleSaveDetails = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/training-center/modules/${moduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          estimatedMinutes,
          isRequired,
          grantsQualifiedRoleIds: selectedRoleIds,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      await fetchModule();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSection = async () => {
    if (!isAddingSectionType || !newSectionTitle.trim()) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/training-center/modules/${moduleId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newSectionTitle,
          type: isAddingSectionType,
        }),
      });
      if (!res.ok) throw new Error('Failed to create section');
      setNewSectionTitle('');
      setIsAddingSectionType(null);
      await fetchModule();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create section');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('Delete this section?')) return;

    try {
      const res = await fetch(`/api/training-center/modules/${moduleId}/sections/${sectionId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete section');
      await fetchModule();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete section');
    }
  };

  const handleMoveSection = async (sectionId: string, direction: 'up' | 'down') => {
    if (!trainingModule) return;

    const sections = [...trainingModule.sections].sort((a, b) => a.sortOrder - b.sortOrder);
    const currentIndex = sections.findIndex(s => s.id === sectionId);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= sections.length) return;

    // Swap sort orders
    const currentSection = sections[currentIndex];
    const targetSection = sections[targetIndex];

    try {
      await Promise.all([
        fetch(`/api/training-center/modules/${moduleId}/sections/${currentSection.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sortOrder: targetSection.sortOrder }),
        }),
        fetch(`/api/training-center/modules/${moduleId}/sections/${targetSection.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sortOrder: currentSection.sortOrder }),
        }),
      ]);
      await fetchModule();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder');
    }
  };

  const handleTogglePublished = async () => {
    if (!trainingModule) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/training-center/modules/${moduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !trainingModule.isPublished }),
      });
      if (!res.ok) throw new Error('Failed to update');
      await fetchModule();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetEnrollment = async () => {
    if (!resetModal) return;

    setIsResetting(true);
    try {
      const url = `/api/training-center/modules/${moduleId}/enrollments/${resetModal.enrollment.id}${
        resetModal.revokeQualification ? '?revokeQualification=true' : ''
      }`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reset');
      }
      setResetModal(null);
      await fetchModule();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset enrollment');
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!trainingModule) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">Module not found</p>
        <Link href="/training-center/modules" className="text-sm text-red-600 hover:text-red-800 mt-2 inline-block">
          Back to modules
        </Link>
      </div>
    );
  }

  const sortedSections = [...trainingModule.sections].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/training-center/modules"
            className="text-gray-500 hover:text-gray-700"
          >
            ← Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{trainingModule.title}</h1>
            <p className="text-sm text-gray-500">
              {trainingModule.sections.length} sections • {trainingModule.estimatedMinutes} min
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 text-sm rounded-full ${
            trainingModule.isPublished
              ? 'bg-green-100 text-green-700'
              : 'bg-yellow-100 text-yellow-700'
          }`}>
            {trainingModule.isPublished ? 'Published' : 'Draft'}
          </span>
          <button
            onClick={handleTogglePublished}
            disabled={isSaving}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
          >
            {trainingModule.isPublished ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="text-sm text-red-600 hover:text-red-800 mt-1">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('sections')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'sections'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Sections
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Module Details
          </button>
          <button
            onClick={() => setActiveTab('learners')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'learners'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Learners {trainingModule.enrollments && trainingModule.enrollments.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                {trainingModule.enrollments.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Sections Tab */}
      {activeTab === 'sections' && (
        <div>
          {/* Add Section Buttons */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-3">Add Section</h3>
            {isAddingSectionType ? (
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSection()}
                  placeholder={`Enter ${isAddingSectionType.toLowerCase()} section title...`}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
                <button
                  onClick={handleAddSection}
                  disabled={isSaving || !newSectionTitle.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setIsAddingSectionType(null);
                    setNewSectionTitle('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => setIsAddingSectionType('VIDEO')}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                >
                  <span>📹</span>
                  <span className="text-sm font-medium">Video</span>
                </button>
                <button
                  onClick={() => setIsAddingSectionType('TEXT')}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                >
                  <span>📝</span>
                  <span className="text-sm font-medium">Text</span>
                </button>
                <button
                  onClick={() => setIsAddingSectionType('QUIZ')}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                >
                  <span>❓</span>
                  <span className="text-sm font-medium">Quiz</span>
                </button>
                <button
                  onClick={() => setIsAddingSectionType('RESOURCE')}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                >
                  <span>📁</span>
                  <span className="text-sm font-medium">Resource</span>
                </button>
                <button
                  onClick={() => setIsAddingSectionType('ATTESTATION')}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                >
                  <span>✅</span>
                  <span className="text-sm font-medium">Attestation</span>
                </button>
              </div>
            )}
          </div>

          {/* Sections List */}
          {sortedSections.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <span className="text-4xl mb-4 block">📚</span>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No sections yet</h3>
              <p className="text-gray-500">Add video, text, or quiz sections to build your module</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedSections.map((section, index) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  moduleId={moduleId}
                  isFirst={index === 0}
                  isLast={index === sortedSections.length - 1}
                  onDelete={() => handleDeleteSection(section.id)}
                  onMoveUp={() => handleMoveSection(section.id, 'up')}
                  onMoveDown={() => handleMoveSection(section.id, 'down')}
                  onUpdate={fetchModule}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Details Tab */}
      {activeTab === 'details' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="space-y-4 max-w-xl">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Duration (minutes)</label>
              <input
                type="number"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(parseInt(e.target.value) || 0)}
                min={1}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isRequired"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <label htmlFor="isRequired" className="text-sm text-gray-700">
                Required module (must complete before signing up for shifts)
              </label>
            </div>

            {/* Grants Qualified Roles Multi-Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Grants Qualified Roles
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Select which roles volunteers earn upon completing this module
              </p>
              {availableRoles.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No qualified roles available</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {availableRoles.map(role => (
                    <label key={role.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRoleIds.includes(role.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRoleIds([...selectedRoleIds, role.id]);
                          } else {
                            setSelectedRoleIds(selectedRoleIds.filter(id => id !== role.id));
                          }
                        }}
                        className="w-4 h-4 text-purple-600 rounded"
                      />
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: role.color || '#6366f1' }}
                      />
                      <span className="text-sm">{role.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4">
              <button
                onClick={handleSaveDetails}
                disabled={isSaving}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Learners Tab */}
      {activeTab === 'learners' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {!trainingModule.enrollments || trainingModule.enrollments.length === 0 ? (
            <div className="p-12 text-center">
              <span className="text-4xl mb-4 block">👥</span>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No learners yet</h3>
              <p className="text-gray-500">Learners will appear here once they start the module</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Learner
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Started
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completed
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {trainingModule.enrollments.map((enrollment) => (
                    <tr key={enrollment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {enrollment.user?.name || 'Unknown'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {enrollment.user?.email || ''}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                          enrollment.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-700'
                            : enrollment.status === 'IN_PROGRESS'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {enrollment.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {enrollment.startedAt
                          ? new Date(enrollment.startedAt).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {enrollment.completedAt
                          ? new Date(enrollment.completedAt).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => setResetModal({ enrollment, revokeQualification: false })}
                          className="text-red-600 hover:text-red-800"
                        >
                          Reset Progress
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Reset Progress
            </h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to reset progress for{' '}
              <strong>{resetModal.enrollment.user?.name || 'this learner'}</strong>?
              This will delete all their section progress and quiz attempts for this module.
            </p>

            {(trainingModule.grantsQualifiedRoles?.length > 0 || trainingModule.grantsQualifiedRole) && (
              <label className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resetModal.revokeQualification}
                  onChange={(e) => setResetModal({
                    ...resetModal,
                    revokeQualification: e.target.checked,
                  })}
                  className="mt-0.5 w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Also revoke {trainingModule.grantsQualifiedRoles?.length > 0
                      ? `qualifications: ${trainingModule.grantsQualifiedRoles.map(r => r.name).join(', ')}`
                      : `"${trainingModule.grantsQualifiedRole?.name}" qualification`
                    }
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    This will remove the role{trainingModule.grantsQualifiedRoles?.length > 1 ? 's' : ''} granted by completing this module
                  </p>
                </div>
              </label>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setResetModal(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium"
                disabled={isResetting}
              >
                Cancel
              </button>
              <button
                onClick={handleResetEnrollment}
                disabled={isResetting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {isResetting ? 'Resetting...' : 'Reset Progress'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Section Card Component
function SectionCard({
  section,
  moduleId,
  isFirst,
  isLast,
  onDelete,
  onMoveUp,
  onMoveDown,
  onUpdate,
}: {
  section: Section;
  moduleId: string;
  isFirst: boolean;
  isLast: boolean;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdate: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit state
  const [editTitle, setEditTitle] = useState(section.title);
  const [editVideoUrl, setEditVideoUrl] = useState(section.videoUrl || '');
  const [editTextContent, setEditTextContent] = useState(section.textContent || '');
  const [editResourceUrl, setEditResourceUrl] = useState(section.resourceUrl || '');
  const [editResourceName, setEditResourceName] = useState(section.resourceName || '');
  const [editAttestationText, setEditAttestationText] = useState(section.attestationText || '');
  const [isUploading, setIsUploading] = useState(false);

  const sectionIcon = section.type === 'VIDEO' ? '📹' : section.type === 'TEXT' ? '📝' : section.type === 'RESOURCE' ? '📁' : section.type === 'ATTESTATION' ? '✅' : '❓';

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const body: Record<string, unknown> = { title: editTitle };
      if (section.type === 'VIDEO') {
        body.videoUrl = editVideoUrl || null;
      } else if (section.type === 'TEXT') {
        body.textContent = editTextContent || null;
      } else if (section.type === 'RESOURCE') {
        body.resourceUrl = editResourceUrl || null;
        body.resourceName = editResourceName || null;
      } else if (section.type === 'ATTESTATION') {
        body.attestationText = editAttestationText || null;
      }

      const res = await fetch(`/api/training-center/modules/${moduleId}/sections/${section.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save');
      setIsEditing(false);
      onUpdate();
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      alert('Please select a video file');
      return;
    }

    // Validate file size (100MB max)
    if (file.size > 100 * 1024 * 1024) {
      alert('Video must be under 100MB');
      return;
    }

    setIsUploading(true);
    try {
      // Request a presigned upload URL from our API
      const uploadRes = await fetch('/api/training-center/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          moduleId,
          size: file.size,
        }),
        credentials: 'include', // Ensure cookies are sent
      });

      if (!uploadRes.ok) {
        const text = await uploadRes.text();
        console.error('Upload init failed - status:', uploadRes.status, 'body:', text);
        let errorMsg = `Upload failed (${uploadRes.status})`;
        try {
          const errorData = JSON.parse(text);
          if (errorData.role) {
            errorMsg = `Your role is "${errorData.role}" but DEVELOPER is required`;
          } else if (errorData.error) {
            errorMsg = errorData.error;
          }
        } catch {
          // Response wasn't JSON
          errorMsg = `Upload failed: ${text.substring(0, 100)}`;
        }
        throw new Error(errorMsg);
      }

      const { key, uploadUrl } = await uploadRes.json();

      // Upload the file directly to S3 using the presigned URL
      const directUpload = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!directUpload.ok) {
        const text = await directUpload.text();
        console.error('Direct upload failed - status:', directUpload.status, 'body:', text);
        throw new Error('Failed to upload video to storage');
      }

      // Save the S3 key to the section
      setEditVideoUrl(key);

      // Auto-save to section
      const saveRes = await fetch(`/api/training-center/modules/${moduleId}/sections/${section.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: key }),
      });
      if (!saveRes.ok) throw new Error('Failed to save video');

      onUpdate();
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload video');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{sectionIcon}</span>
          <div>
            <h4 className="font-medium text-gray-900">{section.title}</h4>
            <p className="text-xs text-gray-500 capitalize">{section.type.toLowerCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Reorder buttons */}
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            disabled={isFirst}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
          >
            ↑
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            disabled={isLast}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
          >
            ↓
          </button>
          <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-100 p-4">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {section.type === 'VIDEO' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Video</label>
                  <div className="space-y-2">
                    {editVideoUrl && (
                      <div className="p-2 bg-green-50 text-green-700 text-sm rounded">
                        Video uploaded: {editVideoUrl.split('/').pop()}
                      </div>
                    )}
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      onChange={handleVideoUpload}
                      disabled={isUploading}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                    />
                    {isUploading && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <div className="animate-spin w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full" />
                        Uploading...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {section.type === 'TEXT' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content (Markdown supported)</label>
                  <textarea
                    value={editTextContent}
                    onChange={(e) => setEditTextContent(e.target.value)}
                    rows={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="# Heading&#10;&#10;Your content here..."
                  />
                </div>
              )}

              {section.type === 'QUIZ' && (
                <QuizBuilder
                  moduleId={moduleId}
                  sectionId={section.id}
                  quiz={section.quiz}
                  onUpdate={onUpdate}
                />
              )}

              {section.type === 'RESOURCE' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                    <input
                      type="text"
                      value={editResourceName}
                      onChange={(e) => setEditResourceName(e.target.value)}
                      placeholder="e.g., Safety Checklist PDF"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Resource URL</label>
                    <input
                      type="text"
                      value={editResourceUrl}
                      onChange={(e) => setEditResourceUrl(e.target.value)}
                      placeholder="https://example.com/document.pdf or S3 key"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter a URL to an external resource or upload a file to S3
                    </p>
                  </div>
                </div>
              )}

              {section.type === 'ATTESTATION' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Attestation Statement
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    The text users must acknowledge to complete this section
                  </p>
                  <textarea
                    value={editAttestationText}
                    onChange={(e) => setEditAttestationText(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="I have read and understood the material presented in this training module..."
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditTitle(section.title);
                    setEditVideoUrl(section.videoUrl || '');
                    setEditTextContent(section.textContent || '');
                    setEditResourceUrl(section.resourceUrl || '');
                    setEditResourceName(section.resourceName || '');
                    setEditAttestationText(section.attestationText || '');
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={onDelete}
                  className="ml-auto px-4 py-2 text-red-600 hover:text-red-800 text-sm"
                >
                  Delete Section
                </button>
              </div>
            </div>
          ) : (
            <div>
              {section.type === 'VIDEO' && (
                <div>
                  {section.videoUrl ? (
                    <div className="space-y-2">
                      <VideoPlayer videoKey={section.videoUrl} />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No video uploaded yet</p>
                  )}
                </div>
              )}

              {section.type === 'TEXT' && (
                <div>
                  {section.textContent ? (
                    <div className="prose prose-sm max-w-none">
                      <MarkdownRenderer content={section.textContent} />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No content yet</p>
                  )}
                </div>
              )}

              {section.type === 'QUIZ' && (
                <div>
                  {section.quiz ? (
                    <div className="text-sm text-gray-600">
                      {section.quiz.questions.length} questions • {section.quiz.passingScore}% to pass
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No quiz configured</p>
                  )}
                </div>
              )}

              {section.type === 'RESOURCE' && (
                <div>
                  {section.resourceUrl ? (
                    <a
                      href={section.resourceUrl.startsWith('http') ? section.resourceUrl : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                    >
                      <span>📁</span>
                      <span className="font-medium">{section.resourceName || 'Download Resource'}</span>
                      <span className="text-purple-500">↗</span>
                    </a>
                  ) : (
                    <p className="text-sm text-gray-500">No resource configured</p>
                  )}
                </div>
              )}

              {section.type === 'ATTESTATION' && (
                <div>
                  {section.attestationText ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{section.attestationText}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No attestation text configured</p>
                  )}
                </div>
              )}

              <button
                onClick={() => setIsEditing(true)}
                className="mt-4 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Edit Section
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Video Player Component
function VideoPlayer({ videoKey }: { videoKey: string }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUrl = async () => {
      try {
        const res = await fetch(`/api/training-center/video-url?key=${encodeURIComponent(videoKey)}`);
        if (!res.ok) throw new Error('Failed to get video URL');
        const data = await res.json();
        setVideoUrl(data.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load video');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUrl();
  }, [videoKey]);

  if (isLoading) {
    return (
      <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !videoUrl) {
    return (
      <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-sm text-gray-500">{error || 'Video unavailable'}</p>
      </div>
    );
  }

  return (
    <video
      src={videoUrl}
      controls
      className="w-full aspect-video rounded-lg bg-black"
    >
      Your browser does not support the video tag.
    </video>
  );
}

// Simple Markdown Renderer with XSS protection
function MarkdownRenderer({ content }: { content: string }) {
  // First escape HTML to prevent XSS, then apply markdown transformations
  const escaped = escapeHtml(content);
  const html = escaped
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/^\- (.*$)/gim, '<li class="ml-4">$1</li>')
    .replace(/\n/gim, '<br />');

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

// Quiz Builder Component
function QuizBuilder({
  moduleId,
  sectionId,
  quiz,
  onUpdate,
}: {
  moduleId: string;
  sectionId: string;
  quiz: Quiz | null;
  onUpdate: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showTemplate, setShowTemplate] = useState(false);

  // Quiz settings
  const [passingScore, setPassingScore] = useState(quiz?.passingScore ?? 80);
  const [maxAttempts, setMaxAttempts] = useState<number | null>(quiz?.maxAttempts ?? null);
  const [shuffleQuestions, setShuffleQuestions] = useState(quiz?.shuffleQuestions ?? false);

  // New question form
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MULTI_SELECT'>('MULTIPLE_CHOICE');
  const [newQuestionOptions, setNewQuestionOptions] = useState<{ text: string; isCorrect: boolean }[]>([
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ]);
  const [newQuestionExplanation, setNewQuestionExplanation] = useState('');

  // Editing question
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editQuestionText, setEditQuestionText] = useState('');
  const [editQuestionType, setEditQuestionType] = useState<'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MULTI_SELECT'>('MULTIPLE_CHOICE');
  const [editQuestionOptions, setEditQuestionOptions] = useState<{ text: string; isCorrect: boolean }[]>([]);
  const [editQuestionExplanation, setEditQuestionExplanation] = useState('');

  const handleSaveSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/training-center/modules/${moduleId}/sections/${sectionId}/quiz`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passingScore,
          maxAttempts,
          shuffleQuestions,
        }),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddQuestion = async () => {
    if (!newQuestionText.trim()) return;

    // Validate at least one correct answer
    const hasCorrect = newQuestionOptions.some(o => o.isCorrect);
    if (!hasCorrect) {
      setError('Please mark at least one correct answer');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/training-center/modules/${moduleId}/sections/${sectionId}/quiz/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: newQuestionText,
          type: newQuestionType,
          explanation: newQuestionExplanation || null,
          options: newQuestionOptions
            .filter(o => o.text.trim())
            .map(o => ({ optionText: o.text, isCorrect: o.isCorrect })),
        }),
      });
      if (!res.ok) throw new Error('Failed to add question');

      // Reset form
      setNewQuestionText('');
      setNewQuestionType('MULTIPLE_CHOICE');
      setNewQuestionOptions([
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
      ]);
      setNewQuestionExplanation('');
      setIsAddingQuestion(false);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add question');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEditQuestion = (question: QuizQuestion) => {
    setEditingQuestionId(question.id);
    setEditQuestionText(question.questionText);
    setEditQuestionType(question.type as 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MULTI_SELECT');
    setEditQuestionOptions(question.options.map(o => ({ text: o.optionText, isCorrect: o.isCorrect })));
    setEditQuestionExplanation(question.explanation || '');
  };

  const handleSaveEditQuestion = async () => {
    if (!editingQuestionId || !editQuestionText.trim()) return;

    const hasCorrect = editQuestionOptions.some(o => o.isCorrect);
    if (!hasCorrect) {
      setError('Please mark at least one correct answer');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/training-center/modules/${moduleId}/sections/${sectionId}/quiz/questions/${editingQuestionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: editQuestionText,
          type: editQuestionType,
          explanation: editQuestionExplanation || null,
          options: editQuestionOptions
            .filter(o => o.text.trim())
            .map(o => ({ optionText: o.text, isCorrect: o.isCorrect })),
        }),
      });
      if (!res.ok) throw new Error('Failed to save question');
      setEditingQuestionId(null);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save question');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Delete this question?')) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/training-center/modules/${moduleId}/sections/${sectionId}/quiz/questions/${questionId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportQuestions = async () => {
    setImportError(null);

    if (!importJson.trim()) {
      setImportError('Please paste CSV data');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/training-center/modules/${moduleId}/sections/${sectionId}/quiz/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv: importJson,
          replaceExisting,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details && Array.isArray(data.details)) {
          setImportError(`Validation errors:\n${data.details.join('\n')}`);
        } else {
          setImportError(data.error || 'Failed to import questions');
        }
        return;
      }

      // Success - close modal and refresh
      setShowImportModal(false);
      setImportJson('');
      setReplaceExisting(false);
      onUpdate();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import questions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.open(`/api/training-center/modules/${moduleId}/sections/${sectionId}/quiz/import`, '_blank');
  };

  const CSV_EXAMPLE = `questionText,type,points,explanation,option1,correct1,option2,correct2,option3,correct3,option4,correct4
"What is the primary role?",MULTIPLE_CHOICE,1,"Explanation here","Option A",false,"Option B",true,"Option C",false,
"Statement is true.",TRUE_FALSE,1,"","True",true,"False",false,,,,`;

  const handleQuestionTypeChange = (type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MULTI_SELECT', isNew: boolean) => {
    if (isNew) {
      setNewQuestionType(type);
      if (type === 'TRUE_FALSE') {
        setNewQuestionOptions([
          { text: 'True', isCorrect: false },
          { text: 'False', isCorrect: false },
        ]);
      } else if (newQuestionOptions.length < 2 || (newQuestionOptions[0].text === 'True' && newQuestionOptions[1].text === 'False')) {
        setNewQuestionOptions([
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
        ]);
      }
    } else {
      setEditQuestionType(type);
      if (type === 'TRUE_FALSE') {
        setEditQuestionOptions([
          { text: 'True', isCorrect: false },
          { text: 'False', isCorrect: false },
        ]);
      }
    }
  };

  const addOption = (isNew: boolean) => {
    if (isNew) {
      setNewQuestionOptions([...newQuestionOptions, { text: '', isCorrect: false }]);
    } else {
      setEditQuestionOptions([...editQuestionOptions, { text: '', isCorrect: false }]);
    }
  };

  const removeOption = (index: number, isNew: boolean) => {
    if (isNew) {
      setNewQuestionOptions(newQuestionOptions.filter((_, i) => i !== index));
    } else {
      setEditQuestionOptions(editQuestionOptions.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, field: 'text' | 'isCorrect', value: string | boolean, isNew: boolean) => {
    if (isNew) {
      const updated = [...newQuestionOptions];
      if (field === 'text') {
        updated[index].text = value as string;
      } else {
        // For single-answer types, uncheck others
        if (newQuestionType !== 'MULTI_SELECT') {
          updated.forEach((o, i) => { o.isCorrect = i === index ? (value as boolean) : false; });
        } else {
          updated[index].isCorrect = value as boolean;
        }
      }
      setNewQuestionOptions(updated);
    } else {
      const updated = [...editQuestionOptions];
      if (field === 'text') {
        updated[index].text = value as string;
      } else {
        if (editQuestionType !== 'MULTI_SELECT') {
          updated.forEach((o, i) => { o.isCorrect = i === index ? (value as boolean) : false; });
        } else {
          updated[index].isCorrect = value as boolean;
        }
      }
      setEditQuestionOptions(updated);
    }
  };

  if (!quiz) {
    return (
      <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm">
        No quiz found for this section. Try refreshing the page.
      </div>
    );
  }

  const sortedQuestions = [...quiz.questions].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex justify-between items-center">
          {error}
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {/* Quiz Settings */}
      <div className="p-4 bg-gray-50 rounded-lg space-y-4">
        <h4 className="font-medium text-gray-900">Quiz Settings</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Passing Score (%)</label>
            <input
              type="number"
              value={passingScore}
              onChange={(e) => setPassingScore(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
              min={0}
              max={100}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Attempts</label>
            <input
              type="number"
              value={maxAttempts ?? ''}
              onChange={(e) => setMaxAttempts(e.target.value ? parseInt(e.target.value) : null)}
              min={1}
              placeholder="Unlimited"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded"
              />
              Shuffle questions
            </label>
          </div>
        </div>
        <button
          onClick={handleSaveSettings}
          disabled={isLoading}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Questions List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">Questions ({sortedQuestions.length})</h4>
          {!isAddingQuestion && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="px-3 py-1.5 border border-purple-300 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-50"
              >
                Import CSV
              </button>
              <button
                onClick={() => setIsAddingQuestion(true)}
                className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200"
              >
                + Add Question
              </button>
            </div>
          )}
        </div>

        {/* Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Import Questions from CSV</h3>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportJson('');
                    setImportError(null);
                    setShowTemplate(false);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-xl"
                >
                  ×
                </button>
              </div>

              <div className="p-4 overflow-y-auto flex-1 space-y-4">
                {importError && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm whitespace-pre-wrap">
                    {importError}
                  </div>
                )}

                {/* Download Template Button */}
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                  <span className="text-purple-700 text-sm">Need a starting point?</span>
                  <button
                    onClick={handleDownloadTemplate}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                  >
                    Download CSV Template
                  </button>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Paste your CSV below
                    </label>
                    <button
                      onClick={() => setShowTemplate(!showTemplate)}
                      className="text-sm text-purple-600 hover:text-purple-800"
                    >
                      {showTemplate ? 'Hide example' : 'Show example'}
                    </button>
                  </div>

                  {showTemplate && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500">CSV Format Example</span>
                        <button
                          onClick={() => {
                            setImportJson(CSV_EXAMPLE);
                            setShowTemplate(false);
                          }}
                          className="text-xs text-purple-600 hover:text-purple-800"
                        >
                          Use this example
                        </button>
                      </div>
                      <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre">
                        {CSV_EXAMPLE}
                      </pre>
                    </div>
                  )}

                  <textarea
                    value={importJson}
                    onChange={(e) => setImportJson(e.target.value)}
                    rows={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="questionText,type,points,explanation,option1,correct1,option2,correct2,..."
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="replaceExisting"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded"
                  />
                  <label htmlFor="replaceExisting" className="text-sm text-gray-700">
                    Replace all existing questions (otherwise appends)
                  </label>
                </div>

                <div className="text-xs text-gray-500 space-y-1 p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-700 mb-2">CSV Column Guide:</p>
                  <p><strong>questionText</strong> - The question text (required)</p>
                  <p><strong>type</strong> - MULTIPLE_CHOICE, TRUE_FALSE, or MULTI_SELECT (required)</p>
                  <p><strong>points</strong> - Point value, defaults to 1</p>
                  <p><strong>explanation</strong> - Shown after answering</p>
                  <p><strong>option1-4, correct1-4</strong> - Answer options and whether correct (true/false)</p>
                  <p className="mt-2 text-gray-400">Tip: Use quotes around text with commas</p>
                </div>
              </div>

              <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportJson('');
                    setImportError(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportQuestions}
                  disabled={isLoading || !importJson.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                >
                  {isLoading ? 'Importing...' : 'Import Questions'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Question Form */}
        {isAddingQuestion && (
          <div className="mb-4 p-4 border-2 border-purple-200 rounded-lg bg-purple-50 space-y-4">
            <div className="flex items-center justify-between">
              <h5 className="font-medium text-purple-900">New Question</h5>
              <button
                onClick={() => setIsAddingQuestion(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Question Type</label>
              <select
                value={newQuestionType}
                onChange={(e) => handleQuestionTypeChange(e.target.value as 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MULTI_SELECT', true)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="MULTIPLE_CHOICE">Multiple Choice (single answer)</option>
                <option value="TRUE_FALSE">True/False</option>
                <option value="MULTI_SELECT">Multi-Select (multiple answers)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
              <textarea
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter your question..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Answer Options {newQuestionType === 'MULTI_SELECT' ? '(check all correct)' : '(select correct answer)'}
              </label>
              <div className="space-y-2">
                {newQuestionOptions.map((opt, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type={newQuestionType === 'MULTI_SELECT' ? 'checkbox' : 'radio'}
                      name="newCorrectAnswer"
                      checked={opt.isCorrect}
                      onChange={(e) => updateOption(index, 'isCorrect', e.target.checked, true)}
                      className="w-4 h-4 text-purple-600"
                    />
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => updateOption(index, 'text', e.target.value, true)}
                      disabled={newQuestionType === 'TRUE_FALSE'}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                      placeholder={`Option ${index + 1}`}
                    />
                    {newQuestionType !== 'TRUE_FALSE' && newQuestionOptions.length > 2 && (
                      <button
                        onClick={() => removeOption(index, true)}
                        className="text-red-500 hover:text-red-700 px-2"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {newQuestionType !== 'TRUE_FALSE' && (
                <button
                  onClick={() => addOption(true)}
                  className="mt-2 text-sm text-purple-600 hover:text-purple-800"
                >
                  + Add option
                </button>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Explanation (shown after answer)</label>
              <textarea
                value={newQuestionExplanation}
                onChange={(e) => setNewQuestionExplanation(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Optional explanation for the correct answer..."
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAddQuestion}
                disabled={isLoading || !newQuestionText.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                {isLoading ? 'Adding...' : 'Add Question'}
              </button>
              <button
                onClick={() => setIsAddingQuestion(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Existing Questions */}
        {sortedQuestions.length === 0 && !isAddingQuestion ? (
          <div className="text-center py-8 text-gray-500">
            No questions yet. Click &quot;Add Question&quot; to create one.
          </div>
        ) : (
          <div className="space-y-3">
            {sortedQuestions.map((question, index) => (
              <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                {editingQuestionId === question.id ? (
                  // Edit Mode
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Question Type</label>
                      <select
                        value={editQuestionType}
                        onChange={(e) => handleQuestionTypeChange(e.target.value as 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MULTI_SELECT', false)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                        <option value="TRUE_FALSE">True/False</option>
                        <option value="MULTI_SELECT">Multi-Select</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
                      <textarea
                        value={editQuestionText}
                        onChange={(e) => setEditQuestionText(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
                      <div className="space-y-2">
                        {editQuestionOptions.map((opt, optIndex) => (
                          <div key={optIndex} className="flex items-center gap-2">
                            <input
                              type={editQuestionType === 'MULTI_SELECT' ? 'checkbox' : 'radio'}
                              name="editCorrectAnswer"
                              checked={opt.isCorrect}
                              onChange={(e) => updateOption(optIndex, 'isCorrect', e.target.checked, false)}
                              className="w-4 h-4 text-purple-600"
                            />
                            <input
                              type="text"
                              value={opt.text}
                              onChange={(e) => updateOption(optIndex, 'text', e.target.value, false)}
                              disabled={editQuestionType === 'TRUE_FALSE'}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                            />
                            {editQuestionType !== 'TRUE_FALSE' && editQuestionOptions.length > 2 && (
                              <button
                                onClick={() => removeOption(optIndex, false)}
                                className="text-red-500 hover:text-red-700 px-2"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {editQuestionType !== 'TRUE_FALSE' && (
                        <button
                          onClick={() => addOption(false)}
                          className="mt-2 text-sm text-purple-600 hover:text-purple-800"
                        >
                          + Add option
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Explanation</label>
                      <textarea
                        value={editQuestionExplanation}
                        onChange={(e) => setEditQuestionExplanation(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEditQuestion}
                        disabled={isLoading}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                      >
                        {isLoading ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingQuestionId(null)}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-gray-500">Q{index + 1}</span>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                            {question.type.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-gray-900 mb-3">{question.questionText}</p>
                        <div className="space-y-1">
                          {question.options.map(opt => (
                            <div
                              key={opt.id}
                              className={`text-sm flex items-center gap-2 ${
                                opt.isCorrect ? 'text-green-700 font-medium' : 'text-gray-600'
                              }`}
                            >
                              <span>{opt.isCorrect ? '✓' : '○'}</span>
                              <span>{opt.optionText}</span>
                            </div>
                          ))}
                        </div>
                        {question.explanation && (
                          <p className="mt-2 text-sm text-gray-500 italic">
                            Explanation: {question.explanation}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleStartEditQuestion(question)}
                          className="text-purple-600 hover:text-purple-800 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(question.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
