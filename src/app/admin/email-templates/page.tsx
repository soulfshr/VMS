'use client';

import { useEffect, useState } from 'react';

interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  defaultSubject: string;
  defaultContent: string;
  templateType: 'SYSTEM' | 'CUSTOM';
  isActive: boolean;
  sortOrder: number;
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    icon: '📧',
    defaultSubject: '',
    defaultContent: '',
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/admin/email-templates');
      const data = await res.json();
      if (Array.isArray(data)) {
        setTemplates(data);
      }
    } catch (err) {
      console.error('Error loading email templates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      icon: '📧',
      defaultSubject: '',
      defaultContent: '',
    });
  };

  const generateSlug = (name: string) => {
    return name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  };

  const startEdit = (t: EmailTemplate) => {
    setEditingId(t.id);
    setIsCreating(false);
    setFormData({
      name: t.name,
      slug: t.slug,
      description: t.description || '',
      icon: t.icon,
      defaultSubject: t.defaultSubject,
      defaultContent: t.defaultContent,
    });
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

  const handleSave = async () => {
    setMessage(null);

    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: 'Template name is required' });
      return;
    }

    if (!formData.defaultSubject.trim()) {
      setMessage({ type: 'error', text: 'Default subject is required' });
      return;
    }

    // Generate slug from name if not provided
    const slug = formData.slug || generateSlug(formData.name);

    try {
      const url = isCreating
        ? '/api/admin/email-templates'
        : `/api/admin/email-templates/${editingId}`;
      const method = isCreating ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          slug,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }

      setMessage({ type: 'success', text: isCreating ? 'Template created' : 'Template updated' });
      cancelEdit();
      loadTemplates();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    }
  };

  const handleDelete = async (t: EmailTemplate) => {
    if (t.templateType === 'SYSTEM') {
      setMessage({ type: 'error', text: 'Cannot delete system templates. You can deactivate them instead.' });
      return;
    }

    if (!confirm('Are you sure you want to delete this template?')) return;

    setMessage(null);
    try {
      const res = await fetch(`/api/admin/email-templates/${t.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete');
      }

      setMessage({ type: 'success', text: 'Template deleted' });
      loadTemplates();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete' });
    }
  };

  const handleToggleActive = async (t: EmailTemplate) => {
    try {
      const res = await fetch(`/api/admin/email-templates/${t.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !t.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      loadTemplates();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update status' });
    }
  };

  const handleSeedDefaults = async () => {
    if (!confirm('This will add the default email templates. Continue?')) return;

    setIsSeeding(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/email-templates/seed', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to seed');
      }
      const data = await res.json();
      setMessage({ type: 'success', text: `Added ${data.count} default templates` });
      loadTemplates();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to seed' });
    } finally {
      setIsSeeding(false);
    }
  };

  const moveTemplate = async (id: string, direction: 'up' | 'down') => {
    const idx = templates.findIndex(t => t.id === id);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === templates.length - 1) return;

    const newTemplates = [...templates];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;

    // Swap sort orders
    const tempOrder = newTemplates[idx].sortOrder;
    newTemplates[idx].sortOrder = newTemplates[swapIdx].sortOrder;
    newTemplates[swapIdx].sortOrder = tempOrder;

    // Swap positions in array
    [newTemplates[idx], newTemplates[swapIdx]] = [newTemplates[swapIdx], newTemplates[idx]];

    setTemplates(newTemplates);

    // Save to server
    try {
      await fetch('/api/admin/email-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templates: newTemplates.map((t, i) => ({ id: t.id, sortOrder: i })),
        }),
      });
    } catch (err) {
      console.error('Error reordering templates:', err);
      loadTemplates(); // Reload on error
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
          <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
          <p className="text-gray-600 mt-1">
            Manage email templates for blast emails
          </p>
        </div>
        {!isCreating && !editingId && (
          <button
            onClick={startCreate}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
          >
            + Add Template
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
            {isCreating ? 'Create New Template' : 'Edit Template'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="e.g., Weekly Digest"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Icon
                <span className="text-gray-400 font-normal ml-1">(emoji)</span>
              </label>
              <input
                type="text"
                value={formData.icon}
                onChange={e => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="📧"
                maxLength={4}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="Brief description of when to use this template"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Subject *</label>
            <input
              type="text"
              value={formData.defaultSubject}
              onChange={e => setFormData(prev => ({ ...prev, defaultSubject: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="Email subject line"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Content</label>
            <textarea
              value={formData.defaultContent}
              onChange={e => setFormData(prev => ({ ...prev, defaultContent: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              rows={6}
              placeholder="Email body content. Use {{volunteerName}} to insert the recipient's name."
            />
            <p className="mt-1 text-xs text-gray-500">
              Available placeholders: {'{{volunteerName}}'}, {'{{organizationName}}'}
            </p>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
            >
              {isCreating ? 'Create Template' : 'Save Changes'}
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

      {/* Templates List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                Order
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Template
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                Type
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
            {templates.map((t, idx) => (
              <tr key={t.id} className={!t.isActive ? 'bg-gray-50' : ''}>
                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveTemplate(t.id, 'up')}
                      disabled={idx === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveTemplate(t.id, 'down')}
                      disabled={idx === templates.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{t.icon}</span>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{t.name}</div>
                      {t.description && (
                        <div className="text-xs text-gray-500">{t.description}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-0.5">
                        Subject: {t.defaultSubject || '(blank)'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    t.templateType === 'SYSTEM'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {t.templateType === 'SYSTEM' ? 'System' : 'Custom'}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <button
                    onClick={() => handleToggleActive(t)}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      t.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {t.isActive ? 'Active' : 'Hidden'}
                  </button>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => startEdit(t)}
                      className="text-sm text-cyan-600 hover:text-cyan-700"
                    >
                      Edit
                    </button>
                    {t.templateType !== 'SYSTEM' && (
                      <button
                        onClick={() => handleDelete(t)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {templates.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center">
                  <p className="text-gray-500 mb-4">No email templates found.</p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={handleSeedDefaults}
                      disabled={isSeeding}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50"
                    >
                      {isSeeding ? 'Seeding...' : 'Load Default Templates'}
                    </button>
                    <button
                      onClick={startCreate}
                      className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
                    >
                      Create Custom Template
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
        <h3 className="font-medium text-blue-800 mb-2">About Email Templates</h3>
        <p className="text-sm text-blue-700 mb-2">
          Email templates define the default subject and content for blast emails. Coordinators
          select a template when creating an email blast, then customize it before sending.
        </p>
        <p className="text-sm text-blue-700">
          <strong>System templates</strong> have special placeholders for dynamic content
          (like shift listings). <strong>Custom templates</strong> are for general-purpose emails
          you define for your organization.
        </p>
      </div>
    </div>
  );
}
