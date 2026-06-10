# SADDAD — Native Flutter Android App: Build Specification (Handoff)

> **Purpose of this document.** This is a complete, self-contained spec for building a
> **native Flutter (Dart) Android app** for the SADDAD Housing-Arrears Rescheduling
> system. Hand it to the AI/developer building the app. They do **not** need to touch the
> existing web backend — the Flutter app is a **new, separate repo** that talks to the
> already-deployed Next.js API over HTTPS.
>
> **Two supplementary files to hand over with this spec** (they are the visual + language
> source of truth and already exist in the web repo):
> - `app/globals.css` — the exact MOEI design system (colors, spacing, component styling)
> - `lib/i18n.ts` — the complete English→Arabic string dictionary
>
> Build target: **all three portals — Citizen, Officer, Admin** — natively, matching the
> web app's look and behavior.

---

## 1. Architecture

```
┌──────────────────────────────┐      HTTPS / JSON (+ multipart)      ┌─────────────────────────────────┐
│      Flutter Android app      │  ────────────────────────────────▶ │   Existing Next.js API (deployed) │
│   (this new repo — UI only)   │  ◀──────────────────────────────── │   LangGraph agents · Supabase ·   │
│   replicates all 3 portals    │      session cookie auth            │   Gemini/Groq · Twilio · TTS      │
└──────────────────────────────┘                                     └─────────────────────────────────┘
```

- **Do NOT reimplement business logic in Dart.** The AI agent pipeline, governance rules,
  document forensics, Supabase access, and LLM calls all stay server-side. The Flutter app
  is a **presentation + API-client layer only**.
- The app is a pure REST client. **No browser → no CORS restrictions** apply to native
  Flutter HTTP; just call the endpoints.
- **Base URL** is an environment constant, e.g. `https://<your-deployment>.vercel.app`.
  Make it configurable via `--dart-define=API_BASE_URL=...` (default to the prod URL).

---

## 2. Tech stack & packages

| Concern | Package | Notes |
|---|---|---|
| Language/SDK | Flutter 3.24+ / Dart 3.5+ | Material 3 enabled |
| State management | `flutter_riverpod` | App-wide; `AsyncNotifier` for API-backed state |
| Networking | `dio` | One configured client + interceptors |
| Cookie session | `dio_cookie_manager` + `cookie_jar` (`PersistCookieJar`) | **Critical** — see §7 |
| Routing | `go_router` | Declarative routes + auth redirect guard |
| Secure storage | `flutter_secure_storage` | Persist App ID / role / (optional token) |
| Local prefs | `shared_preferences` | Language, accessibility settings |
| Charts (Admin) | `fl_chart` | Donut + bar dashboards |
| Fonts | `google_fonts` | Plus Jakarta Sans + IBM Plex Sans Arabic |
| Text-to-speech | `flutter_tts` | Local TTS (replaces web read-aloud) |
| Document upload | `file_picker` (PDF) + `image_picker` (camera) | multipart submit |
| Localization | `flutter_localizations` + `intl` | EN/AR + RTL |
| JSON models | `freezed` + `json_serializable` (build_runner) | Immutable models |
| Env config | `--dart-define` | API base URL, flags |
| Push (optional) | `firebase_messaging` | Mirror web WhatsApp notifications |

---

## 3. Project structure

