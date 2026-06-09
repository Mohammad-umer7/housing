'use client'

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'

type TTSContextType = {
  speak: (text: string, lang: 'en' | 'ar', force?: boolean) => void
  stop: () => void
  activeText: string | null
  enabled: boolean
  setEnabled: (v: boolean) => void
}

const TTSContext = createContext<TTSContextType | undefined>(undefined)

export function TTSProvider({ children }: { children: React.ReactNode }) {
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [activeText, setActiveText] = useState<string | null>(null)
  const activeTextRef = useRef<string | null>(null)

  // Global "read screen content aloud" switch (Settings → Text-to-Speech). When off,
  // every speak() call is a no-op. Persisted; defaults ON to preserve existing behaviour.
  const [enabled, setEnabledState] = useState(true)
  const enabledRef = useRef(true)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('saddad-tts-enabled')
    const on = stored === null ? true : stored === 'true'
    enabledRef.current = on
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabledState(on)
  }, [])
  function setEnabled(v: boolean) {
    enabledRef.current = v
    setEnabledState(v)
    if (typeof window !== 'undefined') localStorage.setItem('saddad-tts-enabled', String(v))
    if (!v) stop()
  }

  function updateActiveText(val: string | null) {
    activeTextRef.current = val
    setActiveText(val)
  }

  // Load voices dynamically on client mount
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return

    function loadVoices() {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        voicesRef.current = window.speechSynthesis.getVoices()
      }
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
  }, [])

  function splitTextIntoChunks(text: string, maxLen: number): string[] {
    const words = text.split(/\s+/)
    const chunks: string[] = []
    let currentChunk = ""

    for (const word of words) {
      if ((currentChunk + " " + word).trim().length <= maxLen) {
        currentChunk = (currentChunk + " " + word).trim()
      } else {
        if (currentChunk) chunks.push(currentChunk)
        currentChunk = word
      }
    }
    if (currentChunk) chunks.push(currentChunk)
    return chunks
  }

  function playGoogleTTS(text: string, lang: string) {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    const chunks = splitTextIntoChunks(text, 180)
    let currentChunkIndex = 0

    function playNext() {
      if (currentChunkIndex >= chunks.length) {
        updateActiveText(null)
        return
      }

      const chunkText = chunks[currentChunkIndex]
      const url = `/api/tts?lang=${lang}&q=${encodeURIComponent(chunkText)}`
      
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        currentChunkIndex++
        playNext()
      }
      audio.onerror = () => {
        updateActiveText(null)
      }
      audio.play().catch(err => {
        console.error("SADDAD TTS Fallback - Audio playback failed:", err)
        updateActiveText(null)
      })
    }

    playNext()
  }

  function speak(text: string, lang: 'en' | 'ar', force: boolean = false) {
    if (typeof window === 'undefined') return
    void force // reserved (explicit-request flag); toggle behaviour is handled below

    // Global Text-to-Speech switch is off → never read aloud.
    if (!enabledRef.current) { stop(); return }

    // If we are already playing this exact text, toggle it off (stop)
    if (activeTextRef.current === text) {
      stop()
      return
    }

    // Cancel any ongoing audio fallback playback or speech synthesis
    stop()

    if (!text.trim()) return

    updateActiveText(text)

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.0 // Normal speed rate
    utterance.pitch = 1.0
    utterance.onend = () => {
      updateActiveText(null)
    }
    utterance.onerror = () => {
      updateActiveText(null)
    }

    // Fetch fresh voices dynamically to handle asynchronous loading in Edge/Chrome
    let availableVoices = window.speechSynthesis.getVoices()
    if (availableVoices.length === 0 && voicesRef.current.length > 0) {
      availableVoices = voicesRef.current
    }

    // Pick bilingual voice
    if (lang === 'ar') {
      utterance.lang = 'ar-AE'
      // Try to find a native Arabic voice (case-insensitively, matching language and name)
      const arVoice = availableVoices.find(v => {
        const l = v.lang.toLowerCase()
        const n = v.name.toLowerCase()
        return l.startsWith('ar') || l.includes('ar-') || l.includes('ar_') || n.includes('arabic')
      })
      if (arVoice) {
        utterance.voice = arVoice
        window.speechSynthesis.speak(utterance)
      } else {
        playGoogleTTS(text, 'ar')
      }
    } else {
      utterance.lang = 'en-US'
      // Try to find a native English voice (case-insensitively, matching language and name)
      const enVoice = availableVoices.find(v => {
        const l = v.lang.toLowerCase()
        const n = v.name.toLowerCase()
        return l.startsWith('en') || l.includes('en-') || l.includes('en_') || n.includes('english')
      })
      if (enVoice) {
        utterance.voice = enVoice
        window.speechSynthesis.speak(utterance)
      } else {
        // Fallback to Google English voice if no native English speech engine is installed
        playGoogleTTS(text, 'en')
      }
    }
  }

  function stop() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    updateActiveText(null)
  }

  // Cancel speech synthesis if component gets unmounted
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  return (
    <TTSContext.Provider value={{ speak, stop, activeText, enabled, setEnabled }}>
      {children}
    </TTSContext.Provider>
  )
}

export function useTTS() {
  const context = useContext(TTSContext)
  if (context === undefined) {
    throw new Error('useTTS must be used within a TTSProvider')
  }
  return context
}
