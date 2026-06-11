'use client'

import { useState, useCallback } from 'react'
import { Header } from './header'
import { CommandCenter } from './command-center'
import { ComparisonView } from './comparison-view'
import { UploadFile } from './upload-file'
import { ReportsPage } from './reports-page'
import { MultimediaViewer } from '../ai/multimedia-viewer'
import { DataProcessingView } from './data-processing-view'
import DataProcessingModal from './DataProcessingModal'
import { MiraAdvisor } from './mira-advisor'
import { InsightsView } from './insights-view'
import { FullReportWizard } from './full-report-wizard'
import { useTheme } from 'next-themes'
import type { ModuleType } from '@/types/modules'

type ViewMode = 'command-center' | 'comparison' | 'report' | 'multimedia' | 'upload' | 'data-processing' | 'mira' | 'insights' | 'full-report'

export function DashboardLayout() {
  const { theme, setTheme } = useTheme()
  const [viewMode, setViewMode] = useState<ViewMode>('command-center')
  const [activeModule, setActiveModule] = useState<ModuleType | null>(null)

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const openModule = useCallback((mod: ModuleType) => {
    setActiveModule(mod)
    setViewMode('data-processing')
  }, [])

  const handleViewChange = useCallback((view: ViewMode) => {
    setViewMode(view)
    if (view !== 'data-processing') setActiveModule(null)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        onViewChange={handleViewChange}
        currentView={viewMode}
        onToggleTheme={toggleTheme}
        currentTheme={theme || 'dark'}
        onShowReport={() => handleViewChange('report')}
      />

      <main className="flex-1">
        {viewMode === 'command-center' && (
          <CommandCenter onViewChange={handleViewChange} onOpenModule={openModule} />
        )}
        {viewMode === 'comparison' && <ComparisonView />}
        {viewMode === 'upload' && <UploadFile />}
        {viewMode === 'report' && <ReportsPage />}
        {viewMode === 'data-processing' && activeModule && (
          <DataProcessingView
            moduleType={activeModule}
            onClose={() => { setActiveModule(null); handleViewChange('command-center') }}
          />
        )}
        {viewMode === 'data-processing' && !activeModule && (
          <DataProcessingModal />
        )}
        {viewMode === 'mira' && <MiraAdvisor />}
        {viewMode === 'insights' && <InsightsView />}
        {viewMode === 'full-report' && (
          <FullReportWizard onClose={() => handleViewChange('command-center')} />
        )}
        {viewMode === 'multimedia' && (
          <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-amber-50 via-amber-50 to-amber-100 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              <MultimediaViewer />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