```
lib/
  main.dart
  app.dart                       # MaterialApp.router, theme, locale
  core/
    config.dart                  # API_BASE_URL, flags
    theme/
      colors.dart                # design tokens (§5)
      typography.dart
      app_theme.dart             # ThemeData (light) + component themes
    i18n/
      strings_ar.dart            # English-key → Arabic map (port lib/i18n.ts)
      l10n.dart                  # t(en) lookup + Directionality helper
    network/
      api_client.dart            # Dio + cookie jar + interceptors
      api_result.dart            # envelope unwrap (success/version/data/error)
      api_exception.dart
  data/
    models/                      # freezed models (§8)
    repositories/                # auth, cases, officer, admin, assistant repos
  features/
    auth/        (login, modals: uaepass / officer / admin / whatis)
    citizen/     (home/case-cards, submission wizard, processing timeline, decision detail)
    officer/     (escalation queue, case detail + decision)
    admin/       (overview+charts, cases, users, feedback, settings)
    assistant/   (floating chat sheet)
    settings/    (accessibility + language)
  shared/
    widgets/     (GovHeader, GovFooter, Card, Pill, Field, DataHead, Stepper, Timeline, KpiCard, Notice, Modal, Buttons)
    formatters.dart  (AED currency, dates)
```

---

## 4. Design system → Flutter

Port `app/globals.css` verbatim into `colors.dart` / `app_theme.dart`. Light theme, gold/bronze
on cream/white. **Match these tokens exactly.**

### Colors
```dart
// Brand
const gold       = Color(0xFF9B7A36); // primary (buttons, links, headings)
const goldBright = Color(0xFFC2A14E);
const goldDark   = Color(0xFF7C612A); // hover/pressed
const goldTint   = Color(0xFFF3ECDC);
const goldLine   = Color(0xFFE3D7BE);
// Neutrals
const ink     = Color(0xFF16181D);
const inkNavy = Color(0xFF1C2733);
const body    = Color(0xFF3F454E);
const muted   = Color(0xFF6B7280);
const faint   = Color(0xFF94999F);
// Surfaces
const bg        = Color(0xFFFFFFFF);
const cream     = Color(0xFFF6F0E1);
const creamSoft = Color(0xFFFAF6EC);
const panelAlt  = Color(0xFFF6F5F1);
const line      = Color(0xFFE7E4DB);
const lineStrong= Color(0xFFD8D3C6);
// Status
const red=Color(0xFFC8102E);   const redSoft=Color(0xFFFBECEE);
const green=Color(0xFF1E8E3E); const greenSoft=Color(0xFFEAF5EC);
const amber=Color(0xFFB7791F); const amberSoft=Color(0xFFFBF2E0);
const blue=Color(0xFF1F5FA8);  const blueSoft=Color(0xFFEAF1F9);
```

### Geometry
- Radii: sm 6, base 10, lg 14, xl 20.
- Shadows: sm `0 1 2 rgba(22,24,29,.06)`, base `0 4 16 .07`, lg `0 18 48 .12`.
- Base text: 16px, line-height 1.55. Headings weight 800, letter-spacing -0.015em.

### Typography
- Latin: **Plus Jakarta Sans** (400/500/600/700/800).
- Arabic: **IBM Plex Sans Arabic** (400/500/600/700) — applied app-wide when locale = AR.

### Component widgets to build (match web classes)
- **GovHeader** — top gold rule (6px gradient) + sticky nav row. Citizen tabs: Submit,
  Processing, Settings, Logout. Officer/Admin headers use the federal lockup + tab links.
- **GovFooter** — footer bar with social row.
- **Card** (`.card` + `.card-pad`), **CardHeader** (`.card-hd`).
- **Buttons**: primary (gold), ghost, neutral, green, red; sizes base/lg; `block` full-width.
- **Pill / Badge** (green/red/amber/blue/gold/gray), **StatusOnline** dot.
- **Field** (label EN + AR, input/select; read-only variant = `panel-alt` bg).
- **DataHead** (colored dot + EN / AR label + optional speaker icons → TTS).
- **Notice** (gold or blue info banner).
- **Stepper** (wizard step dots + connectors) and **Timeline** (vertical processing stepper:
  complete/active/pending states, green connector line).
- **KpiCard** (label + big value + Arabic sub; green/red/amber variants with left accent bar).
- **Modal** (bottom sheet or dialog) for login + confirmations.

