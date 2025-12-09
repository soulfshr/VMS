'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';

// Field definitions for shift import
interface FieldDefinition {
  key: string;
  label: string;
  required: boolean;
  description: string;
  example: string;
  validator?: (value: string, context?: ValidationContext) => string | null;
}

interface ValidationContext {
  zones: { id: string; name: string }[];
  shiftTypes: { id: string; name: string; slug: string }[];
}

interface ParsedRow {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
  isValid: boolean;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: { row: number; errors: string[] }[];
}

// Date formats we'll try to parse
const parseDate = (value: string): Date | null => {
  if (!value) return null;

  // Try various formats
  const formats = [
    // ISO format
    /^(\d{4})-(\d{2})-(\d{2})$/,
    // US format
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // US format with 2-digit year
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
  ];

  for (const format of formats) {
    const match = value.match(format);
    if (match) {
      if (format === formats[0]) {
        // ISO: YYYY-MM-DD
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      } else if (format === formats[1]) {
        // US: MM/DD/YYYY
        return new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
      } else if (format === formats[2]) {
        // US: MM/DD/YY
        const year = parseInt(match[3]) + 2000;
        return new Date(year, parseInt(match[1]) - 1, parseInt(match[2]));
      }
    }
  }

  // Try native Date parsing as fallback
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

// Parse time string to hours and minutes
const parseTime = (value: string): { hours: number; minutes: number } | null => {
  if (!value) return null;

  // Try HH:MM format (24h or 12h)
  const timeMatch = value.match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3]?.toLowerCase();

    if (ampm === 'pm' && hours !== 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return { hours, minutes };
    }
  }

  return null;
};

const FIELD_DEFINITIONS: FieldDefinition[] = [
  {
    key: 'title',
    label: 'Title',
    required: true,
    description: 'Name/title of the shift',
    example: 'Morning Patrol - Zone 1',
    validator: (value) => value.trim() ? null : 'Title is required',
  },
  {
    key: 'date',
    label: 'Date',
    required: true,
    description: 'Date of the shift (YYYY-MM-DD or MM/DD/YYYY)',
    example: '2025-01-15 or 01/15/2025',
    validator: (value) => {
      const date = parseDate(value);
      if (!date) return 'Invalid date format. Use YYYY-MM-DD or MM/DD/YYYY';
      return null;
    },
  },
  {
    key: 'startTime',
    label: 'Start Time',
    required: true,
    description: 'Start time (HH:MM, 24h or 12h with am/pm)',
    example: '09:00 or 9:00 AM',
    validator: (value) => {
      const time = parseTime(value);
      if (!time) return 'Invalid time format. Use HH:MM or HH:MM AM/PM';
      return null;
    },
  },
  {
    key: 'endTime',
    label: 'End Time',
    required: true,
    description: 'End time (HH:MM, 24h or 12h with am/pm)',
    example: '12:00 or 12:00 PM',
    validator: (value) => {
      const time = parseTime(value);
      if (!time) return 'Invalid time format. Use HH:MM or HH:MM AM/PM';
      return null;
    },
  },
  {
    key: 'zone',
    label: 'Zone',
    required: true,
    description: 'Zone name (must match existing zone)',
    example: 'Durham 1',
    validator: (value, context) => {
      if (!value.trim()) return 'Zone is required';
      if (context?.zones) {
        const found = context.zones.find(z =>
          z.name.toLowerCase() === value.trim().toLowerCase()
        );
        if (!found) return `Zone "${value}" not found`;
      }
      return null;
    },
  },
  {
    key: 'type',
    label: 'Shift Type',
    required: true,
    description: 'Type of shift (Patrol, Collection, On-Call Field Support)',
    example: 'Patrol',
    validator: (value, context) => {
      if (!value.trim()) return 'Shift type is required';
      if (context?.shiftTypes) {
        const found = context.shiftTypes.find(t =>
          t.name.toLowerCase() === value.trim().toLowerCase() ||
          t.slug.toLowerCase() === value.trim().toLowerCase().replace(/[\s-]/g, '_')
        );
        if (!found) return `Shift type "${value}" not found. Valid types: ${context.shiftTypes.map(t => t.name).join(', ')}`;
      }
      return null;
    },
  },
  {
    key: 'description',
    label: 'Description',
    required: false,
    description: 'Optional description of the shift',
    example: 'Meet at the community center',
  },
  {
    key: 'meetingLocation',
    label: 'Meeting Location',
    required: false,
    description: 'Where volunteers should meet',
    example: '123 Main St, Durham, NC',
  },
  {
    key: 'minVolunteers',
    label: 'Min Volunteers',
    required: false,
    description: 'Minimum volunteers needed (default: 2)',
    example: '2',
    validator: (value) => {
      if (!value) return null;
      const num = parseInt(value);
      if (isNaN(num) || num < 1) return 'Must be a positive number';
      return null;
    },
  },
  {
    key: 'idealVolunteers',
    label: 'Ideal Volunteers',
    required: false,
    description: 'Ideal number of volunteers (default: 4)',
    example: '4',
    validator: (value) => {
      if (!value) return null;
      const num = parseInt(value);
      if (isNaN(num) || num < 1) return 'Must be a positive number';
      return null;
    },
  },
  {
    key: 'maxVolunteers',
    label: 'Max Volunteers',
    required: false,
    description: 'Maximum volunteers allowed (default: 6)',
    example: '6',
    validator: (value) => {
      if (!value) return null;
      const num = parseInt(value);
      if (isNaN(num) || num < 1) return 'Must be a positive number';
      return null;
    },
  },
  {
    key: 'status',
    label: 'Status',
    required: false,
    description: 'Shift status (default: DRAFT)',
    example: 'PUBLISHED',
    validator: (value) => {
      if (!value) return null;
      const valid = ['DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
      if (!valid.includes(value.toUpperCase())) {
        return `Invalid status. Valid values: ${valid.join(', ')}`;
      }
      return null;
    },
  },
];

// Simple CSV parser that handles quoted fields
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);

  return { headers, rows };
}

