'use client';

import { useEffect, useState } from 'react';

interface IntakeQuestion {
  id: string;
  question: string;
  type: 'text' | 'textarea' | 'select';
  options: string[];
  required: boolean;
  isActive: boolean;
  sortOrder: number;
}

export default function IntakeQuestionsPage() {
  const [questions, setQuestions] = useState<IntakeQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    question: '',
    type: 'text' as 'text' | 'textarea' | 'select',
    options: [] as string[],
    required: false,
  });
  const [newOption, setNewOption] = useState('');

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      const res = await fetch('/api/admin/intake-questions');
      const data = await res.json();
      if (Array.isArray(data)) {
        setQuestions(data);
      }
    } catch (err) {
      console.error('Error loading intake questions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      question: '',
      type: 'text',
      options: [],
      required: false,
    });
    setNewOption('');
  };

  const startEdit = (q: IntakeQuestion) => {
    setEditingId(q.id);
    setIsCreating(false);
    setFormData({
      question: q.question,
      type: q.type,
      options: q.options || [],
      required: q.required,
    });
    setNewOption('');
  };

  const startCreate = () => {
    setEditingId(null);
    setIsCreating(true);
    resetForm();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
    resetForm();
  };

  const addOption = () => {
    if (newOption.trim() && !formData.options.includes(newOption.trim())) {
      setFormData(prev => ({
        ...prev,
        options: [...prev.options, newOption.trim()],
      }));
      setNewOption('');
    }
  };

  const removeOption = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== idx),
    }));
  };

  const handleSave = async () => {
    setMessage(null);

    if (!formData.question.trim()) {
      setMessage({ type: 'error', text: 'Question text is required' });
      return;
    }

    if (formData.type === 'select' && formData.options.length === 0) {
      setMessage({ type: 'error', text: 'Select type questions require at least one option' });
      return;
    }

    try {
      const url = isCreating
        ? '/api/admin/intake-questions'
        : `/api/admin/intake-questions/${editingId}`;
      const method = isCreating ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }

      setMessage({ type: 'success', text: isCreating ? 'Question created' : 'Question updated' });
      cancelEdit();
      loadQuestions();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    setMessage(null);
    try {
      const res = await fetch(`/api/admin/intake-questions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');

      setMessage({ type: 'success', text: 'Question deleted' });
      loadQuestions();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete' });
    }
  };

  const handleToggleActive = async (q: IntakeQuestion) => {
    try {
      const res = await fetch(`/api/admin/intake-questions/${q.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !q.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      loadQuestions();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update status' });
    }
  };

  const handleToggleRequired = async (q: IntakeQuestion) => {
    try {
      const res = await fetch(`/api/admin/intake-questions/${q.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ required: !q.required }),
      });
      if (!res.ok) throw new Error('Failed to update');
      loadQuestions();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update required status' });
    }
  };

  const handleSeedDefaults = async () => {
    if (!confirm('This will add the default intake questions. Continue?')) return;

    setIsSeeding(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/intake-questions/seed', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to seed');
      }
      const data = await res.json();
      setMessage({ type: 'success', text: `Added ${data.count} default questions` });
      loadQuestions();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to seed' });
    } finally {
      setIsSeeding(false);
    }
  };

  const moveQuestion = async (id: string, direction: 'up' | 'down') => {
    const idx = questions.findIndex(q => q.id === id);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === questions.length - 1) return;

    const newQuestions = [...questions];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;

    // Swap sort orders
    const tempOrder = newQuestions[idx].sortOrder;
    newQuestions[idx].sortOrder = newQuestions[swapIdx].sortOrder;
    newQuestions[swapIdx].sortOrder = tempOrder;

    // Swap positions in array
    [newQuestions[idx], newQuestions[swapIdx]] = [newQuestions[swapIdx], newQuestions[idx]];

    setQuestions(newQuestions);

    // Save to server
    try {
      await fetch('/api/admin/intake-questions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: newQuestions.map((q, i) => ({ id: q.id, sortOrder: i })),
        }),
      });
    } catch (err) {
      console.error('Error reordering questions:', err);
      loadQuestions(); // Reload on error
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'text': return 'Short Text';
      case 'textarea': return 'Long Text';
      case 'select': return 'Multiple Choice';
      default: return type;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Intake Questions</h1>
          <p className="text-gray-600 mt-1">
            Manage questions shown to volunteers during signup
          </p>
        </div>
        {!isCreating && !editingId && (
          <button
            onClick={startCreate}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
          >
            + Add Question
          </button>
        )}
      </div>

      {message && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Create/Edit Form */}
      {(isCreating || editingId) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {isCreating ? 'Create New Question' : 'Edit Question'}
          </h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Question Text *</label>
            <textarea
              value={formData.question}
              onChange={e => setFormData(prev => ({ ...prev, question: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              rows={2}
              placeholder="e.g., Do you have any prior experience with community organizing?"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Answer Type</label>
              <select
                value={formData.type}
                onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as 'text' | 'textarea' | 'select' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="text">Short Text (single line)</option>
                <option value="textarea">Long Text (multiple lines)</option>
                <option value="select">Multiple Choice (dropdown)</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.required}
                  onChange={e => setFormData(prev => ({ ...prev, required: e.target.checked }))}
                  className="w-4 h-4 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500"
                />
                <span className="text-sm font-medium text-gray-700">Required question</span>
              </label>
            </div>
          </div>

          {/* Options for select type */}
          {formData.type === 'select' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
              <div className="space-y-2">
                {formData.options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                      {opt}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeOption(idx)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newOption}
                    onChange={e => setNewOption(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOption())}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="Add an option..."
                  />
                  <button
                    type="button"
                    onClick={addOption}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
            >
              {isCreating ? 'Create Question' : 'Save Changes'}
            </button>
            <button
              onClick={cancelEdit}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                Order
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Question
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                Required
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {questions.map((q, idx) => (
              <tr key={q.id} className={!q.isActive ? 'bg-gray-50' : ''}>
                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveQuestion(q.id, 'up')}
                      disabled={idx === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveQuestion(q.id, 'down')}
                      disabled={idx === questions.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="text-sm text-gray-900">{q.question}</div>
                  {q.type === 'select' && q.options.length > 0 && (
                    <div className="mt-1 text-xs text-gray-500">
                      Options: {q.options.join(', ')}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {getTypeLabel(q.type)}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <button
                    onClick={() => handleToggleRequired(q)}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      q.required
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {q.required ? 'Required' : 'Optional'}
                  </button>
                </td>
                <td className="px-4 py-4">
                  <button
                    onClick={() => handleToggleActive(q)}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      q.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {q.isActive ? 'Active' : 'Hidden'}
                  </button>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => startEdit(q)}
                      className="text-sm text-cyan-600 hover:text-cyan-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {questions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <p className="text-gray-500 mb-4">No intake questions found.</p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={handleSeedDefaults}
                      disabled={isSeeding}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50"
                    >
                      {isSeeding ? 'Seeding...' : 'Load Default Questions'}
                    </button>
                    <button
                      onClick={startCreate}
                      className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
                    >
                      Create Custom Question
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">About Intake Questions</h3>
        <p className="text-sm text-blue-700">
          Intake questions are shown to volunteers during signup (Step 3 - Background Information).
          Active questions will appear in the order shown above. Responses are saved and visible
          when reviewing pending volunteer applications.
        </p>
      </div>
    </div>
  );
}
