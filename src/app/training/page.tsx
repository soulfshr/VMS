'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import type { DevUser } from '@/types/auth';
import { useFeatures } from '@/hooks/useFeatures';

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

interface TrainingType {
  id: string;
  name: string;
  color: string;
}

interface Zone {
  id: string;
  name: string;
}

interface Training {
  id: string;
  title: string;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  meetingLink: string | null;
  status: string;
  maxAttendees: number;
  confirmedCount: number;
  spotsLeft: number;
  userRsvpStatus: string | null;
  trainingType: TrainingType;
  zone: Zone | null;
}

function TrainingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const features = useFeatures();

  const [user, setUser] = useState<DevUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Tab state from URL
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'modules' | 'sessions'>(
    tabParam === 'sessions' ? 'sessions' : 'modules'
  );

  // Online modules state
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [progress, setProgress] = useState<Record<string, ModuleProgress>>({});
  const [modulesLoading, setModulesLoading] = useState(true);

  // Sessions state
  const [sessions, setSessions] = useState<Training[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Feature flag redirect
  useEffect(() => {
    if (!features.isLoading && !features.trainings) {
      router.replace('/dashboard');
    }
  }, [router, features.isLoading, features.trainings]);

  // Auth check
  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (!data.user) {
          router.push('/login');
        } else {
          setUser(data.user);
        }
        setIsLoading(false);
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  // Fetch online modules
  useEffect(() => {
    if (!user) return;

    const fetchModules = async () => {
      try {
        const res = await fetch('/api/training-center/modules?published=true');
        if (!res.ok) throw new Error('Failed to fetch modules');
        const data = await res.json();
        setModules(data.modules || []);

        // Fetch progress
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
        console.error('Failed to load modules:', err);
      } finally {
        setModulesLoading(false);
      }
    };
    fetchModules();
  }, [user]);

  // Fetch training sessions
  useEffect(() => {
    if (!user) return;

    const fetchSessions = async () => {
      try {
        const res = await fetch('/api/trainings');
        if (!res.ok) throw new Error('Failed to fetch sessions');
        const data = await res.json();
        setSessions(data);
      } catch (err) {
        console.error('Failed to load sessions:', err);
      } finally {
        setSessionsLoading(false);
      }
    };
    fetchSessions();
  }, [user]);

  const handleTabChange = (tab: 'modules' | 'sessions') => {
    setActiveTab(tab);
    // Update URL without navigation
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url.toString());
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  const requiredModules = modules.filter(m => m.isRequired);
  const completedRequired = requiredModules.filter(m => progress[m.id]?.status === 'COMPLETED').length;
  const upcomingSessions = sessions.filter(s => s.status !== 'CANCELLED' && new Date(s.date) >= new Date());

  const canCreateTraining = ['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role);
  const canManageModules = user.role === 'DEVELOPER';

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Training</h1>
            <p className="text-gray-600">Complete online modules and attend live training sessions</p>
          </div>
          <div className="flex gap-3">
            {canManageModules && (
              <Link
                href="/training-center/modules"
                className="px-4 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors font-medium text-sm"
              >
                Manage Modules
              </Link>
            )}
            {canCreateTraining && (
              <Link
                href="/trainings/create"
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium text-sm"
              >
                + Schedule Session
              </Link>
            )}
          </div>
        </div>

        {/* Progress Summary */}
        {requiredModules.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Required Training Progress</h2>
              <span className="text-xl font-bold text-cyan-600">
                {completedRequired}/{requiredModules.length}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-600 rounded-full transition-all duration-500"
                style={{ width: `${requiredModules.length > 0 ? (completedRequired / requiredModules.length) * 100 : 0}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {completedRequired === requiredModules.length
                ? 'All required training completed!'
                : `${requiredModules.length - completedRequired} required module${requiredModules.length - completedRequired !== 1 ? 's' : ''} remaining`}
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => handleTabChange('modules')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'modules'
                ? 'border-cyan-600 text-cyan-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Online Modules
            {modules.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                {modules.length}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabChange('sessions')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'sessions'
                ? 'border-cyan-600 text-cyan-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Live Sessions
            {upcomingSessions.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                {upcomingSessions.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'modules' ? (
          <OnlineModulesTab
            modules={modules}
            progress={progress}
            isLoading={modulesLoading}
          />
        ) : (
          <LiveSessionsTab
            sessions={sessions}
            isLoading={sessionsLoading}
            user={user}
          />
        )}
      </div>
    </div>
  );
}

// Online Modules Tab
function OnlineModulesTab({
  modules,
  progress,
  isLoading,
}: {
  modules: TrainingModule[];
  progress: Record<string, ModuleProgress>;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <span className="text-4xl mb-4 block">📚</span>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Online Modules Available</h3>
        <p className="text-gray-500">Check back later for new training modules.</p>
      </div>
    );
  }

  const requiredModules = modules.filter(m => m.isRequired);
  const optionalModules = modules.filter(m => !m.isRequired);

  return (
    <div>
      {requiredModules.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-red-500">*</span> Required Training
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {requiredModules.map(mod => (
              <ModuleCard key={mod.id} module={mod} progress={progress[mod.id]} />
            ))}
          </div>
        </div>
      )}

      {optionalModules.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Training</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {optionalModules.map(mod => (
              <ModuleCard key={mod.id} module={mod} progress={progress[mod.id]} />
            ))}
          </div>
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
      className="block bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-cyan-300 hover:shadow-md transition-all"
    >
      <div className="h-24 bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center">
        <span className="text-3xl">📚</span>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-semibold text-gray-900 line-clamp-2">{module.title}</h4>
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
        </div>

        <div className="relative">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                status === 'COMPLETED' ? 'bg-green-500' : 'bg-cyan-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-500">{progressPercent}%</span>
            <span className={`text-xs font-medium ${
              status === 'COMPLETED' ? 'text-green-600' :
              status === 'IN_PROGRESS' ? 'text-cyan-600' : 'text-gray-400'
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

// Live Sessions Tab
function LiveSessionsTab({
  sessions,
  isLoading,
  user,
}: {
  sessions: Training[];
  isLoading: boolean;
  user: DevUser;
}) {
  const [rsvpingId, setRsvpingId] = useState<string | null>(null);
  const [localSessions, setLocalSessions] = useState(sessions);

  useEffect(() => {
    setLocalSessions(sessions);
  }, [sessions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const upcomingSessions = localSessions.filter(s => s.status !== 'CANCELLED' && new Date(s.date) >= new Date());
  const pastSessions = localSessions.filter(s => s.status !== 'CANCELLED' && new Date(s.date) < new Date());

  const handleRsvp = async (sessionId: string) => {
    setRsvpingId(sessionId);
    try {
      const res = await fetch(`/api/trainings/${sessionId}/rsvp`, { method: 'POST' });
      if (res.ok) {
        // Refresh sessions
        const newRes = await fetch('/api/trainings');
        if (newRes.ok) {
          setLocalSessions(await newRes.json());
        }
      }
    } catch (err) {
      console.error('RSVP failed:', err);
    } finally {
      setRsvpingId(null);
    }
  };

  const handleCancelRsvp = async (sessionId: string) => {
    setRsvpingId(sessionId);
    try {
      const res = await fetch(`/api/trainings/${sessionId}/rsvp`, { method: 'DELETE' });
      if (res.ok) {
        const newRes = await fetch('/api/trainings');
        if (newRes.ok) {
          setLocalSessions(await newRes.json());
        }
      }
    } catch (err) {
      console.error('Cancel failed:', err);
    } finally {
      setRsvpingId(null);
    }
  };

  const formatTime = (startStr: string, endStr: string) => {
    const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
    return `${new Date(startStr).toLocaleTimeString('en-US', opts)} - ${new Date(endStr).toLocaleTimeString('en-US', opts)}`;
  };

  if (localSessions.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <span className="text-4xl mb-4 block">📅</span>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Training Sessions</h3>
        <p className="text-gray-500">No live training sessions are scheduled at this time.</p>
        <Link href="/trainings" className="text-cyan-600 hover:text-cyan-700 text-sm mt-4 inline-block">
          View all sessions →
        </Link>
      </div>
    );
  }

  const canManage = ['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role);

  return (
    <div>
      {upcomingSessions.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Sessions</h3>
          <div className="space-y-3">
            {upcomingSessions.slice(0, 5).map(session => (
              <div
                key={session.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:border-cyan-300 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="text-center min-w-[60px]">
                    <div className="text-lg font-bold text-gray-900">
                      {new Date(session.date).getDate()}
                    </div>
                    <div className="text-xs text-gray-500 uppercase">
                      {new Date(session.date).toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                  </div>
                  <div>
                    <Link href={`/trainings/${session.id}`} className="font-medium text-gray-900 hover:text-cyan-600">
                      {session.title}
                    </Link>
                    <div className="text-sm text-gray-500">
                      {formatTime(session.startTime, session.endTime)}
                      {session.location && ` • ${session.location}`}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: `${session.trainingType.color}20`,
                          color: session.trainingType.color,
                        }}
                      >
                        {session.trainingType.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {session.confirmedCount}/{session.maxAttendees} spots
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {session.userRsvpStatus ? (
                    <>
                      <span className={`text-xs px-2 py-1 rounded ${
                        session.userRsvpStatus === 'CONFIRMED'
                          ? 'bg-cyan-100 text-cyan-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {session.userRsvpStatus === 'CONFIRMED' ? 'Confirmed' : 'Pending'}
                      </span>
                      <button
                        onClick={() => handleCancelRsvp(session.id)}
                        disabled={rsvpingId === session.id}
                        className="text-xs text-gray-500 hover:text-red-600"
                      >
                        Cancel
                      </button>
                    </>
                  ) : session.spotsLeft > 0 ? (
                    <button
                      onClick={() => handleRsvp(session.id)}
                      disabled={rsvpingId === session.id}
                      className="px-3 py-1.5 bg-cyan-600 text-white text-xs rounded-lg hover:bg-cyan-700 disabled:opacity-50"
                    >
                      {rsvpingId === session.id ? '...' : 'Sign Up'}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">Full</span>
                  )}
                  {canManage && (
                    <Link
                      href={`/trainings/${session.id}/roster`}
                      className="text-xs text-cyan-600 hover:text-cyan-700"
                    >
                      Roster
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
          {upcomingSessions.length > 5 && (
            <Link href="/trainings" className="text-cyan-600 hover:text-cyan-700 text-sm mt-4 inline-block">
              View all {upcomingSessions.length} sessions →
            </Link>
          )}
        </div>
      )}

      {pastSessions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-500 mb-4">Past Sessions</h3>
          <div className="text-sm text-gray-500">
            {pastSessions.length} past session{pastSessions.length !== 1 ? 's' : ''}.{' '}
            <Link href="/trainings" className="text-cyan-600 hover:text-cyan-700">
              View history →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrainingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    }>
      <TrainingPageContent />
    </Suspense>
  );
}