> **Responsiveness:** the web app was just made fully responsive; on phones it stacks to a
> single column, tables scroll horizontally, and headers become swipeable tab rows. In
> Flutter you are mobile-first by default, so build single-column layouts; use horizontal
> `ListView`/`DataTable` inside a scroll view for the admin tables.

---

## 5. API contract

**All responses use this envelope** (`lib/api-response.ts`):
```jsonc
// success
{ "success": true,  "version": "v1", "timestamp": "...", "data": { ... }, "meta"?: ... }
// error
{ "success": false, "version": "v1", "timestamp": "...", "error": "message", "code"?: 401 }
```
The API client must unwrap `data` on success and throw `ApiException(error, code)` on failure.
HTTP status mirrors `code` (200/400/401/403/404/409/429/500).

**Auth:** every data endpoint calls `requireAuth` → requires the **session cookie**
`saddad_session` (httpOnly, HMAC-signed, 8h expiry). The cookie is set by the login
endpoints' `Set-Cookie` header. With `dio_cookie_manager` the app stores and resends it
automatically (§7). Roles: `admin | officer | readonly`.

### Auth endpoints
| Method | Path | Body | Returns / effect |
|---|---|---|---|
| POST | `/api/auth/login` | `{username, password}` | Sets cookie; `data:{role, username}`. 401 on bad creds, 429 on >10/min/IP. |
| POST | `/api/auth/demo-login` | — | DEMO_MODE only. Issues an **officer** session cookie (used as the citizen entry in demo). 403 if disabled. |
| POST | `/api/auth/persona-login` | `{caseNumber}` | DEMO_MODE only. Session carrying `caseNumber`+`name` (auto-loads that citizen). |
| GET | `/api/auth/personas` | — | List of demo personas (for a "log in as" picker). |
| GET | `/api/auth/me` | — | `{role, username, caseNumber, name}` or 401. Use on boot to restore session. |
| POST | `/api/auth/logout` | — | Clears the cookie. |

### Citizen endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/cases/lookup?caseNumber=ID` | Validate an Application ID + **prefill** the form. Returns full applicant + loan + UAE PASS social profile + `requiredDocuments{requiresUpload,label,primaryType}` + `resubmission` gate + `needsDocuments`. 404 if unknown. |
| GET | `/api/v1/cases/history?appId=ID` | All submissions (history cards) for the beneficiary (keyed by Emirates ID): `data:{applicant, cases[]}`. Each case: `case_number, full_name, status, recommendation, arrears_amount, monthly_salary, monthly_payment, duration_months, processed_at, created_at`. |
| POST | `/api/v1/cases/submit` | Submit an application. **multipart/form-data** when a PDF is attached (field `salaryCertificate`), else JSON. Returns `data:{caseId, queuePosition, message}`. 409 if a prior case is still active (resubmission gate). |
| GET | `/api/v1/cases/{id}/status` | **Poll** processing status. Returns `{caseNumber, status, agentSteps[], decision|null, processingTimeMs, queuePosition}`. Poll every ~1.5–2s until `status ∈ {approved, rejected, escalated}`. |

**Submit field set** (strings unless noted; send what the form collected + prefilled loan data):
`case_number, full_name, emirates_id, phone, arrears_amount, monthly_salary, monthly_expenses,
reschedule_reason, months_in_arrears, remarks, remaining_loan_months, current_installment,
loan_bank_name, loan_account_number, total_loan_amount, auto_dda` and optional file
`salaryCertificate` (PDF). The server re-keys each submission as `BASE_ID`, then `BASE_ID-r2`,
`-r3`… for re-submissions.

### Officer endpoints (role: officer or admin)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/officer/cases` | Officer → escalated cases only (the manual-review queue). Admin → all cases (`?status=approved|rejected|escalated|all`). `data:{cases[], total}`. |
| GET | `/api/officer/cases/{caseNumber}` | Full case row + `agentSteps[]` + `auditLogs[]`. |
| PATCH | `/api/officer/cases/{caseNumber}` | `{action:"APPROVE"|"REJECT", officerNotes?}` → sets terminal status, writes audit log, fires WhatsApp. Returns `{caseNumber, newStatus, message}`. |
| GET | `/api/officer/cases/{caseNumber}/document` | The uploaded certificate (for preview/download). |

