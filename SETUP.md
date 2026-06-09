# SADDAD — Housing Arrears AI Agent — Setup Guide

## Quick Start

### 1. Supabase Setup
1. Go to [supabase.com](https://supabase.com) → New project
2. In SQL Editor, run the contents of `supabase-setup.sql`
3. Copy your **Project URL** and **service role key** from Settings → API

### 2. Groq API Key
1. Go to [console.groq.com](https://console.groq.com) → API Keys → Create
2. Copy the key

### 3. Twilio (WhatsApp notifications)
1. Go to [console.twilio.com](https://console.twilio.com)
2. Messaging → Try it out → Send a WhatsApp message
3. Copy: Account SID, Auth Token, WhatsApp From number

### 4. Environment Variables
Create `.env.local` with your credentials:
```
GROQ_API_KEY=gsk_...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# API authentication keys — generate strong random strings
API_KEY_ADMIN=<strong-random-key>
API_KEY_OFFICER=<strong-random-key>
API_KEY_READONLY=<strong-random-key>
NEXT_PUBLIC_API_KEY_ADMIN=<same-value-as-API_KEY_ADMIN>
```

### 5. Populate Applicants
Pre-load the `applicants` table in Supabase with real case data from the MOEI system before officers begin using the submission form. Each case must have a unique `case_number` and complete loan details.

### 6. Run
```bash
npm run dev
```
Open http://localhost:3000

## Officer Workflow
1. Go to **Submit** tab
2. Enter a case number from the MOEI system → loan details auto-populate from the database
3. Fill in applicant details, reschedule reason, months in arrears
4. Upload the salary certificate PDF
5. Accept the 20% deduction consent
6. Click **Submit to SADDAD AI**
7. Watch all 8 agents run live on the **Processing** screen
8. Decision is delivered with bilingual AI rationale

## Deploy to Vercel
```bash
npx vercel
# Add all environment variables in the Vercel dashboard
```
