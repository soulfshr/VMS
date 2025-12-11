'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ModuleStats {
  sectionCount: number;
  videoCount: number;
  quizCount: number;
  enrollmentCount: number;
  completedCount: number;
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
  createdAt: string;
  updatedAt: string;
  stats: ModuleStats;
}

export default function ModulesListPage() {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');

  const fetchModules = async () => {
    try {
      const status = filter === 'all' ? '' : filter;
      const res = await fetch(`/api/training-center/modules${status ? `?status=${status}` : ''}`);
      if (!res.ok) throw new Error('Failed to fetch modules');
      const data = await res.json();
      setModules(data.modules);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load modules');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchModules();
  }, [filter]);

  const handleCreateModule = async () => {
    if (!newModuleTitle.trim()) return;

    setIsCreating(true);
    try {
      const res = await fetch('/api/training-center/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newModuleTitle }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create module');
      }
      setNewModuleTitle('');
      fetchModules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create module');
    } finally {
      setIsCreating(false);
    }
  };

  const handleTogglePublished = async (module: TrainingModule) => {
    try {
      const res = await fetch(`/api/training-center/modules/${module.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !module.isPublished }),
      });
      if (!res.ok) throw new Error('Failed to update module');
      fetchModules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update module');
    }
  };

  const handleDeleteModule = async (module: TrainingModule) => {
    if (!confirm(`Are you sure you want to delete "${module.title}"?`)) return;

    try {
      const res = await fetch(`/api/training-center/modules/${module.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete module');
      }
      fetchModules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete module');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training Modules</h1>
          <p className="text-gray-600 mt-1">Create and manage interactive training content</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-sm text-red-600 hover:text-red-800 mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create New Module */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h2 className="font-medium text-gray-900 mb-3">Create New Module</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateModule()}
            placeholder="Enter module title..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={handleCreateModule}
            disabled={isCreating || !newModuleTitle.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : 'Create Module'}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'published', 'draft'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'All Modules' : f === 'published' ? 'Published' : 'Drafts'}
          </button>
        ))}
      </div>

      {/* Modules Grid */}
      {modules.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <span className="text-4xl mb-4 block">📚</span>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No modules yet</h3>
          <p className="text-gray-500 mb-4">Create your first training module to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map((module) => (
            <div
              key={module.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-purple-300 transition-colors"
            >
              {/* Module Header */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">{module.title}</h3>
                      {module.isRequired && (
                        <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                          Required
                        </span>
                      )}
                    </div>
                    {module.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{module.description}</p>
                    )}
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      module.isPublished
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {module.isPublished ? 'Published' : 'Draft'}
                  </span>
                </div>
              </div>

              {/* Module Stats */}
              <div className="px-4 py-3 bg-gray-50 flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-gray-600">
                  <span>📹</span>
                  <span>{module.stats.videoCount} videos</span>
                </div>
                <div className="flex items-center gap-1 text-gray-600">
                  <span>❓</span>
                  <span>{module.stats.quizCount} quizzes</span>
                </div>
                <div className="flex items-center gap-1 text-gray-600">
                  <span>⏱️</span>
                  <span>{module.estimatedMinutes} min</span>
                </div>
              </div>

              {/* Enrollment Stats */}
              {module.stats.enrollmentCount > 0 && (
                <div className="px-4 py-2 bg-purple-50 flex items-center gap-4 text-sm">
                  <span className="text-purple-700">
                    {module.stats.completedCount}/{module.stats.enrollmentCount} completed
                  </span>
                  {module.grantsQualifiedRole && (
                    <span className="text-purple-600 text-xs">
                      Grants: {module.grantsQualifiedRole.name}
                    </span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/training-center/modules/${module.id}`}
                    className="px-3 py-1.5 text-sm text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleTogglePublished(module)}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {module.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                </div>
                <button
                  onClick={() => handleDeleteModule(module)}
                  className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
