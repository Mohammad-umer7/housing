'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, X, CheckCircle, AlertCircle, TrendingUp, DollarSign, Percent, Terminal, Hash, Key, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { extractData, type ExtractedData } from '@/lib/text-extraction'

interface UploadedFile {
  id: string
  name: string
  size: number
  uploadedAt: Date
  extractedData?: ExtractedData
  ocrLog: string[]
  status: 'processing' | 'complete' | 'error'
}

export function UploadFile() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'metrics' | 'kvpairs' | 'rawtext' | 'terminal'>('metrics')
  const termRef = useRef<HTMLDivElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const processFile = async (file: File) => {
    const id = Date.now().toString()
    const newFile: UploadedFile = {
      id,
      name: file.name,
      size: file.size,
      uploadedAt: new Date(),
      ocrLog: [
        `> Loading file: ${file.name}`,
        `  Size: ${(file.size / 1024).toFixed(1)} KB · Type: ${file.type || 'unknown'}`,
      ],
      status: 'processing',
    }

    setFiles((prev) => [...prev, newFile])
    if (!selectedFile) setSelectedFile(id)
    setActiveTab('terminal')

    // Timed progress messages while real extraction runs
    const progressMsgs = [
      '> Starting OCR engine...',
      '  Loading extraction model (Tesseract v4 / PDF.js)',
      '> Pre-processing document pages...',
      '  Detecting text layers and image regions...',
      '  Running OCR pass — confidence threshold 85%...',
      '  Parsing structured data patterns...',
      '  Extracting key-value pairs and tables...',
      '  Running NLP on extracted text...',
      '  Applying regex patterns: currency, percentage, numbers...',
    ]
    let mi = 0
    const progressId = setInterval(() => {
      if (mi < progressMsgs.length) {
        setFiles((prev) => prev.map((f) => f.id === id ? { ...f, ocrLog: [...f.ocrLog, progressMsgs[mi]] } : f))
        mi++
      }
    }, 600)

    try {
      const data = await extractData(file)
      clearInterval(progressId)

      setFiles((prev) => prev.map((f) => f.id === id ? {
        ...f,
        status: 'complete',
        extractedData: data,
        ocrLog: [
          ...f.ocrLog,
          '> Extraction complete ✓',
          `  Characters: ${data.rawText.length.toLocaleString()}`,
          `  Metrics found: ${data.metrics.length}`,
          `  Key-value pairs: ${data.keyValues.length}`,
          ...(data.metrics.slice(0, 3).map((m) => `  • ${m.label}: ${m.value}${m.unit || ''}`)),
          '✓ Ready to view results.',
        ],
      } : f))
      setActiveTab('metrics')
    } catch (error) {
      clearInterval(progressId)
      const msg = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error processing file:', error)
      setFiles((prev) => prev.map((f) => f.id === id ? {
        ...f,
        status: 'error',
        ocrLog: [...f.ocrLog, `! OCR error: ${msg}`, '  Check file format and try again.'],
      } : f))
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    droppedFiles.forEach((file) => {
      if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        processFile(file)
      }
    })
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    selectedFiles.forEach((file) => {
      if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        processFile(file)
      }
    })
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
    if (selectedFile === id) {
      setSelectedFile(null)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const getMetricIcon = (type: string) => {
    switch (type) {
      case 'currency':
        return <DollarSign className="w-4 h-4 text-amber-600" />
      case 'percentage':
        return <Percent className="w-4 h-4 text-amber-600" />
      default:
        return <TrendingUp className="w-4 h-4 text-amber-600" />
    }
  }

  const currentFile = files.find((f) => f.id === selectedFile)

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-amber-50 via-amber-50 to-amber-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-amber-900 mb-2">
            Document & Image Upload
          </h1>
          <p className="text-amber-700">
            Extract valuable data from PDFs and images using computer vision
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Section */}
          <div className="lg:col-span-2">
            <Card className="border-2 border-dashed border-amber-300 bg-white/50 p-8 mb-6">
              <label
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center cursor-pointer rounded-lg transition-all ${
                  isDragging
                    ? 'bg-amber-100 border-amber-500'
                    : 'hover:bg-amber-50/50'
                }`}
              >
                <div className="text-center">
                  <Upload className="w-12 h-12 text-amber-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-amber-900 mb-2">
                    Drop your files here
                  </h3>
                  <p className="text-amber-700 mb-4">
                    or click to browse (PDF, PNG, JPG, JPEG)
                  </p>
                  <Button className="bg-amber-600 hover:bg-amber-700 text-white">
                    Select Files
                  </Button>
                </div>
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </label>
            </Card>

            {/* File List */}
            {files.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-amber-900 mb-4">
                  Uploaded Files ({files.length})
                </h2>
                <div className="space-y-3">
                  {files.map((file) => (
                    <Card
                      key={file.id}
                      className={`border-amber-200 bg-white/80 p-4 cursor-pointer transition-all ${
                        selectedFile === file.id
                          ? 'border-amber-500 bg-amber-50/50'
                          : 'hover:border-amber-300'
                      }`}
                      onClick={() => setSelectedFile(file.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <FileText className="w-5 h-5 text-amber-600 mt-1" />
                          <div className="flex-1">
                            <h3 className="font-medium text-amber-900">
                              {file.name}
                            </h3>
                            <p className="text-sm text-amber-700">
                              {formatFileSize(file.size)} •{' '}
                              {file.uploadedAt.toLocaleTimeString()}
                            </p>
                            {file.extractedData && (
                              <p className="text-xs text-amber-600 mt-1">
                                📊 {file.extractedData.metrics.length} metrics • 📝 {file.extractedData.keyValues.length} data points
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {file.status === 'processing' && (
                            <div className="flex items-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-600 border-t-transparent" />
                              <span className="text-sm text-amber-700">
                                Extracting...
                              </span>
                            </div>
                          )}
                          {file.status === 'complete' && (
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-5 h-5 text-green-500" />
                              <span className="text-sm text-green-700">
                                Complete
                              </span>
                            </div>
                          )}
                          {file.status === 'error' && (
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-5 h-5 text-red-500" />
                              <span className="text-sm text-red-700">
                                Error
                              </span>
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeFile(file.id)
                            }}
                            className="text-amber-600 hover:text-amber-700"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Data Display Panel */}
          <div className="space-y-4">
            {currentFile ? (
              <Card className="border-amber-200 bg-white/80 overflow-hidden">
                {/* File header */}
                <div className="flex items-center gap-3 px-5 py-4 bg-amber-50 border-b border-amber-200">
                  <div className="w-9 h-9 bg-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Layers className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-amber-900 truncate">{currentFile.name}</p>
                    <p className="text-xs text-amber-700">
                      {currentFile.status === 'processing' ? (
                        <span className="text-amber-600 animate-pulse">● OCR running...</span>
                      ) : currentFile.status === 'complete' ? (
                        <span className="text-green-600">✓ {currentFile.extractedData?.metrics.length} metrics · {currentFile.extractedData?.keyValues.length} data points</span>
                      ) : (
                        <span className="text-red-600">! Extraction error</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Tab bar */}
                <div className="flex gap-1 p-2 bg-amber-50/50 border-b border-amber-100">
                  {[
                    { id: 'terminal' as const, label: 'OCR Terminal', icon: <Terminal className="w-3 h-3" /> },
                    { id: 'metrics'  as const, label: `Metrics (${currentFile.extractedData?.metrics.length ?? 0})`, icon: <Hash className="w-3 h-3" /> },
                    { id: 'kvpairs'  as const, label: `Data Points (${currentFile.extractedData?.keyValues.length ?? 0})`, icon: <Key className="w-3 h-3" /> },
                    { id: 'rawtext'  as const, label: 'Raw Text', icon: <FileText className="w-3 h-3" /> },
                  ].map((t) => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === t.id ? 'bg-amber-600 text-white' : 'text-amber-700 hover:bg-amber-100'}`}>
                      {t.icon}{t.label}
                    </button>
                  ))}
                </div>

                <div className="p-4 max-h-80 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                  {/* OCR Terminal */}
                  {activeTab === 'terminal' && (
                    <div className="bg-[#1a1208] rounded-xl border border-[#3a2c14] overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-[#251a0e] border-b border-[#3a2c14]">
                        <div className="flex gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" /><div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" /><div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                        </div>
                        <span className="text-xs text-[#9b7a36] font-mono ml-2">ocr-engine</span>
                        <span className={`ml-auto text-[10px] font-mono ${currentFile.status === 'complete' ? 'text-green-400' : currentFile.status === 'error' ? 'text-red-400' : 'text-[#c2a14e] animate-pulse'}`}>
                          {currentFile.status === 'complete' ? '✓ done' : currentFile.status === 'error' ? '✗ error' : '● running'}
                        </span>
                      </div>
                      <div ref={termRef} className="h-52 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3a2c14 transparent' }}>
                        {currentFile.ocrLog.map((line, i) => (
                          <div key={i} className="mb-0.5">
                            <span className={line.startsWith('>') ? 'text-[#c2a14e]' : line.startsWith('✓') ? 'text-green-400' : line.startsWith('!') ? 'text-red-400' : 'text-[#a89060]'}>{line}</span>
                          </div>
                        ))}
                        {currentFile.status === 'processing' && <span className="text-[#9b7a36] animate-pulse">█</span>}
                      </div>
                    </div>
                  )}

                  {/* Metrics */}
                  {activeTab === 'metrics' && (
                    currentFile.extractedData?.metrics.length ? (
                      <div className="grid grid-cols-1 gap-2">
                        {currentFile.extractedData.metrics.map((m, i) => (
                          <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                            <div className="flex items-center gap-2">
                              {getMetricIcon(m.type)}
                              <span className="text-xs text-amber-700">{m.label}</span>
                            </div>
                            <span className="text-sm font-bold text-amber-900">{m.value}{m.unit || ''}</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-amber-600 text-center py-6">
                      {currentFile.status === 'processing' ? 'Extracting...' : 'No numeric metrics found in this document.'}
                    </p>
                  )}

                  {/* Key-value pairs */}
                  {activeTab === 'kvpairs' && (
                    currentFile.extractedData?.keyValues.length ? (
                      <div className="space-y-2">
                        {currentFile.extractedData.keyValues.map((kv, i) => (
                          <div key={i} className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                            <span className="text-[11px] font-bold text-amber-900 min-w-[100px] flex-shrink-0">{kv.key}</span>
                            <span className="text-[11px] text-amber-700">{kv.value}</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-amber-600 text-center py-6">
                      {currentFile.status === 'processing' ? 'Extracting...' : 'No key-value pairs found.'}
                    </p>
                  )}

                  {/* Raw text */}
                  {activeTab === 'rawtext' && (
                    <div className="bg-[#1a1208] rounded-xl p-3 font-mono text-[10px] text-[#a89060] leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3a2c14 transparent' }}>
                      {currentFile.extractedData?.rawText || (currentFile.status === 'processing' ? 'Extracting text...' : 'No text extracted.')}
                    </div>
                  )}
                </div>

                {/* Summary footer */}
                {currentFile.extractedData?.summary && (
                  <div className="px-5 py-3 border-t border-amber-100 bg-amber-50">
                    <p className="text-xs text-amber-700"><span className="font-bold text-amber-900">Summary: </span>{currentFile.extractedData.summary}</p>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="border-amber-200 bg-white/80 p-6 sticky top-24">
                <h3 className="text-lg font-semibold text-amber-900 mb-4">Supported Formats</h3>
                <div className="space-y-3">
                  <div><p className="font-medium text-amber-900">PDF Documents</p><p className="text-sm text-amber-700">Text layer + scanned (OCR)</p></div>
                  <div><p className="font-medium text-amber-900">Images</p><p className="text-sm text-amber-700">PNG, JPG, JPEG — full Tesseract OCR</p></div>
                </div>
                <div className="mt-6 pt-6 border-t border-amber-200">
                  <h3 className="text-lg font-semibold text-amber-900 mb-4">What gets extracted</h3>
                  <ul className="space-y-2 text-sm text-amber-700">
                    <li>✓ Currency values (USD, EUR, GBP…)</li>
                    <li>✓ Percentages and growth rates</li>
                    <li>✓ Key-value data pairs</li>
                    <li>✓ Large numbers and statistics</li>
                    <li>✓ Full raw text (searchable)</li>
                  </ul>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
