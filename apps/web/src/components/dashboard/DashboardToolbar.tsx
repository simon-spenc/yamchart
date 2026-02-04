import { useState } from 'react';
import { clsx } from 'clsx';
import { useBranches, useCheckoutBranch, useSaveDashboard, useRefreshDashboard } from '../../hooks';
import { useEditMode } from './EditModeContext';
import { useIsFetching } from '@tanstack/react-query';

interface DashboardToolbarProps {
  dashboardId: string;
  title: string;
  currentBranch: string;
}

export function DashboardToolbar({
  dashboardId,
  title,
  currentBranch,
}: DashboardToolbarProps) {
  const { isEditing, setIsEditing, pendingLayout, setPendingLayout, hasChanges } =
    useEditMode();
  const { data: branchesData } = useBranches();
  const checkoutBranch = useCheckoutBranch();
  const saveDashboard = useSaveDashboard(dashboardId);
  const refreshDashboard = useRefreshDashboard();
  const isFetching = useIsFetching({ queryKey: ['chartData'] });

  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

  const handleRefresh = () => {
    refreshDashboard();
  };

  const handleSave = async () => {
    if (!pendingLayout) return;

    try {
      await saveDashboard.mutateAsync({ layout: pendingLayout });
      setPendingLayout(null);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  const handleCancel = () => {
    setPendingLayout(null);
    setIsEditing(false);
  };

  const handleBranchChange = async (branch: string) => {
    setShowBranchDropdown(false);
    await checkoutBranch.mutateAsync(branch);
  };

  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>

        {/* Branch selector */}
        <div className="relative">
          <button
            onClick={() => setShowBranchDropdown(!showBranchDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 rounded-md hover:bg-gray-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            {currentBranch}
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {showBranchDropdown && branchesData && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
              {branchesData.branches.map((branch) => (
                <button
                  key={branch}
                  onClick={() => handleBranchChange(branch)}
                  className={clsx(
                    'w-full text-left px-4 py-2 text-sm hover:bg-gray-100',
                    branch === currentBranch && 'bg-blue-50 text-blue-700'
                  )}
                >
                  {branch}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saveDashboard.isPending}
              className={clsx(
                'px-4 py-2 text-sm font-medium rounded-md',
                hasChanges
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
            >
              {saveDashboard.isPending ? 'Saving...' : 'Save & Push'}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleRefresh}
              disabled={isFetching > 0}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md disabled:opacity-50"
              title="Refresh all charts"
            >
              <svg
                className={clsx('w-5 h-5', isFetching > 0 && 'animate-spin')}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Edit Layout
            </button>
          </>
        )}
      </div>
    </div>
  );
}
