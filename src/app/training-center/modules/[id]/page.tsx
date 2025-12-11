'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type SectionType = 'VIDEO' | 'TEXT' | 'QUIZ';

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
  quiz: Quiz | null;
}

interface QualifiedRole {
  id: string;
  name: string;
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
  grantsQualifiedRole: QualifiedRole | null;
  sections: Section[];
}

export default function ModuleEditorPage() {
  const params = useParams();
  const router = useRouter();
  const moduleId = params.id as string;

  const [trainingModule, setModule] = useState<TrainingModule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'sections'>('sections');

  // Form state for module details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [isRequired, setIsRequired] = useState(false);

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
  const [isUploading, setIsUploading] = useState(false);

  const sectionIcon = section.type === 'VIDEO' ? '📹' : section.type === 'TEXT' ? '📝' : '❓';

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const body: Record<string, unknown> = { title: editTitle };
      if (section.type === 'VIDEO') {
        body.videoUrl = editVideoUrl || null;
      } else if (section.type === 'TEXT') {
        body.textContent = editTextContent || null;
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
      // Get presigned URL
      const presignedRes = await fetch('/api/training-center/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          moduleId,
        }),
      });

      if (!presignedRes.ok) throw new Error('Failed to get upload URL');
      const { uploadUrl, key } = await presignedRes.json();

      // Upload directly to S3
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      if (!uploadRes.ok) throw new Error('Upload failed');

      // Save the S3 key to the section
      setEditVideoUrl(key);

      // Auto-save
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
                <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm">
                  Quiz editor coming soon. For now, quizzes can be configured via the API.
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

// Simple Markdown Renderer
function MarkdownRenderer({ content }: { content: string }) {
  // Basic markdown to HTML conversion
  const html = content
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/^\- (.*$)/gim, '<li class="ml-4">$1</li>')
    .replace(/\n/gim, '<br />');

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
