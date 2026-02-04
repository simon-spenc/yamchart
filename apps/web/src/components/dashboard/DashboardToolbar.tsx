import { useState, type RefObject } from 'react';
import { clsx } from 'clsx';
import { useBranches, useCheckoutBranch, useSaveDashboard, useRefreshDashboard } from '../../hooks';
import { useEditMode } from './EditModeContext';
import { useIsFetching } from '@tanstack/react-query';
import { exportDashboardAsImage, exportDashboardAsPDF } from '../../utils/export';
import { AddWidgetModal } from './AddWidgetModal';

interface DashboardToolbarProps {
  dashboardId: string;
  title: string;
  currentBranch: string;
  contentRef: RefObject<HTMLDivElement | null>;
}

export function DashboardToolbar({
  dashboardId,
  title,
  currentBranch,
  contentRef,
}: DashboardToolbarProps) {
  const { isEditing, setIsEditing, pendingLayout, setPendingLayout, hasChanges, addWidget, currentLayout } =
    useEditMode();
  const { data: branchesData } = useBranches();
  const checkoutBranch = useCheckoutBranch();
  const saveDashboard = useSaveDashboard(dashboardId);
  const refreshDashboard = useRefreshDashboard();
  const isFetching = useIsFetching({ queryKey: ['chartData'] });

  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Get list of charts already in the dashboard
  const existingCharts = currentLayout?.rows.flatMap(row =>
    row.widgets.filter(w => w.type === 'chart' && w.ref).map(w => w.ref!)
  ) || [];

  const handleRefresh = () => {
    refreshDashboard();
  };

  const handleExport = async (format: 'png' | 'jpeg' | 'pdf') => {
    if (!contentRef.current) return;
    setIsExporting(true);
    setShowExportDropdown(false);
    try {
      if (format === 'pdf') {
        await exportDashboardAsPDF(contentRef.current, `${dashboardId}-dashboard`, title);
      } else {
        await exportDashboardAsImage(contentRef.current, `${dashboardId}-dashboard`, format);
      }
    } finally {
      setIsExporting(false);
    }
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
    <>
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
              {/* Add Widget button */}
              <button
                onClick={() => setShowAddWidget(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Chart
              </button>

              <div className="w-px h-6 bg-gray-200 mx-2" />

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
              {/* Refresh button */}
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

              {/* Export dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowExportDropdown(!showExportDropdown)}
                  disabled={isExporting}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md disabled:opacity-50"
                  title="Export dashboard"
                >
                  {isExporting ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                  )}
                </button>

                {showExportDropdown && (
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-md shadow-lg border border-gray-200 z-50 py-1">
                    <button
                      onClick={() => handleExport('png')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      Export PNG
                    </button>
                    <button
                      onClick={() => handleExport('jpeg')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      Export JPEG
                    </button>
                    <button
                      onClick={() => handleExport('pdf')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                      </svg>
                      Export PDF
                    </button>
                  </div>
                )}
              </div>

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

      <AddWidgetModal
        isOpen={showAddWidget}
        onClose={() => setShowAddWidget(false)}
        onAdd={addWidget}
        existingCharts={existingCharts}
      />
    </>
  );
}
