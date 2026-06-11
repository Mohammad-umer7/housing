'use client'

import { Button } from '@/components/ui/button'
import { Download, Share2, Play } from 'lucide-react'
import { useState } from 'react'

interface MediaItem {
  id: string
  title: string
  type: 'video' | 'summary'
  thumbnail?: string
  duration?: string
  description: string
}

const mockMediaItems: MediaItem[] = [
  {
    id: '1',
    title: 'UAE Energy Transformation',
    type: 'video',
    thumbnail: 'from-yellow-500 to-orange-500',
    duration: '3:45',
    description: 'AI-generated analysis of UAE\'s renewable energy initiatives and strategic partnerships.',
  },
  {
    id: '2',
    title: 'Norway Infrastructure 2026',
    type: 'video',
    thumbnail: 'from-blue-500 to-cyan-500',
    duration: '5:12',
    description: 'Comprehensive visual summary of Norway\'s infrastructure development strategies.',
  },
  {
    id: '3',
    title: 'Bilateral Trade Summary',
    type: 'summary',
    description: 'Visual infographic showing key trade relationships and growth metrics.',
  },
]

export function MultimediaViewer() {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-amber-900 mb-4">
          AI-Generated Insights
        </h2>
        <p className="text-amber-700 mb-6">
          Strategic achievements and insights visualized by our AI system
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockMediaItems.map((item) => (
          <div
            key={item.id}
            className="group rounded-lg border border-amber-200 bg-white/80 overflow-hidden hover:border-amber-300 transition-all cursor-pointer"
            onClick={() => setSelectedMedia(item)}
          >
            {/* Thumbnail */}
            <div
              className={`relative w-full h-40 bg-gradient-to-br ${
                item.thumbnail || 'from-amber-500 to-yellow-500'
              } flex items-center justify-center overflow-hidden`}
            >
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-all" />
              {item.type === 'video' ? (
                <>
                  <Play className="w-12 h-12 text-white opacity-80 group-hover:opacity-100 transition-opacity" />
                  {item.duration && (
                    <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      {item.duration}
                    </span>
                  )}
                </>
              ) : (
                <div className="text-white font-bold text-2xl opacity-80 group-hover:opacity-100 transition-opacity">
                  📊
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-4">
              <h3 className="font-semibold text-amber-900 mb-1 line-clamp-2">
                {item.title}
              </h3>
              <p className="text-sm text-amber-700 line-clamp-2 mb-3">
                {item.description}
              </p>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1 text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                >
                  <Download className="w-3 h-3 mr-1" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1 text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                >
                  <Share2 className="w-3 h-3 mr-1" />
                  Share
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Selected Media View */}
      {selectedMedia && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4"
          onClick={() => setSelectedMedia(null)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-lg border border-amber-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full aspect-video bg-black flex items-center justify-center">
              {selectedMedia.type === 'video' ? (
                <>
                  <div className={`absolute inset-0 bg-gradient-to-br ${selectedMedia.thumbnail} opacity-50`} />
                  <Play className="w-20 h-20 text-white relative" />
                </>
              ) : (
                <div className="text-6xl">📊</div>
              )}
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold text-amber-900 mb-2">
                {selectedMedia.title}
              </h3>
              <p className="text-amber-700 mb-6">{selectedMedia.description}</p>
              <div className="flex gap-3">
                <Button className="gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white">
                  <Download className="w-4 h-4" />
                  Download
                </Button>
                <Button variant="ghost" className="gap-2">
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
