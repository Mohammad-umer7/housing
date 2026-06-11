'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { LogOut, Moon, Sun, FileText, GitCompare, Film, Zap, Upload, Database, CalendarDays, Brain, Lightbulb, ClipboardList } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type ViewMode = 'command-center' | 'comparison' | 'report' | 'multimedia' | 'upload' | 'data-processing' | 'mira' | 'insights' | 'full-report'

interface HeaderProps {
  onViewChange: (view: ViewMode) => void
  currentView: ViewMode
  onToggleTheme: () => void
  currentTheme: string
  onShowReport: () => void
}

export function Header({
  onViewChange,
  currentView,
  onToggleTheme,
  currentTheme,
  onShowReport,
}: HeaderProps) {
  const router = useRouter()

  const handleLogout = () => {
    localStorage.removeItem('userRole')
    localStorage.removeItem('userEmail')
    router.push('/')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#9b7a36]/20 bg-[#0e0b06] shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-24">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="MOE Strategist"
              width={96}
              height={96}
              unoptimized
              priority
              className="object-contain w-[96px] h-[96px]"
            />
            <span className="font-bold text-lg hidden sm:inline bg-gradient-to-r from-[#c2a14e] to-[#9b7a36] bg-clip-text text-transparent">
              MOE Strategist
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <Button
              variant={currentView === 'command-center' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewChange('command-center')}
              className={`text-xs sm:text-sm ${
                currentView === 'command-center'
                  ? 'bg-[#9b7a36] text-[#0e0b06] hover:bg-[#c2a14e]'
                  : 'text-[#c2a14e] hover:text-white hover:bg-white/10'
              }`}
              title="Command Center"
            >
              <span className="hidden sm:inline">Center</span>
              <span className="sm:hidden">CMD</span>
            </Button>

            <Button
              variant={currentView === 'insights' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewChange('insights')}
              className={`text-xs sm:text-sm gap-1 ${
                currentView === 'insights'
                  ? 'bg-[#9b7a36] text-[#0e0b06] hover:bg-[#c2a14e]'
                  : 'text-[#c2a14e] hover:text-white hover:bg-white/10'
              }`}
              title="Real-Time Insights"
            >
              <Lightbulb className="w-4 h-4" />
              <span className="hidden sm:inline">Insights</span>
            </Button>

            <Button
              variant={currentView === 'comparison' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewChange('comparison')}
              className={`text-xs sm:text-sm gap-1 ${
                currentView === 'comparison'
                  ? 'bg-[#9b7a36] text-[#0e0b06] hover:bg-[#c2a14e]'
                  : 'text-[#c2a14e] hover:text-white hover:bg-white/10'
              }`}
              title="Comparison"
            >
              <GitCompare className="w-4 h-4" />
              <span className="hidden sm:inline">Compare</span>
            </Button>

            <Button
              variant={currentView === 'multimedia' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewChange('multimedia')}
              className={`text-xs sm:text-sm gap-1 ${
                currentView === 'multimedia'
                  ? 'bg-[#9b7a36] text-[#0e0b06] hover:bg-[#c2a14e]'
                  : 'text-[#c2a14e] hover:text-white hover:bg-white/10'
              }`}
              title="Multimedia"
            >
              <Film className="w-4 h-4" />
              <span className="hidden sm:inline">Media</span>
            </Button>

            <Button
              variant={currentView === 'full-report' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewChange('full-report')}
              className={`text-xs sm:text-sm gap-1 ${
                currentView === 'full-report'
                  ? 'bg-[#9b7a36] text-[#0e0b06] hover:bg-[#c2a14e]'
                  : 'text-[#c2a14e] hover:text-white hover:bg-white/10'
              }`}
              title="Full Report Wizard"
            >
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">Full Report</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onShowReport}
              className="text-xs sm:text-sm gap-1 text-[#c2a14e] hover:text-white hover:bg-white/10"
              title="Generate Report"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Report</span>
            </Button>

            <Button
              variant={currentView === 'upload' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewChange('upload')}
              className={`text-xs sm:text-sm gap-1 ${
                currentView === 'upload'
                  ? 'bg-[#9b7a36] text-[#0e0b06] hover:bg-[#c2a14e]'
                  : 'text-[#c2a14e] hover:text-white hover:bg-white/10'
              }`}
              title="Upload File"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Upload</span>
            </Button>

            <Button
              variant={currentView === 'data-processing' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewChange('data-processing')}
              className={`text-xs sm:text-sm gap-1 ${
                currentView === 'data-processing'
                  ? 'bg-[#9b7a36] text-[#0e0b06] hover:bg-[#c2a14e]'
                  : 'text-[#c2a14e] hover:text-white hover:bg-white/10'
              }`}
              title="Data Processing"
            >
              <Database className="w-4 h-4" />
              <span className="hidden sm:inline">Process</span>
            </Button>

            <Button
              variant={currentView === 'mira' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewChange('mira')}
              className={`text-xs sm:text-sm gap-1 ${
                currentView === 'mira'
                  ? 'bg-[#9b7a36] text-[#0e0b06] hover:bg-[#c2a14e]'
                  : 'text-[#c2a14e] hover:text-white hover:bg-white/10'
              }`}
              title="MIRA — Strategic Intelligence"
            >
              <Brain className="w-4 h-4" />
              <span className="hidden sm:inline">MIRA</span>
            </Button>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTheme}
              title={`Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`}
              className="text-[#c2a14e] hover:text-white hover:bg-white/10"
            >
              {currentTheme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title="Logout"
              className="text-[#c2a14e] hover:text-white hover:bg-white/10"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