### Admin endpoints (role: admin; some allow officer)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/dashboard` (alias `/api/v1/dashboard/stats`) | `{cases[], stats{total,approved,rejected,escalated}, queue{queued,processing,avgProcessingMs,longestWaitMs}}`. |
| GET | `/api/admin/users?page&limit&search&status` | Paginated applicants + merged case status. `data:{users[], total, page, limit}`. (Officer sees same list, sensitive fields nulled.) |
| GET | `/api/admin/users/{caseNumber}` | Single applicant full detail (identity, financials, loan, payment history). |
| GET / PUT | `/api/admin/settings/rules` | Governance thresholds: `maxDeductionPercent, hardshipDeductionPercent, hardshipPerMemberIncome, certFreshnessDays, dbrCapSalaried, dbrCapRetiree, salaryDiscrepancyThresholdPct` (+ `defaults`). PUT validates ranges. |
| GET / PUT | `/api/admin/settings/assistant` | Custom AI-assistant instructions per audience role. |
| GET / POST | `/api/feedback` | POST citizen rating/comment; GET admin feedback list + average. |

### Cross-cutting endpoints
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/assistant/chat` | `{messages:[{role,content}], caseNumber?, audience?:"citizen"|"officer"}` → `{reply, source}`. Audience tone is role-aware; admin gets live stats; citizen persona limited to own case. 429 if >30/min/IP. |
| POST | `/api/tts` | `{text, lang?}` → audio bytes. **Optional** — prefer local `flutter_tts` instead. |
| GET | `/api/case-status/{caseNumber}` | Lightweight public-style status lookup. |

---

## 6. Auth strategy for mobile (IMPORTANT)

The web uses an **httpOnly session cookie**. For a native app this is the *simplest and most
robust* path — **no backend change needed**:

1. Configure one `Dio` instance with `CookieManager(PersistCookieJar(...))` pointing at app
   storage. It captures `Set-Cookie` from login responses and resends `Cookie` on every
   request automatically. httpOnly is irrelevant on native (there is no JS).
2. The persisted jar survives app restarts; the cookie self-expires after 8h → on a 401,
   route the user back to login.
3. On boot, call `GET /api/auth/me` to restore the session/role; if 401, show login.

**Login flows to implement:**
- **Citizen (demo):** `POST /api/auth/demo-login` (gets session) → `GET /api/v1/cases/lookup?caseNumber=<AppID>` to validate the entered Application ID → store the App ID in secure storage → go to citizen Home. (UI text: "Sign in with UAE PASS".)
- **Officer / Admin:** `POST /api/auth/login {username,password}` → route by returned `role`
  (admin→Admin portal, officer→Officer portal).

> **Optional backend enhancement (only if you prefer header tokens over a cookie jar):**
> add a tiny token path — have the login endpoints also return the signed session string in
> the JSON body; store it in `flutter_secure_storage` and send `Authorization: Bearer <token>`;
> teach `requireAuth` to accept that header. The cookie-jar approach above needs **zero**
> backend changes, so prefer it unless there's a reason not to.

> **Production note:** `demo-login` / `persona-login` are demo shims gated by `DEMO_MODE`.
> The real citizen sign-in is **UAE PASS OIDC** — implement via an OAuth/OIDC redirect
> (`flutter_appauth` or `flutter_web_auth_2`) when the backend exposes the OIDC flow.

---

## 7. Data models (define with freezed + json_serializable)

Mirror the API exactly. Minimum set:

- **Session**: `role, username, caseNumber?, name?`
- **CaseSummary** (history card): `caseNumber, fullName, status, recommendation?, arrearsAmount, monthlySalary, monthlyPayment?, durationMonths?, processedAt?, createdAt?`
- **LookupResult** (form prefill): identity (`fullName, fullNameAr?, emiratesId?, phone?`),
  financials (`arrearsAmount, monthlySalary, monthlyExpenses, monthsInArrears, incomeChanged`),
  loan (`loanBankName, loanAccountNumber?, totalLoanAmount?, remainingLoanBalance?,
  currentInstallment, remainingLoanMonths, autoDda`), `paymentHistory[]{month?,status}`,
  `uaePass?{numberOfChildren, socialStatus, socialStatusLabel, socialStatusLabelAr, isPriority}`,
  `needsDocuments, priorRecommendation?, resubmission{blocked,reason?},
  requiredDocuments{requiresUpload,label,primaryType}`.
- **AgentStep**: `agentName, status, durationMs?, ranInParallel, resultSummary`.
- **CaseStatus**: `caseNumber, status, agentSteps[], decision?, processingTimeMs?, queuePosition?`.
- **Decision**: `outcome, monthlyPayment?, durationMonths?, rationale, rationaleAr, riskLevel,
  consistencyScore?, similarCasesFound?, fairnessNote, totalNewMonthly?, currentInstallment?,
  monthlySalary?, recoveryGuidance, recoveryGuidanceAr, caseStudy?`.
- **OfficerCaseDetail**: the full `cases` row + `agentSteps[]` + `auditLogs[]{id,action,decision,rationale,processedBy,timestamp,ruleTriggered}`.
- **DashboardData**: `cases[], stats{total,approved,rejected,escalated}, queue{queued,processing,avgProcessingMs,longestWaitMs}`.
- **AdminUser**: applicant fields + `case{status,decision,processedAt,priorityEscalation}?`.
- **RulesSettings** + `defaults`. **AssistantMessage**: `role,content`.

Statuses: `pending | queued | processing | approved | rejected | escalated`.
Terminal = `approved | rejected | escalated`. Decision recommendations include
`"Request Documents"` (→ documents-only re-upload flow).

---

## 8. Screen-by-screen spec

### A. Login  (`/login`)
- Centered card: emblem, "Ministry of Energy & Infrastructure" pill, title **SADDAD · سدّد**,
  primary button **"Sign in with UAE PASS"** → opens App-ID sheet, link **"What is UAE PASS?"**,
  and two staff buttons **"Continue as an Officer" / "Continue as an Admin"**.
- App-ID sheet: input (placeholder `e.g. MSZHP_111325`) → citizen demo flow (§6). Error states
  inline.
- Officer/Admin sheet: username + password → `POST /api/auth/login`, route by role.
- Top-left language toggle (EN/AR), background glow, RTL when AR.

### B. Citizen — Home (case cards)  (web `CitizenHome`)
- Header (citizen tabs). Greeting + "New application" CTA.
- Fetch `GET /api/v1/cases/history?appId=<storedAppId>`; render one **case card per submission**
  (grouped by beneficiary; `-rN` suffixes shown). Each card: case number, status pill,
  arrears/salary, and **decision-aware actions**:
  - terminal `approved` → "View decision";
  - `rejected` + recommendation `Request Documents` → "Upload documents" (opens wizard at the
    Documents step); other `rejected` → "Re-apply";
  - `pending/queued/processing` → "View progress" (→ processing screen).
- Empty state → prompt to start the first application.

### C. Citizen — Submission wizard  (web `SubmissionForm`)
- Multi-step **Stepper**. On entry, prefill via `GET /api/v1/cases/lookup?caseNumber=<AppID>`
  (auto-load loan + identity + UAE PASS social profile, all read-only).
- Steps (typical): (1) Identity & contact (read-only), (2) Loan & financials (read-only +
  editable `reschedule_reason`, `remarks`, `months_in_arrears` if applicable),
  (3) **Documents** — if `requiredDocuments.requiresUpload`, require a PDF via `file_picker`
  (label from `requiredDocuments.label`); show the doc-type hint, (4) Review + **consent**
  checkbox → Submit.
- Submit: build **multipart** if a file is attached (field `salaryCertificate`) else JSON →
  `POST /api/v1/cases/submit`. Handle 409 (resubmission gate) with the returned reason.
- On success → go to Processing screen keyed by `data.caseId`.
- Notes: MOEI rescheduling has **no salary floor** (low salary is referred, not blocked). Only
  block non-positive numbers. Deduction-cap % helper text comes from rules.

### D. Citizen — Agent Processing (live timeline)  (web `AgentProcessing`)
- Poll `GET /api/v1/cases/{id}/status` every ~1.5–2s (stop on terminal or on dispose).
- Show queue position (if `queued`), a progress bar, and the **vertical Timeline** of
  `agentSteps` (complete/active/pending; show `resultSummary`, `durationMs`, parallel badge).
- Agent stages to expect (names from `agents/`): planner → db-fetch → financial → document →
  rules → risk-forecaster → fairness → recovery → critic → communication → escalation
  (some run in parallel; `ranInParallel=true`).
- On terminal status, render the **Decision** (see E) and a "Submitted" summary card
  (case badge, monthly payment, duration, WhatsApp-notice banner).

### E. Citizen — Decision detail  (web `CaseDecisionDetail`)
- From `decision`: outcome pill; monthly rescheduling payment, + existing installment = **total
  new monthly**; duration + computed end date; risk level, consistency score, fairness note;
  recovery guidance (EN/AR). Bilingual; speaker icons → TTS.

### F. Officer — Escalation queue  (`/officer`)
- `GET /api/officer/cases` (officer → escalated only). List of escalation cards: case id,
  applicant, arrears/salary, risk pill, priority tag (widow/orphan/senior/determination from
  UAE PASS), AI rationale (EN + AR columns), and **Approve / Reject** with an optional notes
  field → `PATCH /api/officer/cases/{caseNumber}`. Confirm + optimistic refresh.
- Officer feedback page mirrors `/officer/feedback`.

### G. Admin — Overview  (`/admin`)
- `GET /api/dashboard`: KPI cards (total/approved/rejected/escalated), queue monitor
  (queued/processing/avg time/longest wait), a **donut** (cases by status) + **bar** (by
  outcome) via `fl_chart`, recent-cases table, priority queue.

### H. Admin — Cases / Case detail  (`/admin/cases`, `/admin/cases/{id}`)
- Cases list with `?status` filter (use officer/cases as admin, or dashboard cases). Detail
  reuses `GET /api/officer/cases/{caseNumber}` (full row + agentSteps + auditLogs), shown as a
  3-panel layout on wide screens / stacked on phones, plus a **decision-trace playback** of the
  agent steps.

### I. Admin — Users  (`/admin/users`, `/admin/users/{caseNumber}`)
- Paginated, searchable applicant table (`GET /api/admin/users?page&limit&search&status`).
  Detail screen (`/api/admin/users/{caseNumber}`): identity & contact, financial summary, loan
  details, payment-history grid.

### J. Admin — Feedback & Settings  (`/admin/feedback`, `/admin/settings`)
- Feedback: summary average + cards (`GET /api/feedback`).
- Settings: **Rules** form (the 7 thresholds with their defaults; PUT on save) and **Assistant**
  custom-instruction editor per role (GET/PUT `/api/admin/settings/assistant`).

### K. AI Assistant (floating, all portals except login)  (web `AssistantWidget`)
- A floating FAB → bottom sheet chat. Role-aware: citizen/officer/admin get different tone and
  quick prompts; on a staff case-detail screen, auto-attach that `caseNumber`.
- `POST /api/assistant/chat {messages, caseNumber?, audience}` → append `reply`. Keep a
  **per-role** chat history locally. 429 → soft "please wait" message.

### L. Settings / Accessibility  (web `AccessibilitySettings`, `/settings`)
- Language EN/AR (drives RTL app-wide), font scale, word/letter spacing, dyslexia font,
  high-contrast, hide-images, and **read-aloud (TTS)** toggle. Persist via `shared_preferences`.
  Map from the web's accessibility provider.

---

## 9. Internationalization & RTL

- The web keeps **all** Arabic in `lib/i18n.ts` (`AR` map keyed by the English string); UI calls
  `t('English')`. **Port this:** copy `AR` into `strings_ar.dart`; implement `t(en) => AR[en] ?? en`.
- When locale = AR, set `Directionality(textDirection: TextDirection.rtl)` and switch the font to
  IBM Plex Sans Arabic. Many screens show **both** EN and AR (bilingual labels) — keep that.
- Use `intl` for AED currency (`AED 12,500`) and dates.

---

## 10. Android specifics

- **Permissions** (`AndroidManifest.xml`): `INTERNET`; `CAMERA` + storage/media read only if
  using camera capture for documents (PDF picker via SAF needs none).
- **App icon + splash**: `flutter_launcher_icons` + `flutter_native_splash` with the MOEI
  emblem on cream; theme-color gold.
- **Min SDK** 23+, target latest. Enable Material 3.
- **Network**: HTTPS only (no cleartext). If pointing at a local dev server for testing, add a
  scoped `network_security_config` for that host only.
- **Build**: `flutter build apk --release` (sideload) or `--release` AAB for Play. Configure
  `key.properties` + signing in `android/app/build.gradle`. Set
  `--dart-define=API_BASE_URL=https://<prod>`.
