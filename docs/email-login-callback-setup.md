# Runnit email login: avoid localhost callbacks and cross-browser Magic Links

## Observed failure (November 2026)
A user requested a one-time email link on an iPhone, but opening the message
sent them into Microsoft Edge and then to `localhost:3000`.
`localhost` addresses the phone itself rather than the deployed Runnit app.

The Runnit frontend already sends `emailRedirectTo` with the current HTTPS
origin and the `/auth/callback` path to Supabase. **This alone cannot override
a Supabase Auth Site URL, redirect allowlist, or custom email template.**

## Required Supabase dashboard setup (do not put passwords or keys in chat)

Open:
https://supabase.com/dashboard/project/fcbffqcmvgdojsdfwgyt/auth/url-configuration

For the currently released *develop* beta set:
- Site URL:
  `https://runnit-git-develop-tokioaces-projects.vercel.app`
- Additional Redirect URL:
  `https://runnit-git-develop-tokioaces-projects.vercel.app/auth/callback`

When testing another Vercel deployment, either add its exact
`https://<verified-host>/auth/callback` URL to the allowlist, or return to the
stable *develop* beta. Do not allow arbitrary `*.vercel.app` hosts. When the
production app is released, switch Site URL to the verified production domain.

### Magic Link template
In **Authentication → Email Templates → Magic Link**, preserve the
Supabase-managed `{{ .ConfirmationURL }}` in the link. A custom template that
links directly to `{{ .SiteURL }}` can ignore the requested redirect or bypass
token verification.

For **same-browser verification**, include the six-digit `{{ .Token }}`
in the email alongside the Magic Link. Example template body:

```html
<h2>Deine Runnit-Anmeldung</h2>
<p>Dein sechsstelliger Code: <strong>{{ .Token }}</strong></p>
<p>Gib ihn direkt in Runnit ein, ohne deinen Browser zu wechseln.</p>
<p>Oder nutze <a href="{{ .ConfirmationURL }}">den Anmeldelink</a>.</p>
```

After saving, request a **new** email from Runnit. Old Magic Links are
single-use and may carry an obsolete redirect.
Never forward an actual emailed one-time login URL, access token or code to
support channels or GitHub issues.

### Browser switching on iPhone
The six-digit code can be typed into Runnit in Safari even if the user's
email client opens clicked links in Microsoft Edge. Alternatively, change
the system default in iOS **Settings → Apps → Default Apps → Browser App →
Safari**. Some email clients also offer their own link-opening preference.

## Frontend changes
- `useSupabaseUser.verifyEmailOtp` calls Supabase `verifyOtp({ email, token,
  type: 'email' })` with validated six-digit input.
- Once an email is requested, the Runnit UI offers a code input on the same
  page. It is clearly conditional: a code is available only if the Supabase
  email template actually includes it.
- The existing one-time link, password login, and OAuth flows remain.
- Neither codes nor login links are logged or stored in a custom data store.

## Verification
1. In Safari open the stable *develop* beta URL above.
2. Request email login, inspect the received mail privately.
3. Check the link's final host is the approved Runnit app, not localhost.
4. If the email contains a six-digit code, type it into the original
   Runnit Safari tab and verify that the session opens.
5. Test sign-out, re-login, session restore, and failed/expired code.
6. Do not claim full end-to-end success until these are tested against
   real Supabase Auth and the currently deployed frontend.
