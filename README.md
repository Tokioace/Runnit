# Runnit

Mobile-first sprint racing prototype built with React, TypeScript, Vite, Leaflet and Supabase.

## Local development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and provide your own development Supabase project's **public** URL and publishable/anon key:
   ```text
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-public-anon-key
   ```
   Never put a Supabase service-role key, database password or other secret in a `VITE_` variable: Vite exposes these values to browsers. Do not commit `.env.local`.
3. Start the app with `npm run dev`. Browser geolocation requires HTTPS or the special localhost secure-context exception.

## Quality checks

- `npx tsc --noEmit` — TypeScript diagnostics.
- `npm run test:gps` — repository's Node test suite (not a physical GPS validation).
- `npm run build` — production bundle compilation.

A passing build or GPS unit test does **not** establish reliable sprint timing on an actual device. See `docs/gps-field-validation.md` for experimental field-testing limitations.

## Supabase schema and security

**Do not execute `supabase/schema.sql` or `supabase/duel_functions.sql` against an existing Runnit database.** They are legacy bootstrap files and may restore obsolete, overly permissive policies/functions. The versioned SQL in `supabase/migrations/` and `docs/supabase-privacy-hardening.md` describe the current privacy hardening. Review migrations in order and test against a disposable development project before applying anything; this README does not authorize production database changes.

The Supabase anon/publishable key is not an authorization boundary. Database RLS, grants and RPC permissions must enforce access independently of client-side login screens. Never publish real user locations or credentials in issues, logs or test fixtures.

## Authentication and preview configuration

For passwordless e-mail authentication, the correct Supabase Authentication → URL Configuration and e-mail templates must be configured for the **exact** deployed preview origin and `/auth/callback` route. See `docs/email-login-callback-setup.md`. A six-digit e-mail OTP requires the template to include `{{ .Token }}`; the confirmation link uses `{{ .ConfirmationURL }}`. Do not paste live OTPs or magic links into tickets.

The `main` branch is reserved for user-approved releases. Development PRs target `develop` and require independent CI/security checks before integration.
