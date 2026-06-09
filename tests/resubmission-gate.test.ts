import { decideResubmissionGate } from '../lib/data-layer'

// The re-submission gate decides whether a citizen may submit a NEW application under
// the same Application ID, based on the live job + the last decided case. A genuine
// officer escalation ('Refer to Employee') blocks; a "Request Documents" outcome does
// NOT (the citizen must be able to re-upload). Rejected lets them re-apply.
describe('Re-submission gate', () => {
  it('blocks while a job is actively processing (regardless of any prior decision)', () => {
    const g = decideResubmissionGate({ hasActiveJob: true, status: 'approved', recommendation: 'Approve' })
    expect(g.blocked).toBe(true)
    expect(g.state).toBe('processing')
  })

  it('blocks while the case is still pending (no job row yet)', () => {
    const g = decideResubmissionGate({ hasActiveJob: false, status: 'pending', recommendation: null })
    expect(g.blocked).toBe(true)
    expect(g.state).toBe('processing')
  })

  it('blocks a genuine officer escalation (Refer to Employee)', () => {
    const g = decideResubmissionGate({ hasActiveJob: false, status: 'escalated', recommendation: 'Refer to Employee' })
    expect(g.blocked).toBe(true)
    expect(g.state).toBe('under_review')
  })

  it('blocks an already-approved application', () => {
    const g = decideResubmissionGate({ hasActiveJob: false, status: 'approved', recommendation: 'Approve' })
    expect(g.blocked).toBe(true)
    expect(g.state).toBe('approved')
  })

  it('ALLOWS a "Request Documents" outcome that landed as escalated (citizen must re-upload)', () => {
    const g = decideResubmissionGate({ hasActiveJob: false, status: 'escalated', recommendation: 'Request Documents' })
    expect(g.blocked).toBe(false)
  })

  it('ALLOWS a "Request Documents" outcome that landed as rejected (G-01 missing docs)', () => {
    const g = decideResubmissionGate({ hasActiveJob: false, status: 'rejected', recommendation: 'Request Documents' })
    expect(g.blocked).toBe(false)
  })

  it('ALLOWS re-application after a hard rejection', () => {
    const g = decideResubmissionGate({ hasActiveJob: false, status: 'rejected', recommendation: 'Reject' })
    expect(g.blocked).toBe(false)
  })

  it('ALLOWS a first-time submission (no prior case)', () => {
    const g = decideResubmissionGate({ hasActiveJob: false, status: null, recommendation: null })
    expect(g.blocked).toBe(false)
  })
})
