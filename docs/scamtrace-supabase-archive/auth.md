# Auth preservation

## What ScamTrace actually uses

ScamTrace ops access is **not** Supabase Auth.

| Layer | Mechanism | Source |
|-------|-----------|--------|
| Login | Shared password compared server-side | **`CONSOLE_PASSWORD` only** |
| Session | HMAC-signed cookie `scamtrace_session` (7-day TTL) | **`THREAT_SYNC_SECRET` only** |
| Cron | `Authorization: Bearer <CRON_SECRET>` | **`CRON_SECRET` only** |
| AI | Groq advisory analysis | **`GROQ_API_KEY` only** |

Routes:

- `POST /api/auth/login` — `api/auth/login.js`
- `POST /api/auth/logout` — `api/auth/logout.js`
- `GET /api/auth/me` — `api/auth/me.js`
- UI: `/login` → `login.html`, `/console` → `console/index.html`

There are **no** end-user profiles tables tied to `auth.users` for the ops console.

### Hard separation (no silent cross-fallbacks)

| Variable | May authenticate | Must not |
|----------|------------------|----------|
| `CONSOLE_PASSWORD` | Console login | Sign cookies, authorize cron, call Groq |
| `THREAT_SYNC_SECRET` | Session HMAC | Login password, cron bearer, Groq |
| `CRON_SECRET` | Cron / ingest bearer | Session HMAC, login, Groq |
| `GROQ_API_KEY` | Groq LLM | Login, HMAC, cron |
| `ScamTrace_Engine_Key` | **Deprecated — unused by runtime** | — |

Missing required secrets for an operation **fail closed** (login 503 / verify null / cron unauthorized).

---

## Supabase Auth (platform defaults)

The hosted project still has the standard `auth` schema (e.g. `auth.users`, `audit_log_entries`). The application **does not**:

- Call `signIn` / OAuth against Supabase
- Use Supabase redirect/callback URLs for login
- Depend on JWT `authenticated` role for threat tables (those are service-role only)

### OAuth providers

**None configured for ScamTrace app flows.**

### Redirect / callback URLs

App redirects are **Vercel** routes only (`/login`, `/console`).

### Email / magic-link / MFA

Not used by ScamTrace.

### Roles / custom claims

Console session payload embeds `{ role: "console", exp }` inside the HMAC token — **application-level**, not Supabase JWT custom claims.

---

## RLS dependencies

| Area | Auth implication |
|------|------------------|
| Legacy tables (`scam_reports`, …) | Permissive `"Allow all"` policies — historical; **do not rely on this for public internet exposure** |
| Threat tables | RLS on, no anon policies — **requires service role** from trusted servers |
| Ops console | Authorization is Vercel cookie; APIs then use service role to read/write |

---

## Cannot be reconstructed from repo + DB dump alone

| Item | Why |
|------|-----|
| Console password / cron / HMAC secrets | Only in Vercel / local `.env` (rotate on restore) |
| Supabase service role / anon / JWT secret | Dashboard-issued |
| Database password | Dashboard |
| Groq API key | Provider dashboard |

---

## Minimal auth restore checklist

1. Deploy Vercel app from repo.
2. Set **distinct** `CONSOLE_PASSWORD`, `THREAT_SYNC_SECRET`, `CRON_SECRET`, plus `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Confirm `/login` → `/console` cookie flow.
4. Optionally leave Supabase Auth providers disabled.