export default function ShiftsImportPage() {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'results'>('upload');
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [validationContext, setValidationContext] = useState<ValidationContext | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load zones and shift types for validation
  const loadValidationContext = useCallback(async () => {
    try {
      const [zonesRes, typesRes] = await Promise.all([
        fetch('/api/zones'),
        fetch('/api/admin/shift-types'),
      ]);

      const zones = await zonesRes.json();
      const types = await typesRes.json();

      setValidationContext({
        zones: Array.isArray(zones) ? zones : [],
        shiftTypes: Array.isArray(types) ? types : [],
      });
    } catch (err) {
      console.error('Error loading validation context:', err);
    }
  }, []);

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsLoading(true);

    try {
      const text = await file.text();
      const parsed = parseCSV(text);

      if (parsed.headers.length === 0) {
        throw new Error('No data found in CSV file');
      }

      if (parsed.rows.length === 0) {
        throw new Error('No data rows found in CSV file');
      }

      setCsvData(parsed);

      // Auto-map columns based on header names
      const autoMapping: Record<string, string> = {};
      FIELD_DEFINITIONS.forEach(field => {
        const matchIndex = parsed.headers.findIndex(h =>
          h.toLowerCase().replace(/[\s_-]/g, '') === field.key.toLowerCase() ||
          h.toLowerCase().replace(/[\s_-]/g, '') === field.label.toLowerCase().replace(/[\s_-]/g, '')
        );
        if (matchIndex !== -1) {
          autoMapping[field.key] = parsed.headers[matchIndex];
        }
      });
      setColumnMapping(autoMapping);

      // Load validation context
      await loadValidationContext();

      setStep('mapping');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file');
    } finally {
      setIsLoading(false);
    }
  };

  // Validate and preview data
  const handlePreview = () => {
    if (!csvData || !validationContext) return;

    const rows: ParsedRow[] = csvData.rows.map((row, index) => {
      const data: Record<string, string> = {};
      const errors: string[] = [];

      // Map CSV columns to field values
      FIELD_DEFINITIONS.forEach(field => {
        const csvColumn = columnMapping[field.key];
        if (csvColumn) {
          const colIndex = csvData.headers.indexOf(csvColumn);
          data[field.key] = colIndex !== -1 ? (row[colIndex] || '') : '';
        } else {
          data[field.key] = '';
        }
      });

      // Validate each field
      FIELD_DEFINITIONS.forEach(field => {
        const value = data[field.key] || '';

        // Check required fields
        if (field.required && !value.trim()) {
          errors.push(`${field.label} is required`);
          return;
        }

        // Run custom validator
        if (value && field.validator) {
          const error = field.validator(value, validationContext);
          if (error) errors.push(error);
        }
      });

      // Cross-field validations
      if (data.startTime && data.endTime) {
        const start = parseTime(data.startTime);
        const end = parseTime(data.endTime);
        if (start && end) {
          const startMins = start.hours * 60 + start.minutes;
          const endMins = end.hours * 60 + end.minutes;
          if (endMins <= startMins) {
            errors.push('End time must be after start time');
          }
        }
      }

      // Volunteer count validations
      const min = parseInt(data.minVolunteers) || 2;
      const ideal = parseInt(data.idealVolunteers) || 4;
      const max = parseInt(data.maxVolunteers) || 6;
      if (min > ideal) errors.push('Min volunteers cannot exceed ideal');
      if (ideal > max) errors.push('Ideal volunteers cannot exceed max');
      if (min > max) errors.push('Min volunteers cannot exceed max');

      return {
        rowNumber: index + 2, // +2 because row 1 is headers and we're 0-indexed
        data,
        errors,
        isValid: errors.length === 0,
      };
    });

    setParsedRows(rows);
    setStep('preview');
  };

  // Execute import
  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) return;

    setIsLoading(true);
    setStep('importing');

    try {
      const response = await fetch('/api/admin/shifts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shifts: validRows.map(r => r.data),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }

      setImportResult(result);
      setStep('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset workflow
  const handleReset = () => {
    setStep('upload');
    setCsvData(null);
    setColumnMapping({});
    setParsedRows([]);
    setImportResult(null);
    setError(null);
  };

  // Generate sample CSV
  const handleDownloadSample = () => {
    const headers = FIELD_DEFINITIONS.map(f => f.label).join(',');
    const sampleRow = FIELD_DEFINITIONS.map(f => f.example).join(',');
    const csv = `${headers}\n${sampleRow}`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shifts_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bulk Import Shifts</h1>
        <p className="text-gray-600 mt-1">Import multiple shifts from a CSV file</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          {['upload', 'mapping', 'preview', 'results'].map((s, i) => (
            <div key={s} className="flex items-center">
              {i > 0 && <div className={`w-8 h-0.5 ${['mapping', 'preview', 'importing', 'results'].indexOf(step) >= i ? 'bg-cyan-600' : 'bg-gray-200'}`} />}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s || (step === 'importing' && s === 'preview')
                  ? 'bg-cyan-600 text-white'
                  : ['mapping', 'preview', 'importing', 'results'].indexOf(step) > ['upload', 'mapping', 'preview', 'results'].indexOf(s)
                    ? 'bg-cyan-100 text-cyan-700'
                    : 'bg-gray-200 text-gray-500'
              }`}>
                {i + 1}
              </div>
            </div>
          ))}
          <span className="ml-3 text-sm text-gray-600 capitalize">
            {step === 'importing' ? 'Importing...' : step}
          </span>
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="max-w-xl mx-auto text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📄</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Upload CSV File</h2>
              <p className="text-gray-600 mt-1">Select a CSV file containing shift data</p>
            </div>

            <label className="block">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-cyan-500 hover:bg-cyan-50/50 transition-colors cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isLoading}
                />
                {isLoading ? (
                  <div className="flex flex-col items-center">
                    <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full mb-2" />
                    <span className="text-gray-600">Processing file...</span>
                  </div>
                ) : (
                  <>
                    <span className="text-4xl block mb-2">📁</span>
                    <span className="text-cyan-600 font-medium">Click to browse</span>
                    <span className="text-gray-500 block text-sm mt-1">or drag and drop a CSV file</span>
                  </>
                )}
              </div>
            </label>

            <button
              onClick={handleDownloadSample}
              className="mt-4 text-sm text-cyan-600 hover:text-cyan-700 underline"
            >
              Download sample CSV template
            </button>

            {/* Field reference */}
            <div className="mt-8 text-left">
              <h3 className="font-medium text-gray-900 mb-3">Field Reference</h3>
              <div className="bg-gray-50 rounded-lg p-4 max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="pb-2">Field</th>
                      <th className="pb-2">Required</th>
                      <th className="pb-2">Example</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    {FIELD_DEFINITIONS.map(field => (
                      <tr key={field.key} className="border-t border-gray-200">
                        <td className="py-2 font-medium">{field.label}</td>
                        <td className="py-2">
                          {field.required ? (
                            <span className="text-red-600">Yes</span>
                          ) : (
                            <span className="text-gray-500">No</span>
                          )}
                        </td>
                        <td className="py-2 text-gray-500 font-mono text-xs">{field.example}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === 'mapping' && csvData && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Map CSV Columns</h2>
          <p className="text-gray-600 mb-6">
            Match your CSV columns to the shift fields. Required fields are marked with *.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {FIELD_DEFINITIONS.map(field => (
              <div key={field.key} className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <select
                  value={columnMapping[field.key] || ''}
                  onChange={(e) => setColumnMapping(prev => ({
                    ...prev,
                    [field.key]: e.target.value,
                  }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                >
                  <option value="">-- Select column --</option>
                  {csvData.headers.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
                <span className="text-xs text-gray-500">{field.description}</span>
              </div>
            ))}
          </div>

          {/* Preview of first few rows */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Data Preview (first 3 rows)</h3>
            <div className="bg-gray-50 rounded-lg p-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500">
                    {csvData.headers.map(h => (
                      <th key={h} className="pb-2 pr-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-gray-700 font-mono">
                  {csvData.rows.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-t border-gray-200">
                      {row.map((cell, j) => (
                        <td key={j} className="py-1 pr-4 whitespace-nowrap max-w-[200px] truncate">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Total rows: {csvData.rows.length}
            </p>
          </div>

          <div className="flex justify-between">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              ← Back to Upload
            </button>
            <button
              onClick={handlePreview}
              disabled={!FIELD_DEFINITIONS.filter(f => f.required).every(f => columnMapping[f.key])}
              className="px-6 py-2 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Validate & Preview →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Validation Preview */}
      {(step === 'preview' || step === 'importing') && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Validation Results</h2>
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                Valid: {validCount}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                Invalid: {invalidCount}
              </span>
            </div>
          </div>

          {invalidCount > 0 && (
            <div className="mb-4 p-3 bg-amber-50 text-amber-800 rounded-lg border border-amber-200 text-sm">
              ⚠️ {invalidCount} row(s) have validation errors and will be skipped during import.
            </div>
          )}

          <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg mb-6">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-left text-gray-600">
                  <th className="px-3 py-2 w-16">Row</th>
                  <th className="px-3 py-2 w-16">Status</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Zone</th>
                  <th className="px-3 py-2">Errors</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map(row => (
                  <tr
                    key={row.rowNumber}
                    className={`border-t ${row.isValid ? 'bg-white' : 'bg-red-50'}`}
                  >
                    <td className="px-3 py-2 text-gray-500">{row.rowNumber}</td>
                    <td className="px-3 py-2">
                      {row.isValid ? (
                        <span className="text-green-600">✓</span>
                      ) : (
                        <span className="text-red-600">✗</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium">{row.data.title || '—'}</td>
                    <td className="px-3 py-2">{row.data.date || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {row.data.startTime && row.data.endTime
                        ? `${row.data.startTime} - ${row.data.endTime}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2">{row.data.zone || '—'}</td>
                    <td className="px-3 py-2 text-red-600 text-xs">
                      {row.errors.join('; ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep('mapping')}
              disabled={step === 'importing'}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >
              ← Back to Mapping
            </button>
            <button
              onClick={handleImport}
              disabled={validCount === 0 || step === 'importing'}
              className="px-6 py-2 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {step === 'importing' ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Importing...
                </>
              ) : (
                <>Import {validCount} Shifts</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Results */}
      {step === 'results' && importResult && (
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✅</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Import Complete</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mb-6">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{importResult.success}</div>
              <div className="text-sm text-green-700">Shifts Created</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-red-600">{importResult.failed}</div>
              <div className="text-sm text-red-700">Failed</div>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <div className="mb-6">
              <h3 className="font-medium text-gray-900 mb-2">Import Errors</h3>
              <div className="bg-red-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                {importResult.errors.map((err, i) => (
                  <div key={i} className="text-sm text-red-700 mb-1">
                    Row {err.row}: {err.errors.join(', ')}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-center gap-4">
            <button
              onClick={handleReset}
              className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
            >
              Import More Shifts
            </button>
            <Link
              href="/shifts"
              className="px-6 py-2 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700"
            >
              View Shifts
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
