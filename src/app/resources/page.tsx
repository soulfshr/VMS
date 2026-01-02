'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface UserWithOrg {
  role: string;
  organizationSlug?: string;
}

interface DispatchStep {
  step: string;
  action: string;
  responsible: string;
  isNote?: boolean;
}

const dispatchProcess: DispatchStep[] = [
  {
    step: 'The night before',
    action: 'The Dispatch Coordinator assigned to the next day checks-in with the Dispatchers the night before to confirm their shift.',
    responsible: 'Dispatch Coordinator',
  },
  {
    step: 'Note',
    action: 'If a dispatcher or zone lead is unavailable, they are responsible for finding a replacement among the "backup" list. Dispatching can be done without a zone lead but things go more smoothly when they are there.',
    responsible: '',
    isNote: true,
  },
  {
    step: 'AM shift',
    action: 'Zone leads holding the morning shift post the "welcome and upcoming orientation opportunities" message to their public signal group.',
    responsible: 'Zone Lead',
  },
  {
    step: 'Shift Start/Change',
    action: 'At the start of each shift, the Dispatch Coordinator meets with the scheduled Dispatchers on zoom to make sure Dispatchers are in the correct Zone Dispatch groups, the "Triangle - BROADCAST" group, and the "Verification Result - ICE WATCH" group. If this is a shift change (10 AM and 2 PM) the previous Dispatchers are also on the zoom line to share any important updates about what happened during their shift.',
    responsible: 'Dispatch Coordinator',
  },
  {
    step: 'Note',
    action: 'If we begin to receive confirmed reports of ICE activity, Dispatchers will go back to being on Zoom together. The Dispatch Coordinator on duty will help communicate that out to the scheduled Dispatchers.',
    responsible: '',
    isNote: true,
  },
  {
    step: 'Start of shift',
    action: 'There is one Dispatcher per county. When a Dispatcher begins their shift, they post in the zone dispatch groups that they are assigned to (all those in their county) the "hello, I\'m your new dispatcher" message.',
    responsible: 'Dispatcher',
  },
  {
    step: 'Start of shift',
    action: 'When a Zone Lead begins their shift, say hello in your zone\'s dispatch signal and let volunteers know you are available to answer their questions.',
    responsible: 'Zone Lead',
  },
  {
    step: 'Note',
    action: 'Dispatchers and Zone Leads can check the schedule in the Coordination Spreadsheet if they need to contact the other during their shift.',
    responsible: '',
    isNote: true,
  },
  {
    step: 'During shift',
    action: 'The Dispatcher is actively watching "Triangle - BROADCAST" signal group where credible reports are being posted from the Siembra hotline and social media.',
    responsible: 'Dispatcher',
  },
  {
    step: 'Note',
    action: 'The Dispatcher is not responsible for answering questions from volunteers in the zone dispatch signal group. This is the responsibility of zone leads. If they don\'t know the answer, they can reach out to the Dispatcher. Let\'s start developing a list of FAQs so we can create a doc.',
    responsible: '',
    isNote: true,
  },
  {
    step: 'Confirmed report',
    action: 'When a report is posted in the "Triangle - BROADCAST" signal group, the Dispatcher for the appropriate county should react to the comment with a Thumbs up to indicate that they are following up on the report. This is an announcement only signal group where hotline operators and social media scouts are the only ones posting.',
    responsible: 'Dispatcher',
  },
  {
    step: 'Note',
    action: 'Verifier volunteers should tell active Dispatchers about reports that they hear about (if there are sufficient details) by DMing them. Dispatchers can then post it in the appropriate Zone Dispatch signal group. If a Zone Lead sees a verifier volunteer post a report in your chat, respond and ask them to DM the dispatcher directly moving forward.',
    responsible: '',
    isNote: true,
  },
  {
    step: 'Confirmed report',
    action: 'The Dispatcher should attempt to remotely verify the report before posting it in the zone dispatch: If it is from a school or business with a public phone number, call that phone number first to see if you can verify the report remotely.',
    responsible: 'Dispatcher',
  },
  {
    step: 'Confirmed report',
    action: 'If there is a photo or video, search it in Google images and see if it is an old image.',
    responsible: 'Dispatcher',
  },
  {
    step: 'Confirmed report',
    action: 'If the report cannot be verified remotely, the Dispatcher should search the report address, identify the zone it is in, and post the dispatch request in the zone dispatch signal group.',
    responsible: 'Dispatcher',
  },
  {
    step: 'Confirmed report',
    action: 'Dispatcher should ask for verifier volunteers to 1) react to the message if they can head that way and 2) respond with their ETA. The Dispatcher should plan to call the verifier to take notes on what they see/give further instructions.',
    responsible: 'Dispatcher',
  },
  {
    step: 'Confirmed report',
    action: 'If verifier volunteers don\'t respond in a timely manner to the dispatch request, the zone leader should get involved to find volunteers or do the verifying themselves.',
    responsible: 'Zone Lead',
  },
  {
    step: 'Confirmed report',
    action: 'If a report is confirmed, the Dispatcher posts a detailed but brief description of the confirmed report in the "Verification Result - ICE WATCH" signal group.',
    responsible: 'Dispatcher',
  },
  {
    step: 'Confirmed report',
    action: 'After a confirmed report is posted in the "Verification Result - ICE Watch" signal group, it will be put on the ojonc.org website and shared to other platforms.',
    responsible: 'Siembra Staff',
  },
  {
    step: 'Confirmed report',
    action: 'After a confirmed report, the Dispatcher should get any videos of the interactions with ICE/CBP/DHS and add them to the Siembra dropbox. The video should be titled: "Date.Location"',
    responsible: 'Dispatcher',
  },
  {
    step: 'Unconfirmed report',
    action: 'If a report is not confirmed as ICE, the Dispatcher should share that in the Zone Dispatch signal group (if the verifier hasn\'t already) and in the "Verification Result - ICE Watch" signal group. Reports that came from the community that are unconfirmed don\'t need to be added to the "Verification Result" signal group.',
    responsible: 'Dispatcher',
  },
  {
    step: 'Note',
    action: 'Each shift will have (hopefully) one experienced Dispatcher who should be a resource to the other two Dispatchers to answer general questions that come up about how to play the role, what to do in certain situations, etc. Bigger questions around changing up a system or questions for Siembra can be directed to the on-call Coordinator for that day.',
    responsible: '',
    isNote: true,
  },
  {
    step: 'PM Shift',
    action: 'Zone lead posts an end of shift message in their zone public signal with an update from the day and reminders about future orientations.',
    responsible: 'Zone Lead',
  },
];