- **Optional Play distribution / push**: add Firebase (`google-services.json`) for
  `firebase_messaging` if mirroring WhatsApp notifications as push.

---

## 11. Build phases (milestones)

1. **Foundation** — project, theme/tokens, fonts, i18n+RTL, Dio+cookie jar, envelope unwrap,
   go_router with auth guard, shared widgets (Header/Footer/Card/Button/Pill/Field/Notice).
2. **Auth** — login screen + 3 modals; demo-citizen + officer/admin flows; `/me` boot restore.
3. **Citizen core** — Home/case-cards → Submission wizard (with prefill + document upload) →
   Processing timeline (polling) → Decision detail. (This is the primary public journey.)
4. **Officer** — escalation queue + case detail + approve/reject + feedback.
5. **Admin** — overview (charts) → cases/detail (trace) → users (list+detail) → feedback →
   settings (rules + assistant).
6. **Cross-cutting** — AI assistant sheet, TTS, accessibility settings.
7. **Hardening** — error/empty/loading states everywhere, 401→login, 409 gate UX, retries,
   Android icon/splash/signing, release build.

---

## 12. Definition of done

- All three portals function against the deployed API with cookie-session auth that survives
  app restart and expires gracefully (401 → login).
- Citizen can: sign in with an App ID, see case cards, submit (with PDF), watch the live agent
  timeline, and read the bilingual decision.
- Officer can: see the escalation queue and approve/reject with notes.
- Admin can: view dashboard charts, browse cases/users, edit rule thresholds, read feedback.
- AI assistant works role-aware on every screen; TTS reads EN/AR; full EN↔AR with correct RTL.
- Visual parity with the web MOEI design (colors, fonts, components per §4–§5); mobile-first,
  no layout overflow; admin tables scroll horizontally.

## 13. Open items to confirm with the product owner
- Production identity: when is **UAE PASS OIDC** available to replace the demo login?
- Should officer/admin auth move to **header tokens** (§6) or keep the cookie jar?
- Push notifications: in-app only, or Firebase push mirroring the server-side WhatsApp messages?
- Offline behavior: read-only cache of last decision, or online-only?
