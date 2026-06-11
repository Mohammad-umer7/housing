'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, Brain, Leaf, Lock, Zap, BarChart3 } from 'lucide-react'

export function AdvancedAnalysis() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-amber-50 via-amber-50 to-amber-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-amber-900 mb-2">
            Advanced Analytical Modules
          </h1>
          <p className="text-amber-700">
            Sophisticated analysis tools for strategic intelligence
          </p>
        </div>

        {/* Analytical Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* Scenario Planning */}
          <Card className="border-amber-200 bg-white/80 p-6 hover:shadow-lg transition-shadow cursor-pointer group">
            <div className="mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-600 to-amber-700 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-amber-900 mb-2">
              Scenario Planning
            </h3>
            <p className="text-amber-700 text-sm mb-4">
              Develop and analyze multiple strategic scenarios with probabilistic modeling, sensitivity analysis, and outcome forecasting capabilities.
            </p>
            <div className="space-y-2 mb-4">
              <p className="text-xs font-medium text-amber-800">Features:</p>
              <ul className="text-xs text-amber-700 space-y-1">
                <li>• Probabilistic modeling</li>
                <li>• Sensitivity analysis</li>
                <li>• Risk assessment</li>
                <li>• Trend forecasting</li>
              </ul>
            </div>
            <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white text-sm">
              Explore Scenarios
            </Button>
          </Card>

          {/* Sentiment Analysis */}
          <Card className="border-amber-200 bg-white/80 p-6 hover:shadow-lg transition-shadow cursor-pointer group">
            <div className="mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-600 to-yellow-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Brain className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-amber-900 mb-2">
              Sentiment Analysis
            </h3>
            <p className="text-amber-700 text-sm mb-4">
              Analyze market sentiment, stakeholder perspectives, and public opinion using advanced NLP and real-time data aggregation.
            </p>
            <div className="space-y-2 mb-4">
              <p className="text-xs font-medium text-amber-800">Features:</p>
              <ul className="text-xs text-amber-700 space-y-1">
                <li>• NLP analysis</li>
                <li>• Social media tracking</li>
                <li>• Market sentiment</li>
                <li>• Real-time monitoring</li>
              </ul>
            </div>
            <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white text-sm">
              View Sentiment Dashboard
            </Button>
          </Card>

          {/* ESG Scoring Engine */}
          <Card className="border-amber-200 bg-white/80 p-6 hover:shadow-lg transition-shadow cursor-pointer group">
            <div className="mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-700 to-yellow-700 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Leaf className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-amber-900 mb-2">
              ESG Scoring Engine
            </h3>
            <p className="text-amber-700 text-sm mb-4">
              Comprehensive Environmental, Social, and Governance assessment framework with customizable metrics and benchmarking.
            </p>
            <div className="space-y-2 mb-4">
              <p className="text-xs font-medium text-amber-800">Features:</p>
              <ul className="text-xs text-amber-700 space-y-1">
                <li>• ESG metrics</li>
                <li>• Sustainability scoring</li>
                <li>• Benchmarking</li>
                <li>• Compliance tracking</li>
              </ul>
            </div>
            <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white text-sm">
              Run ESG Assessment
            </Button>
          </Card>
        </div>

        {/* Visualization Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-amber-900 mb-6">
            Sophisticated Visualization
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Interactive Briefing Portal */}
            <Card className="border-amber-200 bg-white/80 p-6 hover:shadow-lg transition-shadow">
              <div className="mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-600 to-amber-700 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-amber-900 mb-3">
                Interactive Briefing Portals
              </h3>
              <p className="text-amber-700 text-sm mb-4">
                Dynamic, customizable dashboards that present complex data in intuitive, actionable formats for executive decision-making.
              </p>
              <div className="space-y-2 mb-4">
                <p className="text-xs font-medium text-amber-800">Capabilities:</p>
                <ul className="text-xs text-amber-700 space-y-1">
                  <li>• Real-time data streaming</li>
                  <li>• Drag-and-drop customization</li>
                  <li>• Multi-view perspectives</li>
                  <li>• Drill-down analytics</li>
                  <li>• Export to multiple formats</li>
                </ul>
              </div>
              <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white text-sm">
                Create Portal
              </Button>
            </Card>

            {/* Visualization Features */}
            <Card className="border-amber-200 bg-white/80 p-6 hover:shadow-lg transition-shadow">
              <div className="mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-600 to-yellow-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-amber-900 mb-3">
                Advanced Visualization Types
              </h3>
              <p className="text-amber-700 text-sm mb-4">
                Cutting-edge visualization techniques including network graphs, heat maps, sunbursts, and temporal analysis.
              </p>
              <div className="space-y-2 mb-4">
                <p className="text-xs font-medium text-amber-800">Supported Visualizations:</p>
                <ul className="text-xs text-amber-700 space-y-1">
                  <li>• Network dependency maps</li>
                  <li>• Hierarchical heat maps</li>
                  <li>• Temporal trend analysis</li>
                  <li>• Geographic data overlays</li>
                  <li>• Correlation matrices</li>
                </ul>
              </div>
              <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white text-sm">
                View Gallery
              </Button>
            </Card>
          </div>
        </div>

        {/* Technical Sophistication */}
        <div>
          <h2 className="text-2xl font-bold text-amber-900 mb-6">
            Technical Sophistication
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Secure Offline Mode */}
            <Card className="border-amber-200 bg-white/80 p-6 hover:shadow-lg transition-shadow">
              <div className="mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-700 to-yellow-700 rounded-lg flex items-center justify-center">
                  <Lock className="w-6 h-6 text-white" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-amber-900 mb-3">
                Secure Offline Mode
              </h3>
              <p className="text-amber-700 text-sm mb-4">
                Enterprise-grade offline capabilities with end-to-end encryption, secure data synchronization, and audit trails.
              </p>
              <div className="space-y-2 mb-4">
                <p className="text-xs font-medium text-amber-800">Security Features:</p>
                <ul className="text-xs text-amber-700 space-y-1">
                  <li>• AES-256 encryption</li>
                  <li>• Local data caching</li>
                  <li>• Secure sync protocol</li>
                  <li>• Zero-knowledge architecture</li>
                  <li>• Audit logging</li>
                </ul>
              </div>
              <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white text-sm">
                Enable Offline Mode
              </Button>
            </Card>

            {/* Enhancing Results */}
            <Card className="border-amber-200 bg-white/80 p-6 hover:shadow-lg transition-shadow">
              <div className="mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-600 to-amber-700 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-amber-900 mb-3">
                Enhancing Results
              </h3>
              <p className="text-amber-700 text-sm mb-4">
                AI-powered optimization and result enhancement through machine learning, pattern recognition, and continuous improvement.
              </p>
              <div className="space-y-2 mb-4">
                <p className="text-xs font-medium text-amber-800">Enhancement Methods:</p>
                <ul className="text-xs text-amber-700 space-y-1">
                  <li>• ML-powered predictions</li>
                  <li>• Pattern recognition</li>
                  <li>• Automated insights</li>
                  <li>• Continuous learning</li>
                  <li>• Quality assurance</li>
                </ul>
              </div>
              <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white text-sm">
                View Improvements
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
