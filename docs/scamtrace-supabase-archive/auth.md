# Auth preservation

## What ScamTrace actually uses

ScamTrace ops access is **not** Supabase Auth.

| Layer | Mechanism | Source |
|-------|-----------|--------|
| Login | Shared password compared server-side | `CONSOLE_PASSWORD` or fallback `ScamTrace_Engine_Key` |
| Session | HMAC-signed cookie `scamtrace_session` (7-day TTL) | `utils/consoleAuth.js` |
| Signing secret | `THREAT_SYNC_SECRET` → `CRON_SECRET` → password fallbacks | Same |
| Cron | `Authorization: Bearer <CRON_SECRET\|THREAT_SYNC_SECRET>` | `isCronAuthorized` |
| API gate | Cookie or Bearer session on console routes | `isConsoleAuthorized` |

Routes:

- `POST /api/auth/login` — `api/auth/login.js`
- `POST /api/auth/logout` — `api/auth/logout.js`
- `GET /api/auth/me` — `api/auth/me.js`
- UI: `/login` → `login.html`, `/console` → `console/index.html`

There are **no** end-user profiles tables tied to `auth.users` for the ops console.

---

## Supabase Auth (platform defaults)

The hosted project still has the standard `auth` schema (e.g. `auth.users`, `audit_log_entries`). The application **does not**:

- Call `signIn` / OAuth against Supabase
- Use Supabase redirect/callback URLs for login
- Depend on JWT `authenticated` role for threat tables (those are service-role only)

### OAuth providers

**None configured for ScamTrace app flows.** Reconstructing the product does not require Google/GitHub/etc. provider setup unless you later adopt Supabase Auth.

### Redirect / callback URLs

App redirects are **Vercel** routes only (`/login`, `/console`). No Supabase Auth callback URLs are required for current behavior.

### Email / magic-link / MFA

Not used by ScamTrace.

### Roles / custom claims

Console session payload embeds `{ role: "console", exp }` inside the HMAC token — **application-level**, not Supabase JWT custom claims.

---

## RLS dependencies

| Area | Auth implication |
|------|------------------|
| Legacy tables (`scam_reports`, …) | Permissive `"Allow all"` policies — historically open; **do not rely on this for public internet exposure** |
| Threat tables | RLS on, no anon policies — **requires service role** from trusted servers |
| Ops console | Authorization is Vercel cookie; APIs then use service role to read/write |

Rebuilding auth for the console = restore Vercel env secrets + `utils/consoleAuth.js`. It is **independent** of restoring `auth.users`.

---

## Cannot be reconstructed from repo + DB dump alone

| Item | Why |
|------|-----|
| Console password / cron / HMAC secrets | Only in Vercel / local `.env` (rotate on restore) |
| Supabase service role / anon / JWT secret | Dashboard-issued; dump does not include platform JWT secret |
| Database password | Dashboard; needed for `pg_dump` / `psql` |
| Any future Supabase Auth users’ passwords | Hashed in `auth.users`; never export plaintext (and unused today) |
| Provider OAuth client secrets | N/A today; if added later, live only in provider + Supabase dashboard |

---

## Minimal auth restore checklist

1. Deploy Vercel app from repo.
2. Set `CONSOLE_PASSWORD`, `CRON_SECRET`, `THREAT_SYNC_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Confirm `/login` → `/console` cookie flow.
4. Optionally leave Supabase Auth providers disabled.
