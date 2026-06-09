import {
  isPrioritySocialStatus,
  PRIORITY_SOCIAL_STATUSES,
  SOCIAL_STATUS_LABELS,
  type SocialStatus,
} from '../lib/integrations/uae-pass'

describe('UAE PASS social-status classification', () => {
  it('treats the four hardship categories as priority (fast-track handling)', () => {
    expect(isPrioritySocialStatus('widow')).toBe(true)
    expect(isPrioritySocialStatus('orphan')).toBe(true)
    expect(isPrioritySocialStatus('senior')).toBe(true)
    expect(isPrioritySocialStatus('determination')).toBe(true)
  })

  it('treats a regular beneficiary as non-priority', () => {
    expect(isPrioritySocialStatus('none')).toBe(false)
  })

  it('is null/garbage safe', () => {
    expect(isPrioritySocialStatus(null)).toBe(false)
    expect(isPrioritySocialStatus(undefined)).toBe(false)
    expect(isPrioritySocialStatus('')).toBe(false)
    expect(isPrioritySocialStatus('something-else')).toBe(false)
  })

  it('has exactly the four priority categories and never includes none', () => {
    expect(PRIORITY_SOCIAL_STATUSES.size).toBe(4)
    expect(PRIORITY_SOCIAL_STATUSES.has('none' as SocialStatus)).toBe(false)
  })

  it('labels every social status bilingually with the brief Arabic terms', () => {
    const keys: SocialStatus[] = ['none', 'widow', 'orphan', 'senior', 'determination']
    for (const k of keys) {
      expect(SOCIAL_STATUS_LABELS[k].en.length).toBeGreaterThan(0)
      expect(SOCIAL_STATUS_LABELS[k].ar.length).toBeGreaterThan(0)
    }
    expect(SOCIAL_STATUS_LABELS.widow.ar).toBe('أرملة')
    expect(SOCIAL_STATUS_LABELS.orphan.ar).toBe('يتيم')
    expect(SOCIAL_STATUS_LABELS.senior.ar).toBe('كبار المواطنين / متقاعد')
    expect(SOCIAL_STATUS_LABELS.determination.ar).toBe('أصحاب الهمم')
  })
})
