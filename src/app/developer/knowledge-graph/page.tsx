'use client';

import { useState } from 'react';

export default function KnowledgeGraphPage() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-50 bg-gray-900' : ''}>
      <div className={isFullscreen ? 'h-full flex flex-col' : ''}>
        {/* Header */}
        <div className={`flex items-center justify-between ${isFullscreen ? 'p-4 bg-gray-800 border-b border-gray-700' : 'mb-4'}`}>
          <div>
            <h1 className={`font-bold ${isFullscreen ? 'text-xl text-white' : 'text-2xl text-gray-900'}`}>
              Knowledge Graph
            </h1>
            <p className={isFullscreen ? 'text-gray-400 text-sm' : 'text-gray-600 mt-1'}>
              Interactive visualization of system architecture and component relationships
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="/knowledge-graph.html"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
            >
              Open in New Tab
            </a>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                isFullscreen
                  ? 'bg-gray-700 text-white hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
          </div>
        </div>

        {/* Iframe */}
        <div className={isFullscreen ? 'flex-1' : 'bg-white rounded-xl border border-gray-200 overflow-hidden'}>
          <iframe
            src="/knowledge-graph.html"
            className={isFullscreen ? 'w-full h-full' : 'w-full h-[calc(100vh-280px)] min-h-[600px]'}
            title="RippleVMS Knowledge Graph"
          />
        </div>

        {/* Info (only show when not fullscreen) */}
        {!isFullscreen && (
          <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="font-medium text-purple-800 mb-2">About the Knowledge Graph</h3>
            <p className="text-sm text-purple-700">
              This interactive visualization shows the complete architecture of RippleVMS including:
            </p>
            <ul className="text-sm text-purple-700 mt-2 space-y-1 list-disc list-inside">
              <li><strong>System Architecture</strong> - High-level overview of all layers</li>
              <li><strong>Database</strong> - Entity relationship diagrams and model descriptions</li>
              <li><strong>API Routes</strong> - Complete list of all API endpoints</li>
              <li><strong>Components</strong> - React component hierarchy</li>
              <li><strong>Workflows</strong> - Sequence diagrams for key processes</li>
              <li><strong>Permissions</strong> - Role-based access control matrix</li>
              <li><strong>File Structure</strong> - Interactive file tree</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
