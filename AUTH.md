# Authentication & roles — what changed and how to set it up

## Who signs in where

| Who | Signs in at | Role | Can do |
|---|---|---|---|
| Super admin | `/admin/login` | `superadmin` | Everything admins can, plus **Users & staff** (create staff, change roles, disable/enable any account, sign anyone out, set passwords), **Shopper accounts** (all stores), **Audit log**, change any store's plan |
| Admin | `/admin/login` | `admin` | Overview, stores (suspend/restore), KYC, templates, plugin review, plans (read-only) |
| Merchant | `/login` | `merchant` | `/dashboard` (unchanged) |
| Shopper | `<store>/account/login` | per-store account | Own orders, details, password; checkout is pre-filled |

Staff cannot sign in on `/login`, and merchants cannot sign in on `/admin/login`.

## How the tokens work (JWT)

* Every sign-in creates a **server-side session** in MongoDB (`sessions` collection) and a **JWT** (HS256, `iss=ind2b`) that names it (`sid` = `jti`).
* Platform tokens use `aud=ind2b:platform`. A shopper's token uses `aud=ind2b:customer:<storeId>`, so a token from one store is rejected on every other store and can never be used as a merchant or staff token.
* The proxy checks the signature; every page, Server Action and API route then checks the database, so sign-out, password change, disabling an account or a role change take effect **immediately**.
* Staff sessions end after **2 hours idle** (max 12 h); merchants 12 h; shoppers 30 days.
* Cookies are `httpOnly`, `SameSite=Lax`, and in production `__Host-` + `Secure`.
* Rotate the signing key without signing everyone out: move the old value to `SESSION_SECRET_PREVIOUS`, put the new one in `SESSION_SECRET`, remove the old one after a session lifetime.

### API access (Bearer tokens)

```bash
# get a token
curl -X POST https://ind2b.com/api/auth/token -H 'content-type: application/json' \
     -d '{"email":"owner@yourco.in","password":"…"}'
# → { "token": "eyJ…", "tokenType": "Bearer", "expiresIn": 43200, "user": {…} }

curl https://ind2b.com/api/auth/me -H "authorization: Bearer eyJ…"     # who am I
curl -X DELETE https://ind2b.com/api/auth/token -H "authorization: Bearer eyJ…"   # revoke
```
`/api/uploads` and `/api/kyc` also accept the Bearer token. Each token is listed under "Signed-in devices".

## Email verification and "Forgot password"

* **Sign-up needs a verified email** (store owners on `/signup`, shoppers on `<store>/account/register`):
  1. details + password → a 6-digit code is emailed (the account does **not** exist yet; the password is kept only as a bcrypt hash)
  2. the code → the account is created (`emailVerifiedAt` set), the user is signed in, a welcome email is sent
* **Forgot password**: `/forgot-password` (merchants), `/admin/forgot-password` (admins, super admins; audited), `<store>/account/forgot-password` (shoppers).
  Email → code → new password. The answer is identical whether or not the email is registered. A reset signs out every device and sends a "password changed" email.
* **Codes**: 6 digits, valid 10 minutes, single use, only an HMAC is stored; 5 wrong tries per code; 1 email/minute and 5/hour per address; IP limits on top. A new code cancels the old one. Codes are separate per store.
* **Templates** (`src/lib/email/templates.ts`): verification code, reset code, password changed, welcome. Platform emails use IND2B branding; shopper emails use the store's name, theme colours and logo.
* **Provider** (`src/lib/email/index.ts`, nodemailer): `EMAIL_PROVIDER=gmail` + `EMAIL_USER` + `EMAIL_APP_PASSWORD` (a Google App Password; spaces are fine). Without a provider in development, emails and codes are printed in the server log.
  Check your settings: `npm run email:test -- --to you@example.com`

## Setup

1. Copy `.env.example` to `.env.local` and fill in:
   * `MONGODB_URI` (empty in development: `npm run dev` starts a local MongoDB)
   * `SESSION_SECRET` (32+ random characters; **required in production**)
   * `CLOUDINARY_URL` (Cloudinary console → Settings → API Keys → "API environment variable"). **Required in production** unless `ALLOW_LOCAL_UPLOADS=true`.
   * `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` (12+ chars, upper + lower case, digit, symbol). The super admin is created on start-up.
2. Or create / recover a super admin from the terminal: `npm run superadmin` (add to package.json: `"superadmin": "node scripts/create-superadmin.mjs"`).
3. KYC documents stay **private in MongoDB (GridFS)** on purpose; Cloudinary URLs are public, so only images go there.

## Demo accounts (development data only)

| | Email | Password |
|---|---|---|
| Super admin | root@ind2b.com | Super@Admin2026 |
| Admin | neha@ind2b.com | Admin@1234 |
| Merchant | priya@example.in | Demo@1234 |
| Shopper (Priya Handlooms) | meera@example.in | Shop@1234 |

Demo data is only added to an **empty** database. With an existing dev database, run `npm run db:reset`, or set `SUPERADMIN_*`.

## Notes when upgrading an existing deployment

* Everyone is signed out once (tokens now carry issuer/audience). Existing users, stores and orders are untouched.
* Existing users have no `status` field yet; they are treated as `active`.
* Existing admin accounts stay `admin`. Create the first super admin with `SUPERADMIN_*` or `npm run superadmin`.
* New dependency: `nodemailer` (and `@types/nodemailer` for development) — run `npm install`.
* Existing accounts keep working; email verification applies to new sign-ups only.
