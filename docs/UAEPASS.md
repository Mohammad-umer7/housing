# SADDAD — UAE PASS Integration Spec

UAE PASS is the UAE federal digital identity and the **only acceptable production login** for a citizen-facing federal service (the official MOEI "Housing Arrears Assistance Scheduling Request" service logs in via UAE PASS — see the user manual). This document is the integration spec to replace SADDAD's demo username/password with UAE PASS.

It is **standard OpenID Connect (OAuth 2.0 authorization-code flow)**, and there is a **public staging sandbox** you can integrate against now, before any formal onboarding.

> Status: **spec only** — not yet wired into the code. The session layer in [`lib/auth/session.ts`](../lib/auth/session.ts) is designed so UAE PASS replaces only the *credential check*; everything downstream (HMAC cookie, `requireAuth`) stays unchanged.

---

## 1. Endpoints

| | Staging | Production |
|---|---|---|
| Base | `https://stg-id.uaepass.ae/idshub` | `https://id.uaepass.ae/idshub` |
| Authorize | `…/authorize` | `…/authorize` |
| Token | `…/token` | `…/token` |
| UserInfo | `…/userinfo` | `…/userinfo` |
| Logout | `…/logout` | `…/logout` |

**Staging credentials (public sandbox):** `client_id = sandbox_stage`, `client_secret = sandbox_stage`, typical registered `redirect_uri = https://localhost:8000`. A staging test user is created via the UAE PASS staging portal.

**Production:** real `client_id`/`client_secret` + registered `redirect_uri` are issued through official UAE PASS / TDRA onboarding (an agreement + entity process, not a code step).

---

## 2. The flow (authorization-code)

```
 Browser                     SADDAD (server)                 UAE PASS
   │  GET /api/auth/uaepass/login                              │
   │ ───────────────────────────►                             │
   │            302 redirect to /authorize?…&state=…          │
   │ ◄───────────────────────────                             │
   │  ───────────────────────────────────────────────────────►  (user authenticates)
   │ ◄───────────────────────────────────────────────────────   302 → redirect_uri?code=…&state=…
   │  GET /api/auth/uaepass/callback?code=…&state=…           │
   │ ───────────────────────────►                             │
   │                    POST /token (Basic auth, code) ───────►
   │                    ◄─────────── { access_token }         │
   │                    GET /userinfo (Bearer) ───────────────►
   │                    ◄─────────── { idn, fullnameEN, … }   │
   │     Set HMAC session cookie (signSession) + 302 home     │
   │ ◄───────────────────────────                             │
```

### Step 1 — Authorize (redirect the browser)
```
GET {base}/authorize
  ?response_type=code
  &client_id={UAEPASS_CLIENT_ID}
  &scope=urn:uae:digitalid:profile:general
  &state={random-csrf-token}              ← store server-side / in a short-lived cookie
  &redirect_uri={UAEPASS_REDIRECT_URI}    ← must be pre-registered with UAE PASS
  &acr_values=urn:safelayer:tws:policies:authentication:level:low
```
- **Web browser** login: `acr_values=urn:safelayer:tws:policies:authentication:level:low`
- **UAE PASS mobile app** (app-to-app, app installed): `acr_values=urn:digitalid:authentication:flow:mobileondevice`
- Scopes: `urn:uae:digitalid:profile:general` (also `…:general:profileType`, `…:general:unifiedId`).

### Step 2 — Token exchange (server-side only)
```
POST {base}/token
  Authorization: Basic base64("{client_id}:{client_secret}")
  Content-Type: multipart/form-data         # per UAE PASS docs (not x-www-form-urlencoded)
  body:
    grant_type=authorization_code
    redirect_uri={UAEPASS_REDIRECT_URI}     # MUST match step 1 exactly
    code={authorization_code}
```
Response: `{ access_token, token_type: "Bearer", expires_in: 3600, scope }`.

