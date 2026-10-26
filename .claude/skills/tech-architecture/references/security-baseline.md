# Security baseline reference

Read when writing the threat model, the security baseline decisions, a layer guide, or a security acceptance criterion. It is a checklist of questions in plain words, not a standard. The standard is **OWASP ASVS 5.0**: read the official document (github.com/OWASP/ASVS, or owasp.org) for the exact requirement IDs and wording of the chosen level; do not quote requirement IDs from memory.

## Choosing the ASVS level

| Level | Use when |
| --- | --- |
| 1 | default for most products; low-risk data |
| 2 | the product stores personal data of other people, has accounts with private content, or handles money indirectly |
| 3 | payments, health or other special-category data, critical infrastructure; plan a professional audit as well |

## Questions per area

**Authentication**
- Is sign-in delegated to a proven library or provider? Home-made password, token or crypto code is a finding.
- Are passwords hashed with a modern, slow algorithm (or never stored by us)?
- Brute force: rate limiting or lockout on sign-in, password reset and verification codes.
- Password reset and email change: tokens single-use, short-lived, not guessable; no account enumeration through messages or timing.

**Sessions and tokens**
- Web: cookies `HttpOnly`, `Secure`, `SameSite`; or tokens never in `localStorage` when avoidable.
- Mobile: tokens only in the platform's secure storage (Keychain, Keystore-backed storage), never in plain app storage or logs.
- Logout and password change invalidate sessions; tokens expire; refresh tokens rotate.

**Authorisation (the most common serious flaw)**
- Every request that touches an object checks that **this** user may access **this** object, on the server. Never trust IDs, roles or flags from the client.
- Deny by default; one place (or one pattern) for checks, not ad hoc conditions.
- Negative tests: another user, an anonymous user and a lower role all get refused, for read, update, delete and list (lists must not leak other users' items).

**Input and output**
- Validate input on the server (type, length, range, format); reject, don't fix up.
- Parameterised queries or the ORM's safe API only; no string-built SQL.
- Output encoding by the framework; any raw HTML rendering is reviewed.
- File uploads: type and size limits, stored outside the web root, served with safe content types.
- Server-side requests to user-supplied URLs (SSRF): avoided or restricted to an allow-list.

**Data protection**
- Personal data only where the data model says; retention and deletion work.
- HTTPS everywhere; HSTS on web.
- No personal data or secrets in logs, URLs, analytics events or error messages.
- Backups encrypted and access-restricted.

**Web hardening**
- Security headers (Content-Security-Policy, X-Content-Type-Options, frame protection, Referrer-Policy).
- CORS: explicit allowed origins, never `*` with credentials.
- CSRF protection where cookies authenticate.

**Mobile hardening**
- No secrets in the app bundle (anything in the app is public).
- Deep links and intents validated like any other input.
- Release builds without debug flags or verbose logging.

**Abuse and availability**
- Rate limits on expensive or abusable endpoints (sign-up, invitations, search, uploads).
- Invitations and sharing cannot be used to spam or to enumerate users.
- Pagination limits on list endpoints.

**Supply chain and secrets**
- Dependencies scanned in CI with a blocking threshold; lockfiles committed.
- Secrets never in the repository; secret scanning in CI; local `.env` files ignored by git.

**Logging and response**
- Security-relevant events (sign-in, failed sign-in, permission denied, password change, admin actions) are logged without personal data beyond an ID.
- A `SECURITY.md` says how to report a vulnerability.

## Writing security acceptance criteria

Make them negative and testable, at a public seam:

- "Given user B, when B requests list L owned by user A, then the API returns 404 (or 403) and no data of L." — verified by an integration test.
- "Given 10 failed sign-in attempts within a minute from one IP, when another attempt arrives, then it is rejected with 429." — verified by an integration test.

Every threat with `Covered by: task` needs at least one such criterion in the task that lists it.
