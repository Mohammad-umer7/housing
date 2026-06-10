'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createPortal } from 'react-dom'
import { Hand, Pause, Play, RotateCcw, X } from 'lucide-react'
import { useA11y } from '@/components/AccessibilityProvider'

export type SignLanguageVideo = {
  src: string
  label: string
  labelAr?: string
}

export const SIGN_LANGUAGE_VIDEOS = {
  home: {
    src: '/sign-language/home-page.mp4',
    label: 'Home Page',
    labelAr: 'الصفحة الرئيسية',
  },
  financial: {
    src: '/sign-language/financial.mp4',
    label: 'Financial details',
    labelAr: 'التفاصيل المالية',
  },
  document: {
    src: '/sign-language/document.mp4',
    label: 'Documents',
    labelAr: 'المستندات',
  },
  reason: {
    src: '/sign-language/reason.mp4',
    label: 'Reason',
    labelAr: 'سبب إعادة الجدولة',
  },
  caseSubmitted: {
    src: '/sign-language/case-submitted.mp4',
    label: 'Case Submitted',
    labelAr: 'تم تقديم الطلب',
  },
  verdict: {
    src: '/sign-language/verdict.mp4',
    label: 'Verdict',
    labelAr: 'القرار والنتيجة',
  },
} satisfies Record<string, SignLanguageVideo>

type SignLanguageContextValue = {
  video: SignLanguageVideo | null
  setVideo: (video: SignLanguageVideo) => void
  resetVideo: () => void
}

const SignLanguageContext = createContext<SignLanguageContextValue | undefined>(undefined)

export function SignLanguageProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [override, setOverride] = useState<{ pathname: string; video: SignLanguageVideo } | null>(null)
  const overrideVideo = override?.pathname === pathname ? override.video : null
  const video = overrideVideo

  const setVideo = useCallback((nextVideo: SignLanguageVideo) => {
    setOverride({ pathname, video: nextVideo })
  }, [pathname])

  const resetVideo = useCallback(() => {
    setOverride(null)
  }, [])
  const contextValue = useMemo(() => ({ video, setVideo, resetVideo }), [video, setVideo, resetVideo])

  return (
    <SignLanguageContext.Provider value={contextValue}>
      {children}
    </SignLanguageContext.Provider>
  )
}

export function useSignLanguageVideo(video: SignLanguageVideo | null) {
  const ctx = useContext(SignLanguageContext)
  if (!ctx) throw new Error('useSignLanguageVideo must be used within SignLanguageProvider')
  const { setVideo, resetVideo } = ctx

  useEffect(() => {
    if (!video) return
    setVideo(video)
    return resetVideo
  }, [setVideo, resetVideo, video])
}

export function SignLanguageWidget() {
  const ctx = useContext(SignLanguageContext)
  if (!ctx) throw new Error('SignLanguageWidget must be used within SignLanguageProvider')

  const { t, lang } = useA11y()
  const { video } = ctx
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open || !videoRef.current) return
    videoRef.current.currentTime = 0
    void videoRef.current.play().catch(() => {
      setPlaying(false)
    })
  }, [open, video?.src])

  if (!mounted || !video) return null

  const label = lang === 'ar' ? video.labelAr ?? video.label : video.label

  function togglePlayback() {
    const el = videoRef.current
    if (!el) return
    if (el.paused) {
      void el.play()
    } else {
      el.pause()
    }
  }

  function replay() {
    const el = videoRef.current
    if (!el) return
    el.currentTime = 0
    void el.play()
  }

  const fabStyle: React.CSSProperties = {
    position: 'fixed',
    left: 24,
    bottom: 24,
    zIndex: 10050,
  }
  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    left: 24,
    bottom: 24,
    zIndex: 10055,
    width: 360,
    maxWidth: 'calc(100vw - 32px)',
  }
  const videoStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    aspectRatio: '16 / 9',
    background: '#000000',
    objectFit: 'contain',
  }

  return createPortal(
    <>
      {!open && (
        <button
          type="button"
          className="sign-fab"
          style={fabStyle}
          onClick={() => setOpen(true)}
          aria-label={`${t('Open sign language help')} - ${label}`}
          title={t('Open sign language help')}
        >
          <Hand size={22} aria-hidden="true" />
          <span className="fab-label">{t('Sign Guide', 'دليل الإشارة')}</span>
        </button>
      )}

      {open && (
        <section className="sign-panel fade-in" style={panelStyle} role="dialog" aria-label={t('Sign language help')} aria-modal="false">
          <div className="sign-panel-hd">
            <div className="sign-panel-icon" aria-hidden="true">
              <Hand size={18} />
            </div>
            <div className="sign-panel-title-wrap">
              <div className="sign-panel-title">{t('Sign Language', 'لغة الإشارة')}</div>
              <div className="sign-panel-sub">{label}</div>
            </div>
            <button type="button" className="sign-icon-btn" onClick={() => setOpen(false)} aria-label={t('Close sign language help')}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <video
            ref={videoRef}
            key={video.src}
            className="sign-video"
            src={video.src}
            style={videoStyle}
            muted
            playsInline
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />

          <div className="sign-controls" aria-label={t('Sign language video controls')}>
            <button type="button" onClick={togglePlayback} aria-label={playing ? t('Pause sign language video') : t('Play sign language video')}>
              {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
              <span>{playing ? t('Pause') : t('Play')}</span>
            </button>
            <button type="button" onClick={replay} aria-label={t('Replay sign language video')}>
              <RotateCcw size={16} aria-hidden="true" />
              <span>{t('Replay')}</span>
            </button>
          </div>
        </section>
      )}
    </>,
    document.body
  )
}
