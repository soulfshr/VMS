'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Template {
  id: string;
  question: string;
  type: 'text' | 'textarea' | 'select';
  options: string[];
  required: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export default function DefaultIntakeQuestionsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New question form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    question: '',
    type: 'text' as 'text' | 'textarea' | 'select',
    options: [] as string[],
    required: false,
  });
  const [newOption, setNewOption] = useState('');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/developer/default-intake-questions');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      } else {
        setError('Failed to load templates');
      }
    } catch {
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedDefaults = async () => {
    if (templates.length > 0) {
      if (!confirm('This will only work if there are no templates. Delete all templates first?')) {
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/developer/default-intake-questions/seed-hardcoded', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message);
        fetchTemplates();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Failed to seed defaults');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = editingId
        ? `/api/developer/default-intake-questions/${editingId}`
        : '/api/developer/default-intake-questions';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setSuccess(editingId ? 'Template updated' : 'Template created');
        resetForm();
        fetchTemplates();
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } catch {
      setError('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (template: Template) => {
    setEditingId(template.id);
    setFormData({
      question: template.question,
      type: template.type,
      options: template.options,
      required: template.required,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/developer/default-intake-questions/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSuccess('Template deleted');
        fetchTemplates();
      } else {
        setError('Failed to delete template');
      }
    } catch {
      setError('Failed to delete template');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newTemplates = [...templates];
    [newTemplates[index - 1], newTemplates[index]] = [newTemplates[index], newTemplates[index - 1]];

    const updates = newTemplates.map((t, i) => ({ id: t.id, sortOrder: i + 1 }));

    try {
      const res = await fetch('/api/developer/default-intake-questions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      if (res.ok) {
        setTemplates(await res.json());
      }
    } catch {
      setError('Failed to reorder');
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === templates.length - 1) return;
    const newTemplates = [...templates];
    [newTemplates[index], newTemplates[index + 1]] = [newTemplates[index + 1], newTemplates[index]];

    const updates = newTemplates.map((t, i) => ({ id: t.id, sortOrder: i + 1 }));

    try {
      const res = await fetch('/api/developer/default-intake-questions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      if (res.ok) {
        setTemplates(await res.json());
      }
    } catch {
      setError('Failed to reorder');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      question: '',
      type: 'text',
      options: [],
      required: false,
    });
    setNewOption('');
  };

  const addOption = () => {
    if (newOption.trim()) {
      setFormData(prev => ({
        ...prev,
        options: [...prev.options, newOption.trim()],
      }));
      setNewOption('');
    }
  };

  const removeOption = (index: number) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/developer" className="text-cyan-600 hover:underline text-sm">
          &larr; Back to Developer Console
        </Link>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Default Intake Questions</h1>
          <p className="text-gray-600 text-sm mt-1">
            These templates are used when organizations seed their intake questions.
          </p>
        </div>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <button
              onClick={handleSeedDefaults}
              disabled={saving}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              Load Defaults
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
          >
            Add Template
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500">&times;</button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-2 text-green-500">&times;</button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold mb-4">
            {editingId ? 'Edit Template' : 'New Template'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Question Text
              </label>
              <textarea
                value={formData.question}
                onChange={e => setFormData(prev => ({ ...prev, question: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
                rows={2}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    type: e.target.value as 'text' | 'textarea' | 'select',
                    options: e.target.value === 'select' ? prev.options : [],
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
                >
                  <option value="text">Short Text</option>
                  <option value="textarea">Long Text</option>
                  <option value="select">Dropdown</option>
                </select>
              </div>

              <div className="flex items-center">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.required}
                    onChange={e => setFormData(prev => ({ ...prev, required: e.target.checked }))}
                    className="mr-2 h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Required</span>
                </label>
              </div>
            </div>

            {formData.type === 'select' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Options
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newOption}
                    onChange={e => setNewOption(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addOption())}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
                    placeholder="Add option..."
                  />
                  <button
                    type="button"
                    onClick={addOption}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.options.map((opt, i) => (
                    <span key={i} className="inline-flex items-center px-2 py-1 bg-gray-100 rounded text-sm">
                      {opt}
                      <button
                        type="button"
                        onClick={() => removeOption(i)}
                        className="ml-1 text-gray-500 hover:text-red-500"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
                {formData.type === 'select' && formData.options.length === 0 && (
                  <p className="text-sm text-red-500 mt-1">At least one option is required</p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving || (formData.type === 'select' && formData.options.length === 0)}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Templates list */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        {templates.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="mb-4">No default intake question templates configured.</p>
            <button
              onClick={handleSeedDefaults}
              disabled={saving}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50"
            >
              Load Default Templates
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-12">
                  Order
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Question
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">
                  Type
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-20">
                  Required
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-32">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {templates.map((template, index) => (
                <tr key={template.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      >
                        &#9650;
                      </button>
                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={index === templates.length - 1}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      >
                        &#9660;
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{template.question}</div>
                    {template.type === 'select' && template.options.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        Options: {template.options.join(', ')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs rounded ${
                      template.type === 'text' ? 'bg-blue-100 text-blue-800' :
                      template.type === 'textarea' ? 'bg-purple-100 text-purple-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {template.type === 'text' ? 'Short' :
                       template.type === 'textarea' ? 'Long' : 'Dropdown'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {template.required ? (
                      <span className="text-green-600">Yes</span>
                    ) : (
                      <span className="text-gray-400">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEdit(template)}
                      className="text-cyan-600 hover:text-cyan-800 text-sm mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {templates.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">How it works</h3>
          <p className="text-sm text-blue-800">
            When an organization administrator clicks &quot;Load Default Questions&quot; in their admin panel,
            these templates are copied to their organization&apos;s intake questions. Changes here affect
            future seeding operations only - existing organization questions are not modified.
          </p>
        </div>
      )}
    </div>
  );
}
