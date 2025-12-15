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

type SectionType = 'VIDEO' | 'TEXT' | 'QUIZ' | 'RESOURCE';

interface QuizOption {
  id: string;
  optionText: string;
  sortOrder: number;
}

interface QuizQuestion {
  id: string;
  questionText: string;
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MULTI_SELECT';
  points: number;
  sortOrder: number;
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
  quiz: Quiz | null;
}

interface TrainingModule {
  id: string;
  title: string;
  description: string | null;
  estimatedMinutes: number;
  isRequired: boolean;
  grantsQualifiedRole: { name: string } | null;
  sections: Section[];
}

interface SectionProgress {
  isCompleted: boolean;
  videoProgress?: number;
  lastPosition?: number;
}

interface AttemptSummary {
  totalAttempts: number;
  maxAttempts: number | null;
  passingScore: number;
  hasPassed: boolean;
  canRetake: boolean;
  bestScore: number | null;
}

export default function LearnerModulePage() {
  const params = useParams();
  const router = useRouter();
  const moduleId = params.moduleId as string;

  const [trainingModule, setModule] = useState<TrainingModule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [sectionProgress, setSectionProgress] = useState<Record<string, SectionProgress>>({});
  const [overallProgress, setOverallProgress] = useState(0);

  const fetchModule = useCallback(async () => {
    try {
      // Fetch module data
      const res = await fetch(`/api/training-center/modules/${moduleId}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/training-center/learn');
          return;
        }
        throw new Error('Failed to fetch module');
      }
      const data = await res.json();
      setModule(data.module);

      // Enroll and fetch progress
      const progressRes = await fetch(`/api/training-center/progress/${moduleId}`, {
        method: 'POST',
      });
      if (progressRes.ok) {
        // Fetch detailed progress after enrollment
        const detailRes = await fetch(`/api/training-center/progress/${moduleId}`);
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          setSectionProgress(detailData.sectionProgress || {});
          setOverallProgress(detailData.progress || 0);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [moduleId, router]);

  useEffect(() => {
    fetchModule();
  }, [fetchModule]);

  const markSectionComplete = async (sectionId: string) => {
    try {
      const res = await fetch(`/api/training-center/progress/${moduleId}/section/${sectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setSectionProgress(prev => ({
          ...prev,
          [sectionId]: { ...prev[sectionId], isCompleted: true },
        }));
        setOverallProgress(data.overallProgress || overallProgress);
      }
    } catch (err) {
      console.error('Failed to mark complete:', err);
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
        <p className="text-red-700">{error || 'Module not found'}</p>
        <Link href="/training-center/learn" className="text-sm text-red-600 hover:text-red-800 mt-2 inline-block">
          Back to Training
        </Link>
      </div>
    );
  }

  const sortedSections = [...trainingModule.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const activeSection = sortedSections[activeSectionIndex];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/training-center/learn"
              className="text-gray-500 hover:text-gray-700"
            >
              ← Back
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{trainingModule.title}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{overallProgress}% complete</span>
                {trainingModule.grantsQualifiedRole && (
                  <>
                    <span>•</span>
                    <span className="text-purple-600">Grants: {trainingModule.grantsQualifiedRole.name}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-48 hidden md:block">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-600 transition-all"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        <div className="flex gap-6">
          {/* Sidebar - Section Navigation */}
          <div className="w-64 shrink-0 hidden lg:block">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-4">
              <div className="p-3 border-b border-gray-100">
                <h3 className="font-medium text-gray-900 text-sm">Sections</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {sortedSections.map((section, index) => {
                  const isComplete = sectionProgress[section.id]?.isCompleted;
                  const isActive = index === activeSectionIndex;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSectionIndex(index)}
                      className={`w-full text-left p-3 flex items-center gap-2 text-sm transition-colors ${
                        isActive ? 'bg-purple-50 text-purple-700' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${
                        isComplete ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {isComplete ? '✓' : index + 1}
                      </span>
                      <span className={`truncate ${isComplete ? 'text-gray-500' : ''}`}>
                        {section.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {activeSection && (
              <SectionViewer
                section={activeSection}
                progress={sectionProgress[activeSection.id]}
                onComplete={() => markSectionComplete(activeSection.id)}
                onNext={() => {
                  if (activeSectionIndex < sortedSections.length - 1) {
                    setActiveSectionIndex(activeSectionIndex + 1);
                  }
                }}
                isLast={activeSectionIndex === sortedSections.length - 1}
                onProgressUpdate={fetchModule}
              />
            )}
          </div>
        </div>

        {/* Mobile Section Navigation */}
        <div className="lg:hidden mt-4">
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setActiveSectionIndex(Math.max(0, activeSectionIndex - 1))}
                disabled={activeSectionIndex === 0}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                {activeSectionIndex + 1} / {sortedSections.length}
              </span>
              <button
                onClick={() => setActiveSectionIndex(Math.min(sortedSections.length - 1, activeSectionIndex + 1))}
                disabled={activeSectionIndex === sortedSections.length - 1}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Section Viewer Component
function SectionViewer({
  section,
  progress,
  onComplete,
  onNext,
  isLast,
  onProgressUpdate,
}: {
  section: Section;
  progress?: SectionProgress;
  onComplete: () => void;
  onNext: () => void;
  isLast: boolean;
  onProgressUpdate: () => void;
}) {
  const isComplete = progress?.isCompleted;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Section Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">{section.title}</h2>
          <span className="text-xs text-gray-500 capitalize">{section.type.toLowerCase()} section</span>
        </div>
        {isComplete && (
          <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
            Completed
          </span>
        )}
      </div>

      {/* Section Content */}
      <div className="p-6">
        {section.type === 'VIDEO' && (
          <VideoSection
            section={section}
            progress={progress}
            onComplete={onComplete}
          />
        )}

        {section.type === 'TEXT' && (
          <TextSection section={section} />
        )}

        {section.type === 'QUIZ' && section.quiz && (
          <QuizSection
            quiz={section.quiz}
            onComplete={onProgressUpdate}
          />
        )}

        {section.type === 'RESOURCE' && (
          <ResourceSection
            section={section}
            isComplete={isComplete}
            onComplete={onComplete}
          />
        )}
      </div>

      {/* Navigation Footer */}
      {section.type !== 'QUIZ' && (
        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          {!isComplete ? (
            <button
              onClick={onComplete}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
            >
              Mark as Complete
            </button>
          ) : (
            <span className="text-sm text-green-600 font-medium">Section completed</span>
          )}
          {!isLast && (
            <button
              onClick={onNext}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
            >
              Next Section →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Video Section
function VideoSection({
  section,
  progress,
  onComplete,
}: {
  section: Section;
  progress?: SectionProgress;
  onComplete: () => void;
}) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!section.videoUrl) {
      setIsLoading(false);
      return;
    }

    const fetchUrl = async () => {
      try {
        const res = await fetch(`/api/training-center/video-url?key=${encodeURIComponent(section.videoUrl!)}`);
        if (res.ok) {
          const data = await res.json();
          setVideoUrl(data.url);
        }
      } catch (err) {
        console.error('Failed to fetch video URL:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUrl();
  }, [section.videoUrl]);

  const handleVideoEnd = () => {
    if (!progress?.isCompleted) {
      onComplete();
    }
  };

  if (!section.videoUrl) {
    return <p className="text-gray-500">No video available for this section.</p>;
  }

  if (isLoading) {
    return (
      <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!videoUrl) {
    return (
      <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">Unable to load video</p>
      </div>
    );
  }

  return (
    <video
      src={videoUrl}
      controls
      onEnded={handleVideoEnd}
      className="w-full aspect-video rounded-lg bg-black"
    >
      Your browser does not support the video tag.
    </video>
  );
}

// Text Section
function TextSection({
  section,
}: {
  section: Section;
}) {
  if (!section.textContent) {
    return <p className="text-gray-500">No content available.</p>;
  }

  // First escape HTML to prevent XSS, then apply markdown transformations
  const escaped = escapeHtml(section.textContent);
  const html = escaped
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/^\- (.*$)/gim, '<li class="ml-4">$1</li>')
    .replace(/\n/gim, '<br />');

  return (
    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
  );
}

// Resource Section
function ResourceSection({
  section,
  isComplete,
  onComplete,
}: {
  section: Section;
  isComplete?: boolean;
  onComplete: () => void;
}) {
  if (!section.resourceUrl) {
    return <p className="text-gray-500">No resource available.</p>;
  }

  return (
    <div className="text-center py-8">
      <span className="text-4xl mb-4 block">📁</span>
      <h3 className="font-medium text-gray-900 mb-2">{section.resourceName || 'Download Resource'}</h3>
      <a
        href={section.resourceUrl.startsWith('http') ? section.resourceUrl : '#'}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => !isComplete && onComplete()}
        className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
      >
        Download Resource
        <span>↗</span>
      </a>
    </div>
  );
}

// Quiz Section
function QuizSection({
  quiz,
  onComplete,
}: {
  quiz: Quiz;
  onComplete: () => void;
}) {
  const [attemptSummary, setAttemptSummary] = useState<AttemptSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTakingQuiz, setIsTakingQuiz] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
    answers: Array<{
      questionId: string;
      isCorrect: boolean;
      selectedOptionIds: string[];
    }>;
  } | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [startTime] = useState(new Date());

  useEffect(() => {
    const fetchAttempts = async () => {
      try {
        const res = await fetch(`/api/training-center/quiz/${quiz.id}/attempt`);
        if (res.ok) {
          const data = await res.json();
          setAttemptSummary(data.summary);
        }
      } catch (err) {
        console.error('Failed to fetch attempts:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAttempts();
  }, [quiz.id]);

  const questions = quiz.shuffleQuestions
    ? [...quiz.questions].sort(() => Math.random() - 0.5)
    : [...quiz.questions].sort((a, b) => a.sortOrder - b.sortOrder);

  const currentQuestion = questions[currentQuestionIndex];

  const handleOptionSelect = (optionId: string) => {
    if (!currentQuestion) return;

    const questionId = currentQuestion.id;
    const currentAnswers = answers[questionId] || [];

    if (currentQuestion.type === 'MULTI_SELECT') {
      // Toggle selection
      if (currentAnswers.includes(optionId)) {
        setAnswers({
          ...answers,
          [questionId]: currentAnswers.filter(id => id !== optionId),
        });
      } else {
        setAnswers({
          ...answers,
          [questionId]: [...currentAnswers, optionId],
        });
      }
    } else {
      // Single selection
      setAnswers({
        ...answers,
        [questionId]: [optionId],
      });
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const formattedAnswers = Object.entries(answers).map(([questionId, selectedOptionIds]) => ({
        questionId,
        selectedOptionIds,
      }));

      const res = await fetch(`/api/training-center/quiz/${quiz.id}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: formattedAnswers,
          startedAt: startTime.toISOString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit');
      }

      const data = await res.json();
      setResult(data.attempt);
      setExplanations(data.explanations || {});

      // Refresh attempt summary
      const summaryRes = await fetch(`/api/training-center/quiz/${quiz.id}/attempt`);
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setAttemptSummary(summaryData.summary);
      }

      if (data.attempt.passed) {
        onComplete();
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert(err instanceof Error ? err.message : 'Failed to submit quiz');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetQuiz = () => {
    setIsTakingQuiz(false);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setResult(null);
    setExplanations({});
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Show results after submission
  if (result) {
    return (
      <div className="space-y-6">
        {/* Score Card */}
        <div className={`text-center p-6 rounded-xl ${
          result.passed ? 'bg-green-50' : 'bg-red-50'
        }`}>
          <div className={`text-5xl font-bold mb-2 ${
            result.passed ? 'text-green-600' : 'text-red-600'
          }`}>
            {result.percentage}%
          </div>
          <p className={`text-lg font-medium ${
            result.passed ? 'text-green-700' : 'text-red-700'
          }`}>
            {result.passed ? 'You passed!' : 'Not quite there yet'}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {result.score} / {result.maxScore} points • Passing: {quiz.passingScore}%
          </p>
        </div>

        {/* Review Answers */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Review Your Answers</h4>
          {questions.map((question, index) => {
            const answerResult = result.answers.find(a => a.questionId === question.id);
            const userAnswers = answers[question.id] || [];

            return (
              <div
                key={question.id}
                className={`p-4 rounded-lg border ${
                  answerResult?.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-start gap-2 mb-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                    answerResult?.isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                  }`}>
                    {answerResult?.isCorrect ? '✓' : '×'}
                  </span>
                  <p className="font-medium text-gray-900">Q{index + 1}: {question.questionText}</p>
                </div>
                <div className="ml-8 space-y-1">
                  {question.options.map(opt => {
                    const isSelected = userAnswers.includes(opt.id);
                    // correctOptionIds not included in API response for security
                    // Show as correct if user selected it and got the question right
                    const showAsCorrect = answerResult?.isCorrect && isSelected;
                    return (
                      <div
                        key={opt.id}
                        className={`text-sm flex items-center gap-2 ${
                          showAsCorrect ? 'text-green-700 font-medium' :
                          isSelected && !answerResult?.isCorrect ? 'text-red-600' : 'text-gray-600'
                        }`}
                      >
                        <span>
                          {showAsCorrect ? '✓' : isSelected && !answerResult?.isCorrect ? '×' : '○'}
                        </span>
                        <span>{opt.optionText}</span>
                        {isSelected && !answerResult?.isCorrect && <span className="text-xs">(your answer)</span>}
                      </div>
                    );
                  })}
                </div>
                {explanations[question.id] && (
                  <p className="ml-8 mt-2 text-sm text-gray-600 italic">
                    {explanations[question.id]}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-4">
          {!result.passed && attemptSummary?.canRetake && (
            <button
              onClick={resetQuiz}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
            >
              Try Again
            </button>
          )}
          {result.passed && (
            <p className="text-green-600 font-medium">This section is now complete!</p>
          )}
        </div>
      </div>
    );
  }

  // Show quiz start screen
  if (!isTakingQuiz) {
    return (
      <div className="text-center py-8">
        <span className="text-4xl mb-4 block">❓</span>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Quiz Time!</h3>
        <p className="text-gray-600 mb-4">
          {quiz.questions.length} questions • {quiz.passingScore}% to pass
          {quiz.maxAttempts && ` • ${quiz.maxAttempts} attempts max`}
        </p>

        {attemptSummary && attemptSummary.totalAttempts > 0 && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg inline-block">
            <p className="text-sm text-gray-600">
              Previous attempts: {attemptSummary.totalAttempts}
              {attemptSummary.maxAttempts && ` / ${attemptSummary.maxAttempts}`}
            </p>
            {attemptSummary.bestScore !== null && (
              <p className="text-sm text-gray-600">Best score: {attemptSummary.bestScore}%</p>
            )}
            {attemptSummary.hasPassed && (
              <p className="text-sm text-green-600 font-medium mt-1">You&apos;ve already passed!</p>
            )}
          </div>
        )}

        {attemptSummary?.hasPassed ? (
          <p className="text-green-600 font-medium">Quiz completed successfully!</p>
        ) : attemptSummary?.canRetake === false ? (
          <p className="text-red-600 font-medium">Maximum attempts reached</p>
        ) : (
          <button
            onClick={() => setIsTakingQuiz(true)}
            className="px-8 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 text-lg"
          >
            Start Quiz
          </button>
        )}
      </div>
    );
  }

  // Show quiz questions
  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${
                i === currentQuestionIndex ? 'bg-purple-600' :
                answers[questions[i].id]?.length ? 'bg-purple-300' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Question */}
      {currentQuestion && (
        <div>
          <p className="text-lg font-medium text-gray-900 mb-4">{currentQuestion.questionText}</p>
          <div className="space-y-2">
            {currentQuestion.options.map(opt => {
              const isSelected = (answers[currentQuestion.id] || []).includes(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => handleOptionSelect(opt.id)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-${currentQuestion.type === 'MULTI_SELECT' ? 'md' : 'full'} border-2 flex items-center justify-center ${
                      isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
                    }`}>
                      {isSelected && <span className="text-white text-xs">✓</span>}
                    </div>
                    <span className={isSelected ? 'text-purple-900' : 'text-gray-700'}>
                      {opt.optionText}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {currentQuestion.type === 'MULTI_SELECT' && (
            <p className="text-sm text-gray-500 mt-2">Select all that apply</p>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <button
          onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
          disabled={currentQuestionIndex === 0}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
        >
          Previous
        </button>

        {currentQuestionIndex === questions.length - 1 ? (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || Object.keys(answers).length < questions.length}
            className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
          </button>
        ) : (
          <button
            onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
          >
            Next
          </button>
        )}
      </div>

      {/* Answer status */}
      <div className="text-center text-sm text-gray-500">
        {Object.keys(answers).length} of {questions.length} questions answered
      </div>
    </div>
  );
}
