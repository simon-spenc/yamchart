import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export function OrgSwitcher() {
  const { orgs, currentOrg, switchOrg } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (orgs.length <= 1) {
    return (
      <span className="text-sm font-medium text-gray-700">
        {currentOrg?.name || 'No organization'}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
      >
        {currentOrg?.name}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
            {orgs.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  switchOrg(org.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                  org.id === currentOrg?.id ? 'bg-gray-50 font-medium' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{org.name}</span>
                  <span className="text-xs text-gray-500 capitalize">{org.role}</span>
                </div>
              </button>
            ))}
            <div className="border-t border-gray-100 mt-1 pt-1">
              <a
                href="/orgs/new"
                className="block px-4 py-2 text-sm text-primary-600 hover:bg-gray-50"
              >
                Create new organization
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
