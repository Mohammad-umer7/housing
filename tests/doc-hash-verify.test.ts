import { createHash } from 'crypto'
import { checkHashIntegrity } from '@/lib/doc-hash-verify'

const makeToken = (text: string) =>
  createHash('sha256').update(text, 'utf8').digest('hex')

const makeDocWithToken = (body: string, prefix = 'CryptoSignatureToken') => {
  const hash = makeToken(body.trim())
  return `${body}\n${prefix}: ${hash}`
}

describe('checkHashIntegrity', () => {
  it('returns hasToken=false when no token in text', () => {
    const result = checkHashIntegrity('Emirates International Hospital\nSalama Al Ameri\nLumbar Disc Herniation')
    expect(result.hasToken).toBe(false)
    expect(result.hashMatch).toBe(false)
  })

  it('returns hasToken=false for empty input', () => {
    expect(checkHashIntegrity('').hasToken).toBe(false)
  })

  it('verifies an original, unmodified document', () => {
    const body = 'Emirates International Hospital\nSalama Al Ameri\n784-1980-9041475-5\nLumbar Disc Herniation — 3 months medical leave'
    const doc = makeDocWithToken(body)
    const result = checkHashIntegrity(doc)
    expect(result.hasToken).toBe(true)
    expect(result.hashMatch).toBe(true)
  })

  it('detects modification when name is changed', () => {
    const originalBody = 'Emirates International Hospital\nSalama Al Ameri\n784-1980-9041475-5\nLumbar Disc Herniation'
    const doc = makeDocWithToken(originalBody)
    // Tamper: change the name
    const tampered = doc.replace('Salama Al Ameri', 'Alexander Mercer')
    const result = checkHashIntegrity(tampered)
    expect(result.hasToken).toBe(true)
    expect(result.hashMatch).toBe(false)
  })

  it('detects modification when diagnosis is changed', () => {
    const originalBody = 'Emirates International Hospital\nSalama Al Ameri\n784-1980-9041475-5\nLumbar Disc Herniation'
    const doc = makeDocWithToken(originalBody)
    const tampered = doc.replace('Lumbar Disc Herniation', 'Minor back pain')
    const result = checkHashIntegrity(tampered)
    expect(result.hasToken).toBe(true)
    expect(result.hashMatch).toBe(false)
  })

  it('detects modification when Emirates ID is changed', () => {
    const originalBody = 'Emirates International Hospital\nSalama Al Ameri\n784-1980-9041475-5\nLumbar Disc Herniation'
    const doc = makeDocWithToken(originalBody)
    const tampered = doc.replace('784-1980-9041475-5', '784-1992-4820194-3')
    const result = checkHashIntegrity(tampered)
    expect(result.hasToken).toBe(true)
    expect(result.hashMatch).toBe(false)
  })

  it('detects token modification (forged token)', () => {
    const originalBody = 'Emirates International Hospital\nSalama Al Ameri'
    const doc = makeDocWithToken(originalBody)
    // Attacker tampers the name AND tries to forge the token
    const fakeHash = makeToken('Emirates International Hospital\nAlexander Mercer')
    const forgedDoc = doc
      .replace('Salama Al Ameri', 'Alexander Mercer')
      .replace(/CryptoSignatureToken: [a-f0-9]+/, `CryptoSignatureToken: ${fakeHash}`)
    // Forged token matches the tampered content — this should PASS (the attacker reconstructed correctly)
    // This tests that our check is a content check, not a secret key check
    const result = checkHashIntegrity(forgedDoc)
    expect(result.hasToken).toBe(true)
    expect(result.hashMatch).toBe(true) // attacker with full access can regenerate — this is expected
  })

  it('supports SZHP-VERIFY-TOKEN prefix', () => {
    const body = 'Emirates International Hospital\nSalama Al Ameri'
    const doc = makeDocWithToken(body, 'SZHP-VERIFY-TOKEN')
    const result = checkHashIntegrity(doc)
    expect(result.hasToken).toBe(true)
    expect(result.hashMatch).toBe(true)
  })

  it('buildVerificationReport sets hash_tampered verdict when hash mismatches', () => {
    const { buildVerificationReport } = require('@/lib/document-forensics')
    const report = buildVerificationReport({
      expectedType: 'supporting_document',
      record: null,
      declaredSalary: null,
      extracted: { salary: null, name: 'Salama Al Ameri', employer: 'Emirates International Hospital', emiratesId: null },
      structure: null,
      arithmetic: null,
      vision: null,
      hashIntegrity: { hasToken: true, hashMatch: false, storedHash: 'abc123', computedHash: 'def456' },
    })
    expect(report.verdict).toBe('hash_tampered')
    expect(report.summary).toContain('modified from its original')
    expect(report.summary).toContain('resubmit the original')
  })

  it('buildVerificationReport sets verified verdict when hash matches', () => {
    const { buildVerificationReport } = require('@/lib/document-forensics')
    const report = buildVerificationReport({
      expectedType: 'supporting_document',
      record: null,
      declaredSalary: null,
      extracted: { salary: null, name: 'Salama Al Ameri', employer: 'Emirates International Hospital', emiratesId: null },
      structure: { docType: 'supporting_document', score: 1, found: 3, total: 3, looksLikeExpectedDoc: true },
      arithmetic: null,
      vision: null,
      hashIntegrity: { hasToken: true, hashMatch: true, storedHash: 'abc123', computedHash: 'abc123' },
    })
    expect(report.verdict).toBe('verified')
  })

  it('hash_tampered verdict outranks vision suspicious', () => {
    const { buildVerificationReport } = require('@/lib/document-forensics')
    const report = buildVerificationReport({
      expectedType: 'supporting_document',
      record: null,
      declaredSalary: null,
      extracted: { salary: null, name: null, employer: null, emiratesId: null },
      structure: null,
      arithmetic: null,
      vision: { verdict: 'suspicious', confidence: 80, reasons: ['looks fake'], matchesExpectedType: true, observed: { documentType: null, salary: null, employeeName: null, employerName: null, issueDate: null } },
      hashIntegrity: { hasToken: true, hashMatch: false, storedHash: 'abc123', computedHash: 'def456' },
    })
    expect(report.verdict).toBe('hash_tampered')
  })
})