⚠️ **The authorization `code` is single-use and short-lived** (UAE PASS docs recommend exchanging within ~10 seconds; max ~10 min). Exchange it immediately, on the server. Never do the token exchange from the browser (the `client_secret` must never reach the client).

### Step 3 — UserInfo
```
GET {base}/userinfo
  Authorization: Bearer {access_token}
```
Returns:
```
sub, uuid, spuuid, userType, idType, idn,
firstnameEN, firstnameAR, lastnameEN, lastnameAR,
fullnameEN, fullnameAR, nationalityEN, nationalityAR,
gender, email, mobile, titleEN, titleAR, acr, amr
```

### Logout
```
GET {base}/logout?redirect_uri={url}
```
Clear the SADDAD session cookie **and** redirect through this so the user is logged out of UAE PASS too.

---

## 3. Identity assurance — which users to accept

`userType` is the assurance level:

| userType | Verified? | Decision for SADDAD |
|---|---|---|
| **SOP1** | email + mobile (OTP) only; **Emirates ID not verified** | **reject** — not identity-assured |
| **SOP2** | Emirates ID verified | accept |
| **SOP3** | Emirates ID verified via biometrics | accept |

For a financial/housing service, require **SOP2 or SOP3**.

---

## 4. How it maps into this codebase

**New routes (replace the demo login):**
- `GET /api/auth/uaepass/login` — generate `state`, store it (signed short-lived cookie), build the authorize URL, `302` to UAE PASS.
- `GET /api/auth/uaepass/callback` — verify `state`, POST `/token` (Basic auth, server-side), GET `/userinfo`, check `userType ∈ {SOP2, SOP3}`, then **reuse [`signSession()`](../lib/auth/session.ts)** to mint the existing HMAC cookie. Nothing downstream changes — `requireAuth` keeps working as-is.

**[`proxy.ts`](../proxy.ts):** add `/api/auth/uaepass/login` and `/api/auth/uaepass/callback` to `PUBLIC_PATHS`.

**Env vars:**
```
UAEPASS_BASE_URL=https://stg-id.uaepass.ae/idshub
UAEPASS_CLIENT_ID=sandbox_stage
UAEPASS_CLIENT_SECRET=sandbox_stage
UAEPASS_REDIRECT_URI=https://localhost:3000/api/auth/uaepass/callback
```

**The payoff (matches the official manual flow):** `userinfo.idn` is the **Emirates ID**. Feed it to the consumed-data port [`lib/integrations/source-systems.ts`](../lib/integrations/source-systems.ts) (`getApplicant` / `getLoanDetails`) to auto-fetch the beneficiary's loan. The citizen then only confirms salary — exactly as the real service works. Identity comes from UAE PASS, loan from the servicer; the user types neither.

**Role mapping:** UAE PASS = the **citizen / beneficiary** identity. Officers can stay on the existing internal session, or be allow-listed by `idn`.

---

## 5. Security checklist

- `state` parameter on every request; verify on callback (CSRF protection).
- Token exchange and `client_secret` **server-side only** — never in the browser bundle.
- `redirect_uri` must exactly match the value registered with UAE PASS; HTTPS in production.
- Validate `userType` (SOP2/SOP3) before issuing a session.
- Exchange the `code` immediately (single-use, short TTL).
- On logout, redirect through the UAE PASS `/logout` endpoint.
- Production secrets in a vault (see [`SECURITY.md`](SECURITY.md)), rotated.

---

## 6. Demo vs production

- **Demo now:** the `sandbox_stage` staging client lets you show a real UAE PASS login end-to-end without onboarding (subject to the registered staging `redirect_uri`).
- **Production:** official UAE PASS onboarding for real credentials + registered redirect URIs; switch `UAEPASS_BASE_URL` to `https://id.uaepass.ae/idshub`. Per [`PILOT_PLAN.md`](PILOT_PLAN.md) this is a Phase-1 deliverable.

---

*Sourced from the official UAE PASS developer documentation ([docs.uaepass.ae](https://docs.uaepass.ae)).*
