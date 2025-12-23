'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ORG_TEMPLATES,
  getTemplateById,
  type OrgTemplate,
  type QualifiedRoleTemplate,
  type ShiftTypeTemplate,
  type SchedulingModel,
} from '@/lib/org-templates';

type WizardStep = 'basic' | 'template' | 'roles' | 'scheduling' | 'review';

interface FormData {
  // Step 1: Basic info
  name: string;
  slug: string;
  email: string;
  phone: string;
  website: string;

  // Step 2: Template selection
  templateId: string;
  schedulingModel: SchedulingModel;

  // Step 3: Qualified roles
  qualifiedRoles: QualifiedRoleTemplate[];

  // Step 4: Shift types (for SHIFTS model)
  shiftTypes: ShiftTypeTemplate[];
}

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'template', label: 'Template' },
  { id: 'roles', label: 'Roles' },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'review', label: 'Review' },
];

export default function OrgSetupWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    slug: '',
    email: '',
    phone: '',
    website: '',
    templateId: '',
    schedulingModel: 'SHIFTS',
    qualifiedRoles: [],
    shiftTypes: [],
  });

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  // Apply template
  const applyTemplate = (templateId: string) => {
    const template = getTemplateById(templateId);
    if (template) {
      setFormData(prev => ({
        ...prev,
        templateId,
        schedulingModel: template.schedulingModel,
        qualifiedRoles: [...template.qualifiedRoles],
        shiftTypes: [...template.shiftTypes],
      }));
    }
  };

  // Navigation
  const canGoNext = (): boolean => {
    switch (currentStep) {
      case 'basic':
        return !!formData.name && !!formData.slug;
      case 'template':
        return !!formData.templateId;
      case 'roles':
        return formData.qualifiedRoles.length > 0;
      case 'scheduling':
        return formData.schedulingModel === 'COVERAGE_GRID' || formData.shiftTypes.length > 0;
      default:
        return true;
    }
  };

  const goNext = () => {
    const stepIndex = STEPS.findIndex(s => s.id === currentStep);
    if (stepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[stepIndex + 1].id);
    }
  };

  const goBack = () => {
    const stepIndex = STEPS.findIndex(s => s.id === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(STEPS[stepIndex - 1].id);
    }
  };

  // Add/remove qualified roles
  const addRole = () => {
    setFormData(prev => ({
      ...prev,
      qualifiedRoles: [
        ...prev.qualifiedRoles,
        {
          name: '',
          slug: '',
          description: '',
          color: '#6366f1',
          countsTowardMinimum: true,
          sortOrder: prev.qualifiedRoles.length,
        },
      ],
    }));
  };

  const updateRole = (index: number, updates: Partial<QualifiedRoleTemplate>) => {
    setFormData(prev => ({
      ...prev,
      qualifiedRoles: prev.qualifiedRoles.map((role, i) =>
        i === index ? { ...role, ...updates } : role
      ),
    }));
  };

  const removeRole = (index: number) => {
    setFormData(prev => ({
      ...prev,
      qualifiedRoles: prev.qualifiedRoles.filter((_, i) => i !== index),
    }));
  };

  // Add/remove shift types
  const addShiftType = () => {
    setFormData(prev => ({
      ...prev,
      shiftTypes: [
        ...prev.shiftTypes,
        {
          name: '',
          slug: '',
          defaultMinVolunteers: 2,
          defaultIdealVolunteers: 4,
          defaultMaxVolunteers: 6,
          roleRequirements: [],
        },
      ],
    }));
  };

  const updateShiftType = (index: number, updates: Partial<ShiftTypeTemplate>) => {
    setFormData(prev => ({
      ...prev,
      shiftTypes: prev.shiftTypes.map((st, i) =>
        i === index ? { ...st, ...updates } : st
      ),
    }));
  };

  const removeShiftType = (index: number) => {
    setFormData(prev => ({
      ...prev,
      shiftTypes: prev.shiftTypes.filter((_, i) => i !== index),
    }));
  };

  // Submit
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/developer/organizations/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          website: formData.website || undefined,
          schedulingModel: formData.schedulingModel,
          qualifiedRoles: formData.qualifiedRoles,
          shiftTypes: formData.shiftTypes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create organization');
      }

      // Success - redirect to organizations list
      router.push('/developer/organizations');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'basic':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organization Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => {
                  const name = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    name,
                    slug: generateSlug(name),
                  }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="AWC Legal Observers"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subdomain Slug *
              </label>
              <div className="flex items-center">
                <input
                  type="text"
                  value={formData.slug}
                  onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase() }))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="awclo"
                />
                <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-500 text-sm">
                  .ripple-vms.com
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email (optional)
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="contact@example.org"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone (optional)
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="(919) 555-0123"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website (optional)
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={e => setFormData(prev => ({ ...prev, website: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="https://example.org"
              />
            </div>
          </div>
        );

      case 'template':
        return (
          <div className="space-y-4">
            <p className="text-gray-600 mb-6">
              Choose a template to get started quickly, or select Custom for full control.
            </p>
            <div className="grid gap-4">
              {ORG_TEMPLATES.map(template => (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template.id)}
                  className={`p-4 border-2 rounded-xl text-left transition-all ${
                    formData.templateId === template.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{template.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{template.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          template.schedulingModel === 'SHIFTS'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {template.schedulingModel === 'SHIFTS' ? 'Shift-based' : 'Coverage Grid'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          {template.qualifiedRoles.length} roles
                        </span>
                        {template.shiftTypes.length > 0 && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                            {template.shiftTypes.length} shift type{template.shiftTypes.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    {formData.templateId === template.id && (
                      <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 'roles':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-600">
                Define the volunteer roles for your organization.
              </p>
              <button
                onClick={addRole}
                className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
              >
                + Add Role
              </button>
            </div>

            {formData.qualifiedRoles.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <p className="text-gray-500">No roles defined yet. Add your first role above.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {formData.qualifiedRoles.map((role, index) => (
                  <div key={index} className="p-4 bg-white border border-gray-200 rounded-lg">
                    <div className="flex items-start gap-4">
                      <input
                        type="color"
                        value={role.color}
                        onChange={e => updateRole(index, { color: e.target.value })}
                        className="w-10 h-10 rounded cursor-pointer border border-gray-300"
                      />
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                          <input
                            type="text"
                            value={role.name}
                            onChange={e => updateRole(index, {
                              name: e.target.value,
                              slug: e.target.value.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, ''),
                            })}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            placeholder="Shift Lead"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Slug</label>
                          <input
                            type="text"
                            value={role.slug}
                            onChange={e => updateRole(index, { slug: e.target.value.toUpperCase() })}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono"
                            placeholder="SHIFT_LEAD"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                          <input
                            type="text"
                            value={role.description}
                            onChange={e => updateRole(index, { description: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            placeholder="Role description..."
                          />
                        </div>
                        <div className="col-span-2 flex items-center gap-4">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={role.countsTowardMinimum}
                              onChange={e => updateRole(index, { countsTowardMinimum: e.target.checked })}
                              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            Counts toward shift minimum
                          </label>
                        </div>
                      </div>
                      <button
                        onClick={() => removeRole(index)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'scheduling':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Scheduling Model
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setFormData(prev => ({ ...prev, schedulingModel: 'SHIFTS' }))}
                  className={`p-4 border-2 rounded-xl text-left transition-all ${
                    formData.schedulingModel === 'SHIFTS'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900">Shift-Based</div>
                  <p className="text-sm text-gray-600 mt-1">
                    Variable shift times, appointment-driven scheduling
                  </p>
                </button>
                <button
                  onClick={() => setFormData(prev => ({ ...prev, schedulingModel: 'COVERAGE_GRID' }))}
                  className={`p-4 border-2 rounded-xl text-left transition-all ${
                    formData.schedulingModel === 'COVERAGE_GRID'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900">Coverage Grid</div>
                  <p className="text-sm text-gray-600 mt-1">
                    Fixed 2-hour slots, zone-based continuous coverage
                  </p>
                </button>
              </div>
            </div>

            {formData.schedulingModel === 'SHIFTS' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Shift Types
                  </label>
                  <button
                    onClick={addShiftType}
                    className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                  >
                    + Add Shift Type
                  </button>
                </div>

                {formData.shiftTypes.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <p className="text-gray-500">No shift types defined. Add one above.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.shiftTypes.map((st, index) => (
                      <div key={index} className="p-4 bg-white border border-gray-200 rounded-lg">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1 grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                              <input
                                type="text"
                                value={st.name}
                                onChange={e => updateShiftType(index, {
                                  name: e.target.value,
                                  slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                                })}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                placeholder="Clinic Support"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Slug</label>
                              <input
                                type="text"
                                value={st.slug}
                                readOnly
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50 font-mono"
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => removeShiftType(index)}
                            className="ml-4 p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Min Volunteers</label>
                            <input
                              type="number"
                              value={st.defaultMinVolunteers}
                              onChange={e => updateShiftType(index, { defaultMinVolunteers: parseInt(e.target.value) || 1 })}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                              min={1}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Ideal</label>
                            <input
                              type="number"
                              value={st.defaultIdealVolunteers}
                              onChange={e => updateShiftType(index, { defaultIdealVolunteers: parseInt(e.target.value) || 2 })}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                              min={1}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Max</label>
                            <input
                              type="number"
                              value={st.defaultMaxVolunteers}
                              onChange={e => updateShiftType(index, { defaultMaxVolunteers: parseInt(e.target.value) || 4 })}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                              min={1}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-2">Role Requirements</label>
                          <div className="space-y-2">
                            {formData.qualifiedRoles.map(role => {
                              const req = st.roleRequirements.find(r => r.roleSlug === role.slug);
                              return (
                                <div key={role.slug} className="flex items-center gap-3 text-sm">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: role.color }}
                                  />
                                  <span className="flex-1">{role.name}</span>
                                  <label className="flex items-center gap-1">
                                    <span className="text-gray-500">Min:</span>
                                    <input
                                      type="number"
                                      value={req?.minRequired || 0}
                                      onChange={e => {
                                        const minRequired = parseInt(e.target.value) || 0;
                                        const newReqs = st.roleRequirements.filter(r => r.roleSlug !== role.slug);
                                        if (minRequired > 0) {
                                          newReqs.push({ roleSlug: role.slug, minRequired });
                                        }
                                        updateShiftType(index, { roleRequirements: newReqs });
                                      }}
                                      className="w-14 px-2 py-1 text-sm border border-gray-300 rounded"
                                      min={0}
                                    />
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {formData.schedulingModel === 'COVERAGE_GRID' && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  Coverage grid configuration (zones, time slots) can be set up after the organization is created.
                </p>
              </div>
            )}
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h3 className="font-medium text-gray-900">Organization</h3>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Name:</span>
                  <span className="font-medium">{formData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Subdomain:</span>
                  <span className="font-mono">{formData.slug}.ripple-vms.com</span>
                </div>
                {formData.email && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email:</span>
                    <span>{formData.email}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h3 className="font-medium text-gray-900">Scheduling</h3>
              </div>
              <div className="p-4">
                <span className={`px-2 py-1 rounded text-sm font-medium ${
                  formData.schedulingModel === 'SHIFTS'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {formData.schedulingModel === 'SHIFTS' ? 'Shift-Based' : 'Coverage Grid'}
                </span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h3 className="font-medium text-gray-900">Qualified Roles ({formData.qualifiedRoles.length})</h3>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {formData.qualifiedRoles.map(role => (
                    <span
                      key={role.slug}
                      className="px-3 py-1 rounded-full text-sm font-medium text-white"
                      style={{ backgroundColor: role.color }}
                    >
                      {role.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {formData.schedulingModel === 'SHIFTS' && formData.shiftTypes.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <h3 className="font-medium text-gray-900">Shift Types ({formData.shiftTypes.length})</h3>
                </div>
                <div className="p-4 space-y-3">
                  {formData.shiftTypes.map(st => (
                    <div key={st.slug} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{st.name}</span>
                      <span className="text-gray-500">
                        {st.defaultMinVolunteers}-{st.defaultMaxVolunteers} volunteers
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <Link
          href="/developer/organizations"
          className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Organizations
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">New Organization Setup</h1>
        <p className="text-gray-600 mt-1">Create a new organization with custom configuration</p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  index < currentStepIndex
                    ? 'bg-purple-600 text-white'
                    : index === currentStepIndex
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {index < currentStepIndex ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span className={`ml-2 text-sm ${
                index === currentStepIndex ? 'text-purple-600 font-medium' : 'text-gray-500'
              }`}>
                {step.label}
              </span>
              {index < STEPS.length - 1 && (
                <div className={`w-12 h-0.5 mx-2 ${
                  index < currentStepIndex ? 'bg-purple-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={goBack}
          disabled={currentStepIndex === 0}
          className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <div className="flex gap-3">
          <Link
            href="/developer/organizations"
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            Cancel
          </Link>
          {currentStep === 'review' ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Organization'}
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={!canGoNext()}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
