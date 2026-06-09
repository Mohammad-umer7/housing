# SADDAD — Document Verification (QR authenticity vs the issuing authority)

SADDAD does not trust the salary a citizen types or the PDF they upload. It verifies
the uploaded **salary certificate** against an **independent authority** — exactly how
real UAE systems verify income (salary against WPS/MOHRE, identity against UAE PASS).

## Two systems of record

| | Owner (modelled) | Holds | Project |
|---|---|---|---|
| **DB-1** | Loan servicer (e.g. Emirates Development Bank) | applicants, cases, arrears, installments, audit | `saddad-housing-arrears` |
| **DB-2** | Salary / document authority (WPS / issuing HR) | authoritative salary-certificate registry | `saddad-document-registry` |

DB-2 is a **separate Supabase project** reached through its own adapter
([`lib/integrations/document-authority.ts`](../lib/integrations/document-authority.ts))
and its own env vars (`DOC_REGISTRY_SUPABASE_URL`, `DOC_REGISTRY_SUPABASE_KEY`). Swapping
to the real authority means replacing `lookupCertificate` — nothing else changes.

## How a certificate is verified

Every genuine certificate carries a **QR code** encoding a unique `doc_code`. That code
is stored in DB-2 alongside the authoritative name, employer and salary, keyed by
Emirates ID.

```
upload PDF ─► extract text (salary, name)        ─┐
           ─► TRUE QR scan → doc_code             ─┤
                                                   ▼
                 lookup doc_code in DB-2 (authority registry)
                                                   ▼
   verified      = QR resolves AND salary matches the authority record
   mismatch      = QR resolves BUT printed/declared salary ≠ authority  → ESCALATE
   unverifiable  = QR code not in the registry (or revoked)             → ESCALATE
   no_qr         = no decodable QR on the document                      → ESCALATE
```

- **The QR proves authenticity; comparing the printed/declared salary against the DB-2
  record proves integrity.** Together they catch every tamper: editing the salary,
  removing the QR, or presenting an unrecognised code.
- A failure is routed to a human officer (`FORCE_ESCALATE` in the Compliance Critic,
  flag `salary_certificate_tampered` / `certificate_not_recognised_by_authority` /
  `missing_verification_qr`). SADDAD never auto-rejects a citizen on a document signal
  (PDPL).

## Where it lives in the pipeline

1. [`app/api/process-application/route.ts`](../app/api/process-application/route.ts) —
   on upload, runs text extraction **and** `extractQrFromPDF` (decodes the QR).
2. [`agents/document-agent.ts`](../agents/document-agent.ts) — looks the code up in DB-2
   and computes the authenticity verdict (`verified` / `mismatch` / `unverifiable` /
   `no_qr`).
3. [`agents/critic-agent.ts`](../agents/critic-agent.ts) — a deterministic guard escalates
   any non-`verified` certificate (so tampering always escalates, regardless of the LLM).

## Tech stack (server-side)

- **`unpdf`** — serverless-friendly pdfjs build for text extraction + page rendering.
  Raw `pdfjs-dist` fails to load its ESM worker inside the Next.js server runtime; unpdf
  avoids that.
- **`@napi-rs/canvas`** — prebuilt (no native build) rasteriser for the rendered page.
- **`jsqr`** — decodes the QR from the rasterised pixels.
- **`qrcode` + `pdfkit`** — used only by the certificate generator (build-time tool).

**Limitation:** decoding needs a renderable PDF page. Generated/digital certificates work
out of the box; a low-quality scanned photo may not decode (returns `no_qr` → escalates,
which is the safe outcome).

## Demo certificates

`tools/generate-certificates.mjs` writes ready-to-use PDFs to `demo-certificates/`:

| File | What it demonstrates |
|---|---|
| `MOEI-2026-1001_salary_certificate.pdf` (+ 1002–1006) | Genuine cert — QR verifies, salary matches → proceeds |
| `MOEI-2026-1001_TAMPERED-salary.pdf` | Salary edited to AED 45,000; QR still resolves to 15,000 → `mismatch` → ESCALATE |
| `MOEI-2026-1001_UNKNOWN-qr.pdf` | QR code not in the registry → `unverifiable` → ESCALATE |
| `MOEI-2026-1001_NO-qr.pdf` | No QR at all → `no_qr` → ESCALATE |

Regenerate after changing the registry: `node tools/generate-certificates.mjs`
(the `doc_code`s must match the `salary_certificate_registry` rows in DB-2).

> Verified live: a genuine cert with an affordable profile → **APPROVED** (`Authority QR: ✓ verified`);
> the tampered cert → **ESCALATED** (`Authority QR: ⚠ mismatch`, flag `salary_certificate_tampered`).