// Org-specific resource configuration
// TODO: Move to org settings (customResourceLinks) for full multi-tenant support
// For now, certain orgs have dispatch-specific documentation
const ORG_SPECIFIC_RESOURCES: Record<string, boolean> = {
  'siembra-nc': true,
  'siembra': true,
};

export default function ResourcesPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserWithOrg | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgSlug, setOrgSlug] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/session').then(res => res.json()),
      fetch('/api/org/current').then(res => res.json()).catch(() => ({ slug: null })),
    ])
      .then(([sessionData, orgData]) => {
        if (!sessionData.user) {
          router.push('/login');
        } else {
          setUser(sessionData.user);
          setOrgSlug(orgData.slug || null);
        }
        setLoading(false);
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  // Check if this org has configured resources
  const hasOrgSpecificResources = orgSlug && ORG_SPECIFIC_RESOURCES[orgSlug];

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  const getResponsibleBadgeColor = (responsible: string) => {
    switch (responsible) {
      case 'Dispatch Coordinator':
        return 'bg-purple-100 text-purple-800';
      case 'Zone Lead':
        return 'bg-amber-100 text-amber-800';
      case 'Dispatcher':
        return 'bg-blue-100 text-blue-800';
      case 'Siembra Staff':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Show placeholder for orgs without configured resources
  if (!hasOrgSpecificResources) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Resources</h1>
            <p className="text-gray-600 mt-1">
              Reference materials and process documentation for volunteers
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No resources configured</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Your organization does not have any resources configured yet.
              Contact your administrator to set up resources for your team.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Resources</h1>
          <p className="text-gray-600 mt-1">
            Reference materials and process documentation for volunteers
          </p>
        </div>

        {/* Resource Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-cyan-200 p-4 border-l-4 border-l-cyan-600">
            <h3 className="font-semibold text-gray-900">Dispatch Process</h3>
            <p className="text-sm text-gray-600 mt-1">Step-by-step guide for dispatchers and zone leads</p>
          </div>
          {/* Future resource cards can be added here */}
        </div>

        {/* Dispatch Process Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">Dispatch Process</h2>
            <p className="text-sm text-gray-600 mt-1">
              This document outlines the responsibilities and workflow for dispatchers and zone leads during their shifts.
            </p>
          </div>

          {/* Legend */}
          <div className="px-6 py-3 border-b border-gray-200 bg-white flex flex-wrap gap-3">
            <span className="text-xs text-gray-500 mr-2">Roles:</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getResponsibleBadgeColor('Dispatch Coordinator')}`}>
              Dispatch Coordinator
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getResponsibleBadgeColor('Zone Lead')}`}>
              Zone Lead
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getResponsibleBadgeColor('Dispatcher')}`}>
              Dispatcher
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getResponsibleBadgeColor('Siembra Staff')}`}>
              Siembra Staff
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    Step
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-44">
                    Who is responsible?
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dispatchProcess.map((item, index) => (
                  <tr
                    key={index}
                    className={item.isNote ? 'bg-amber-50' : 'hover:bg-gray-50'}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 align-top">
                      {item.isNote ? (
                        <span className="text-amber-700 italic">Note</span>
                      ) : (
                        item.step
                      )}
                    </td>
                    <td className={`px-4 py-3 text-sm align-top ${item.isNote ? 'text-amber-800 italic' : 'text-gray-700'}`}>
                      {item.action}
                    </td>
                    <td className="px-4 py-3 text-sm align-top">
                      {item.responsible && (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getResponsibleBadgeColor(item.responsible)}`}>
                          {item.responsible}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
