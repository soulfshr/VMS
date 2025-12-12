'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ModuleProgress {
  moduleId: string;
  progress: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
}

interface TrainingModule {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  estimatedMinutes: number;
  isRequired: boolean;
  stats: {
    sectionCount: number;
    videoCount: number;
    quizCount: number;
  };
  grantsQualifiedRole: { name: string } | null;
}

export default function LearnerDashboard() {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [progress, setProgress] = useState<Record<string, ModuleProgress>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchModules = async () => {
      try {
        // Fetch available modules (published only for non-developers)
        const res = await fetch('/api/training-center/modules?published=true');
        if (!res.ok) throw new Error('Failed to fetch modules');
        const data = await res.json();
        setModules(data.modules || []);
        setIsLoading(false);

        // Fetch progress in background (don't block initial render)
        const moduleIds = (data.modules || []).map((m: TrainingModule) => m.id);
        if (moduleIds.length > 0) {
          const progressRes = await fetch('/api/training-center/progress/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ moduleIds }),
          });
          if (progressRes.ok) {
            const progressData = await progressRes.json();
            setProgress(progressData.progress || {});
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
        setIsLoading(false);
      }
    };
    fetchModules();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  const requiredModules = modules.filter(m => m.isRequired);
  const optionalModules = modules.filter(m => !m.isRequired);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Training Center</h1>
        <p className="text-gray-600 mt-1">Complete training modules to gain qualifications</p>
      </div>

      {/* Required Modules */}
      {requiredModules.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-red-500">*</span> Required Training
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {requiredModules.map(mod => (
              <ModuleCard
                key={mod.id}
                module={mod}
                progress={progress[mod.id]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Optional Modules */}
      {optionalModules.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Training</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {optionalModules.map(mod => (
              <ModuleCard
                key={mod.id}
                module={mod}
                progress={progress[mod.id]}
              />
            ))}
          </div>
        </div>
      )}

      {modules.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <span className="text-4xl mb-4 block">📚</span>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Training Available</h3>
          <p className="text-gray-500">Check back later for new training modules.</p>
        </div>
      )}
    </div>
  );
}

function ModuleCard({
  module,
  progress,
}: {
  module: TrainingModule;
  progress?: ModuleProgress;
}) {
  const progressPercent = progress?.progress || 0;
  const status = progress?.status || 'NOT_STARTED';

  return (
    <Link
      href={`/training-center/learn/${module.id}`}
      className="block bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-purple-300 hover:shadow-md transition-all"
    >
      {/* Thumbnail or placeholder */}
      <div className="h-32 bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
        <span className="text-4xl">📚</span>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900 line-clamp-2">{module.title}</h3>
          {module.isRequired && (
            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full ml-2 shrink-0">
              Required
            </span>
          )}
        </div>

        {module.description && (
          <p className="text-sm text-gray-500 mb-3 line-clamp-2">{module.description}</p>
        )}

        <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
          <span>{module.stats?.sectionCount || 0} sections</span>
          <span>•</span>
          <span>{module.estimatedMinutes} min</span>
          {module.grantsQualifiedRole && (
            <>
              <span>•</span>
              <span className="text-purple-600">Grants: {module.grantsQualifiedRole.name}</span>
            </>
          )}
        </div>

        {/* Progress bar */}
        <div className="relative">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                status === 'COMPLETED' ? 'bg-green-500' : 'bg-purple-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-500">{progressPercent}% complete</span>
            <span className={`text-xs font-medium ${
              status === 'COMPLETED' ? 'text-green-600' :
              status === 'IN_PROGRESS' ? 'text-purple-600' : 'text-gray-400'
            }`}>
              {status === 'COMPLETED' ? 'Completed' :
               status === 'IN_PROGRESS' ? 'In Progress' : 'Not Started'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
