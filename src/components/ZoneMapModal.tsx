'use client';

import { useEffect } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import CoverageMap from './maps/CoverageMap';

interface ZoneMapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ZoneMapModal({ isOpen, onClose }: ZoneMapModalProps) {
  const focusTrapRef = useFocusTrap(isOpen);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="zone-map-modal-title"
        className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 id="zone-map-modal-title" className="text-xl font-semibold text-gray-900">Zone Coverage Map</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Map Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          <CoverageMap height="500px" />
        </div>
      </div>
    </div>
  );
}
