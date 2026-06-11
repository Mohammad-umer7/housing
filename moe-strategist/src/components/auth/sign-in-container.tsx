'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

const VALID_USER  = { email: 'strategist@moe.gov', password: 'MOE2026!' }
const VALID_ADMIN = { email: 'admin@moe.gov',       password: 'AdminPass2026!' }

type Panel = 'main' | 'officer' | 'admin'

export function SignInPageContainer() {
  const router = useRouter()
  const [panel,    setPanel]    = useState<Panel>('main')
  const [lang,     setLang]     = useState<'en' | 'ar'>('en')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const ar = lang === 'ar'

  const signIn = async (role: 'user' | 'admin') => {
    setError(null)
    setLoading(true)
    const valid = role === 'user'
      ? email === VALID_USER.email  && password === VALID_USER.password
      : email === VALID_ADMIN.email && password === VALID_ADMIN.password
    await new Promise(r => setTimeout(r, 600))
    if (valid) {
      localStorage.setItem('userRole',  role)
      localStorage.setItem('userEmail', email)
      router.push('/dashboard')
    } else {
      setError(ar ? '?????? ?????????? ?? ???? ?????? ??? ?????' : 'Invalid email or password')
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#f5f0e8', direction: ar ? 'rtl' : 'ltr' }}
    >
      {/* Language toggle */}
      <div className="absolute top-4 left-4 z-10">
        <button
          onClick={() => setLang(ar ? 'en' : 'ar')}
          className="px-4 py-1.5 rounded-full border border-[#c2a14e]/60 text-sm font-medium text-[#9b7a36] bg-white/80 hover:bg-white transition-all"
        >
          {ar ? 'English' : '???????'}
        </button>
      </div>

      {/* Centre card */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        {panel === 'main' && (
          <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-xl px-10 py-10 text-center">
            <div className="flex justify-center mb-5">
              <div className="w-20 h-20 rounded-full bg-[#f5f0e8] flex items-center justify-center border border-[#e8dcc8]">
                <Image src="/logo.png" alt="MOE" width={52} height={52} unoptimized priority />
              </div>
            </div>
            <span className="inline-block text-[10px] font-semibold tracking-widest uppercase text-[#9b7a36] border border-[#c2a14e]/40 rounded-full px-3 py-1 mb-3">
              {ar ? '????? ?????? ??????? ???????' : 'Ministry of Energy & Infrastructure'}
            </span>
            <h1 className="text-3xl font-extrabold text-[#1a1208] mb-1 tracking-tight">
              {ar ? 'MOE STRATIGESE' : 'MOE STRATIGESE'}
            </h1>
            <p className="text-sm text-[#9b7a36] mb-7">
              {ar ? '?????? ??? ????? ?????? ???? ????? ??????.' : 'For a personalised experience, please sign in.'}
            </p>
            <button
              onClick={() => setPanel('officer')}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl border-2 border-[#e0d8cc] bg-white hover:bg-[#faf6ec] transition-all text-base font-semibold text-[#1a1208] shadow-sm mb-4"
            >
              <span className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden bg-white border border-[#e0d8cc] flex-shrink-0">
                <svg viewBox="0 0 40 40" width="28" height="28" fill="none">
                  <circle cx="20" cy="20" r="20" fill="white"/>
                  <path d="M20 6 A14 14 0 0 1 34 20" stroke="#00a651" strokeWidth="5" fill="none" strokeLinecap="round"/>
                  <path d="M34 20 A14 14 0 0 1 20 34" stroke="#000000" strokeWidth="5" fill="none" strokeLinecap="round"/>
                  <path d="M20 34 A14 14 0 0 1 6 20"  stroke="#ef3340" strokeWidth="5" fill="none" strokeLinecap="round"/>
                  <path d="M6 20 A14 14 0 0 1 20 6"   stroke="#ef3340" strokeWidth="5" fill="none" strokeLinecap="round"/>
                  <circle cx="20" cy="20" r="5" fill="#1a1208"/>
                </svg>
              </span>
              {ar ? '????? ?????? ?? UAE PASS' : 'Sign in with UAE PASS'}
            </button>
            <button className="text-sm text-[#9b7a36] underline-offset-4 hover:underline">
              {ar ? '?? ?? UAE PASS?' : 'What is UAE PASS?'}
            </button>
          </div>
        )}

        {(panel === 'officer' || panel === 'admin') && (
          <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-xl px-10 py-8">
            <button
              onClick={() => { setPanel('main'); setError(null); setEmail(''); setPassword('') }}
              className="flex items-center gap-1 text-sm text-[#9b7a36] hover:text-[#7a6030] mb-6"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 12L6 8l4-4"/></svg>
              {ar ? '????' : 'Back'}
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-[#f5f0e8] flex items-center justify-center border border-[#e8dcc8] flex-shrink-0">
                <Image src="/logo.png" alt="MOE" width={32} height={32} unoptimized priority />
              </div>
              <div>
                <p className="text-[10px] font-semibold tracking-widest uppercase text-[#9b7a36]">
                  {ar ? '????? ??????' : 'Ministry of Energy'}
                </p>
                <p className="text-base font-bold text-[#1a1208]">
                  {panel === 'admin' ? (ar ? '???? ???????' : 'Admin Access') : (ar ? '???? ??????' : 'Officer Access')}
                </p>
              </div>
            </div>
            <form onSubmit={e => { e.preventDefault(); signIn(panel === 'admin' ? 'admin' : 'user') }} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#4a3728] mb-1.5 uppercase tracking-wide">
                  {ar ? '?????? ??????????' : 'Email Address'}
                </label>
                <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder={panel === 'admin' ? 'admin@moe.gov' : 'strategist@moe.gov'}
                  className="w-full px-4 py-3 rounded-xl border border-[#e0d8cc] bg-[#faf6ec] text-[#1a1208] text-sm focus:outline-none focus:ring-2 focus:ring-[#9b7a36] placeholder:text-[#c2a14e]/60" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4a3728] mb-1.5 uppercase tracking-wide">
                  {ar ? '???? ??????' : 'Password'}
                </label>
                <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-[#e0d8cc] bg-[#faf6ec] text-[#1a1208] text-sm focus:outline-none focus:ring-2 focus:ring-[#9b7a36]" />
              </div>
              {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl bg-[#1a1208] hover:bg-[#2a1e0a] text-white font-semibold text-sm transition-all disabled:opacity-60">
                {loading ? (ar ? '???? ??????…' : 'Verifying…') : (ar ? '????? ??????' : 'Sign In')}
              </button>
              <p className="text-center text-[11px] text-[#9b7a36] pt-1">
                {panel === 'admin' ? 'admin@moe.gov / AdminPass2026!' : 'strategist@moe.gov / MOE2026!'}
              </p>
            </form>
          </div>
        )}
      </div>

      {/* Bottom buttons */}
      <div className="flex justify-center gap-4 pb-10 px-4">
        <button onClick={() => { setPanel('officer'); setError(null) }}
          className="px-8 py-3 rounded-full border border-[#c2a14e]/50 text-sm font-semibold text-[#4a3728] bg-white/80 hover:bg-white hover:border-[#9b7a36] transition-all shadow-sm tracking-wide">
          {ar ? '???????? ?????' : 'CONTINUE AS AN OFFICER'}
        </button>
        <button onClick={() => { setPanel('admin'); setError(null) }}
          className="px-8 py-3 rounded-full border border-[#c2a14e]/50 text-sm font-semibold text-[#4a3728] bg-white/80 hover:bg-white hover:border-[#9b7a36] transition-all shadow-sm tracking-wide">
          {ar ? '???????? ??????' : 'CONTINUE AS AN ADMIN'}
        </button>
      </div>
    </div>
  )
}