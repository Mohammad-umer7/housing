'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ArrowRight, TrendingUp, BarChart3, CalendarDays, Upload as UploadIcon } from 'lucide-react'
import { ScenarioPlanningForm } from './input-forms/scenario-planning-form'
import { EconomicDataForm } from './input-forms/economic-data-form'
import { MeetingConciergeForm } from './input-forms/meeting-concierge-form'
import { UploadFile } from './upload-file'
import type { InputData, ScenarioFormData, EconomicFormData, MeetingFormData } from '@/types/database'

interface DataInputPanelProps {
  onContinue: (data: InputData) => void
}

const emptyScenario: ScenarioFormData = {
  tradeVolumes: '',
  gdpGrowthRates: '',
  infrastructureInvestments: '',
  newsArticles: '',
  pressReleases: '',
  diplomaticTranscripts: '',
  policyAnnouncements: '',
}

const emptyEconomic: EconomicFormData = {
  country: '',
  yearFrom: '',
  yearTo: '',
  gdp: '',
  tradeBalance: '',
  inflationRate: '',
  fdiInflows: '',
}

const emptyMeeting: MeetingFormData = {
  meetingDate: '',
  meetingTime: '',
  attendees: [],
  countryOfInterest: '',
  bilateralSummaries: '',
}

type ActiveTab = 'scenario' | 'economic' | 'meeting' | 'upload'

export function DataInputPanel({ onContinue }: DataInputPanelProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('scenario')
  const [scenarioData, setScenarioData] = useState<ScenarioFormData>(emptyScenario)
  const [economicData, setEconomicData] = useState<EconomicFormData>(emptyEconomic)
  const [meetingData, setMeetingData] = useState<MeetingFormData>(emptyMeeting)

  const handleContinue = () => {
    if (activeTab === 'scenario') {
      onContinue({ type: 'scenario', data: scenarioData })
    } else if (activeTab === 'economic') {
      onContinue({ type: 'economic', data: economicData })
    } else if (activeTab === 'meeting') {
      onContinue({ type: 'meeting', data: meetingData })
    } else {
      onContinue({ type: 'upload', data: { fileName: '', extractedText: '' } })
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-amber-900 dark:text-amber-100 mb-1">
          Step 1: Input Data
        </h2>
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Choose a data source and fill in the required information to begin analysis.
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ActiveTab)}
        className="flex-1 flex flex-col"
      >
        <TabsList className="grid w-full grid-cols-4 bg-amber-100/60 dark:bg-amber-900/20 mb-6 rounded-xl p-1">
          <TabsTrigger
            value="scenario"
            className="flex items-center gap-1.5 text-xs sm:text-sm data-[state=active]:bg-amber-600 data-[state=active]:text-white rounded-lg"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Scenario Planning</span>
            <span className="sm:hidden">Scenario</span>
          </TabsTrigger>
          <TabsTrigger
            value="economic"
            className="flex items-center gap-1.5 text-xs sm:text-sm data-[state=active]:bg-amber-600 data-[state=active]:text-white rounded-lg"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Economic Data</span>
            <span className="sm:hidden">Economic</span>
          </TabsTrigger>
          <TabsTrigger
            value="meeting"
            className="flex items-center gap-1.5 text-xs sm:text-sm data-[state=active]:bg-amber-600 data-[state=active]:text-white rounded-lg"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Meeting Concierge</span>
            <span className="sm:hidden">Meetings</span>
          </TabsTrigger>
          <TabsTrigger
            value="upload"
            className="flex items-center gap-1.5 text-xs sm:text-sm data-[state=active]:bg-amber-600 data-[state=active]:text-white rounded-lg"
          >
            <UploadIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">File Upload</span>
            <span className="sm:hidden">Upload</span>
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="scenario" className="mt-0 focus-visible:outline-none">
            <ScenarioPlanningForm data={scenarioData} onChange={setScenarioData} />
          </TabsContent>

          <TabsContent value="economic" className="mt-0 focus-visible:outline-none">
            <EconomicDataForm data={economicData} onChange={setEconomicData} />
          </TabsContent>

          <TabsContent value="meeting" className="mt-0 focus-visible:outline-none">
            <MeetingConciergeForm data={meetingData} onChange={setMeetingData} />
          </TabsContent>

          <TabsContent value="upload" className="mt-0 focus-visible:outline-none">
            <UploadFile />
          </TabsContent>
        </div>
      </Tabs>

      {/* Continue button */}
      <div className="mt-6 pt-4 border-t border-amber-100 dark:border-amber-900/30 flex justify-end">
        <Button
          onClick={handleContinue}
          className="bg-amber-600 hover:bg-amber-700 text-white gap-2 px-6"
        >
          Continue to Processing
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
