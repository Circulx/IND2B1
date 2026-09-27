# IND2B — store builder for Indian businesses

Anyone signs up on **ind2b.com**, picks a store name and a template, and gets a
complete online store at **name.ind2b.com** (or their own domain). They add
products, customise the design in a page builder, install plugins and sell with
UPI/cards (Razorpay) or cash on delivery, with GST worked out automatically.

One Next.js app serves everything, backed by **MongoDB**:

| URL | What | Code |
|---|---|---|
| `/` `/templates` `/plugins` `/pricing` | Platform site | `src/app/(site)` |
| `/signup` `/login` `/start` | Sign up, log in, create-a-store wizard | `src/app/(auth)`, `src/app/start` |
| `/dashboard/…` | Store owner dashboard + page builder | `src/app/dashboard` |
| `/admin/…` | IND2B team: stores, KYC, plugin review, plans, audit log | `src/app/admin` |
| `/store/<slug>/…` and `<slug>.ind2b.com` | Each merchant's storefront | `src/app/store/[store]` |

## Run it (one command)

Requirements: **Node.js 20.19+** (22 recommended).

```bash
npm install
npm run dev
```

Open **http://localhost:3000**.

`npm run dev` checks for `MONGODB_URI`:

- **Not set:** it starts a local MongoDB for you, with data kept in `./.mongo-data`. The first run downloads MongoDB once (about 70 MB).
- **Set** (in `.env.local` or your shell): it uses that server. This works with local MongoDB or MongoDB Atlas.

The first request seeds demo data into an empty database.

### Demo logins (listed on /login in development)

| Role | Email | Password |
|---|---|---|
| Store owner (Priya Handlooms + Shreeji Steel Tubes) | priya@example.in | Demo@1234 |
| IND2B admin | neha@ind2b.com | Admin@1234 |

Or click **Start free** to sign up and create your own store.

### Demo stores

- http://localhost:3000/store/priyahandlooms: fashion, Vastra template.
- http://localhost:3000/store/shreejisteel: B2B, Udyog template with the B2B Wholesale plugin.
- http://localhost:3000/store/kiranfresh: grocery, Kirana template.
- http://priyahandlooms.localhost:3000: the same store on a subdomain, as in production.

## MongoDB: connection and authentication

```bash
cp .env.example .env.local
# edit .env.local, then `npm run dev`
MONGODB_URI=mongodb://ind2b_app:STRONG_PASSWORD@127.0.0.1:27017/?authSource=ind2b        # your own server
MONGODB_URI=mongodb+srv://ind2b_app:STRONG_PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority   # Atlas
MONGODB_DB=ind2b
```

**Production checklist**

- **Access control:** turn it on and connect with a dedicated user that has `readWrite` on the `ind2b` database only, never the root user. `docker-compose.yml` does this for you with `scripts/mongo-init.js`.
- **Atlas:** TLS is on by default. Set the Network Access list to your server IPs, not `0.0.0.0/0`.
- **Self-hosted:** enable TLS and don't expose port 27017 to the internet.
- **Backups:** turn on backups (Atlas continuous backup, or `mongodump` on a schedule).
- **Indexes:** they are created at startup. The unique ones (emails, store addresses, order numbers, subscribers) are part of the security model. Set `MONGO_AUTO_INDEX=false` only if you build them yourself.

**Collections** (Mongoose models in `src/lib/db/models`)

| Collection | Holds |
|---|---|
| `users` | Store owners and admins; bcrypt password hashes (cost 12) |
| `sessions` | One per signed-in device; deleting it signs that device out; expires automatically (TTL) |
| `stores` | Name, address, plan, status, settings, logo, installed plugins, theme and draft, KYC status + document list |
| `products` | Variants with stock, GST/HSN, bulk tiers, images (ids + URLs from `media`) |
| `media` | Every uploaded image: store, provider, URL, size |
| `kycdocs.files`, `kycdocs.chunks` | KYC documents, stored privately in MongoDB (GridFS) |
| `orders` | Lines (with image), totals, GST, payment, status, checkout token (no double orders) |
| `discounts` | Discount codes |
| `quoterequests` | B2B quote requests |
| `subscribers` | Newsletter sign-ups |
| `counters` | Order numbers |
| `appreviews` | Plugin review decisions |
| `auditlogs` | Every admin action and KYC download |
| `ratelimits` | Rate-limit counters (expire automatically) |
| `metas` | One-time setup markers |

`npm run db:reset` wipes the data. With `SEED_DEMO_DATA=true`, demo data is seeded again on the next request; it is off by default in production.

## Images: Cloudinary (recommended) or local disk

**Recommended service: [Cloudinary](https://cloudinary.com).**

- **Free tier:** enough to launch.
- **Delivery:** global CDN with Indian edge locations. It serves WebP/AVIF automatically per browser (`f_auto,q_auto`) and resizes on the fly.
- **Security:** uploads are signed on the server, so the API secret never reaches the browser.

**Alternatives** (swap the provider in `src/lib/media/storage.ts`; everything else stays the same):

- ImageKit.io: an Indian company with a generous free tier.
- AWS S3 + CloudFront, in the Mumbai region.

**Set up Cloudinary:** sign up, open *Settings → API Keys*, and add the keys to `.env.local`:

```bash
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=your-secret
CLOUDINARY_FOLDER=ind2b
```

Without these, images are saved on the server's disk in `UPLOAD_DIR` (default `./.uploads`) and served from `/media/…`. That's fine for development or a single server with a persistent disk (Docker uses a volume).

**How an upload works**

1. The browser sends the file to `POST /api/uploads`. The route is for signed-in store owners only, checks the request is same-origin, is rate-limited, and caps files at 8 MB.
2. The server **decodes the image** with sharp. Anything that isn't a real JPG/PNG/WebP/AVIF/GIF/HEIC is rejected, including renamed files and SVG. Decompression bombs are also blocked.
3. The server re-encodes the image to WebP (resized to at most 2000 px) and strips EXIF data such as GPS location.
4. The file is stored in Cloudinary or on disk, and a `media` document records it for that store.
5. Forms send only image **ids**. The server looks up the URLs itself and ignores ids from other stores.
6. Images a product, the logo or the theme no longer uses are deleted automatically when you save.

**Where images are used:**

- Product photos: up to 10 per product, with order and alt text.
- Store logo.
- Hero and image-with-text sections in the page builder.
- Product cards, product pages, cart and order lines.

**KYC documents** (PAN, bank proof, GST certificate):

- Accepted as PDF, JPG or PNG up to 5 MB. The type is checked from the file content, not the file name.
- Stored in MongoDB GridFS with **no public URL**.
- Downloaded only through `/api/kyc/:id` by the store's owner or an IND2B admin. Admin downloads are written to the audit log.

## Project structure

```
src/
  proxy.ts                 host → store routing (subdomains, custom domains) + access control
  app/                     routes (pages, layouts, route handlers)
    (site)/                platform site
    (auth)/                login, signup
    start/                 create-a-store wizard
    dashboard/(shell)/     orders, products, customers, quote requests, discounts, analytics, online store,
                           plugins, settings (logo, KYC documents, plan), account & security
    dashboard/editor/      page builder (full screen)
    admin/(console)/       overview (DB health, audit log), stores, KYC with documents, templates, plugin review, plans, account
    store/[store]/         storefront: home, collections, product, cart, checkout, order confirmation, form APIs
    api/uploads/           image upload (POST) and delete (DELETE /api/uploads/:id)
    api/kyc/               private KYC document upload and download
    media/[...key]/        serves locally stored images
    logout/                sign-out route (revokes the server-side session)
  actions/                 Server Actions (all validate input with zod and re-check the session)
    auth.ts account.ts start.ts dashboard.ts page-builder.ts store-switch.ts admin.ts storefront.ts
  components/
    ui/                    design system: buttons, cards, tables, forms, app shell, icons, charts
    sections/              storefront sections, used by live stores AND the page-builder preview
    dashboard/image-upload.tsx   photo uploader (multi, reorder, alt text) and single-image picker
    site/ dashboard/ admin/ storefront/   feature components
  lib/
    env.ts                 validated configuration (fails fast in production)
    security.ts            rate limiting, same-origin checks, client IP
    media/                 image processing (sharp), storage (Cloudinary / local), media records
    kyc.ts                 private KYC documents in GridFS
    db/connect.ts          cached, authenticated Mongoose connection (+ optional demo seed)
    db/models/             Mongoose schemas and indexes
    db/seed.ts             demo data
    services/              all data access (stores, products, orders, themes, plugins, users, sessions, leads, analytics)
    auth/                  session cookie (jose) + server-side session checks, role checks
    catalog.ts             templates, plugins, plans
    pricing.ts             GST (CGST+SGST / IGST), tier prices, discounts, shipping
    merchant.ts admin.ts storefront.ts audit.ts types.ts format.ts
scripts/
  dev.mjs                  `npm run dev`: starts local MongoDB if needed, then Next.js
  reset-db.mjs             `npm run db:reset`
  mongo-init.js            creates the least-privilege MongoDB user (Docker)
```

## How it works

- **Templates = design tokens + sections.**
  - Creating a store copies the chosen template into `stores.theme`.
  - The page builder edits `stores.draftTheme`. You can add, move, hide or remove sections, edit their text, and change colours, corner radius and fonts.
  - **Publish** copies the draft to `theme`, which shoppers see.
  - Section components are shared, so the preview matches the live store.
  - The phone preview uses container queries, so it shows the real mobile layout.
- **Plugins:**
  - Each plugin declares where it plugs in, e.g. checkout payment or a storefront section.
  - Installing B2B Wholesale adds the quote form and bulk price tiers. Uninstalling it removes its sections.
  - Third-party plugins wait for approval in `/admin/apps`.
- **B2C by default, B2B as a plugin.** Stores in the B2B category price before GST and get the wholesale plugin.
- **Money:**
  - Stored as integer paise.
  - GST is CGST+SGST when the buyer is in the store's state, IGST otherwise.
  - Prices include GST by default; this can be changed per store.
- **Checkout:**
  - Stock is reserved with a conditional update per line (only if enough is left), and released if a later line fails.
  - This works on a standalone MongoDB; no replica set is needed.
- **Hostnames (`src/proxy.ts`):**
  - `name.ROOT_DOMAIN` and `name.localhost` serve that store.
  - Verified custom domains are looked up in `stores.customDomain`.
  - Everything else is the platform site.

## Security

| Area | What the code does |
|---|---|
| **Passwords** | bcrypt, cost 12. Minimum 8 characters with letters and a number; common passwords and passwords containing your email name are refused. Same error for unknown email and wrong password, with constant-time comparison. |
| **Brute force** | Rate limits stored in MongoDB, so they work across servers: login 8 per 15 min per account and 40 per IP. Also limited: sign-up, uploads, checkout, quote and newsletter forms, store creation, address checks. |
| **Sessions** | httpOnly, SameSite=Lax, `__Host-` prefixed Secure cookie in production, holding a signed token (HS256) for a **server-side session**. Log out, password change ("sign out other devices") and per-device sign-out take effect immediately. Sessions expire after 12 h. `SESSION_SECRET` (32+ chars) is required in production. |
| **Access control** | Checked in `proxy.ts`, again in every layout, and again in every Server Action and API route. Store owners reach only their own stores (`requireStore()` and `storeId` in every query). Admin-only pages and actions; every admin action is audit-logged. |
| **CSRF** | Server Actions: Next.js Origin check. API routes (`/api/uploads`, `/api/kyc`, `/logout`, store forms): explicit same-origin check. Cookies are SameSite=Lax. |
| **XSS** | React escapes all output. Nonce-based **Content-Security-Policy** with `strict-dynamic` on every response, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. JSON-LD is escaped. Uploaded files are never HTML or SVG. |
| **Clickjacking and headers** | `frame-ancestors 'none'` and `X-Frame-Options: DENY`, nosniff, strict Referrer-Policy, Permissions-Policy, COOP, and HSTS on HTTPS. |
| **Injection** | All input is validated with zod (types, lengths, formats) before it reaches MongoDB. Filters only receive plain strings and numbers; the cart cookie is type-checked. `strictQuery` is on. |
| **Money** | Prices, tax, discounts and shipping are recomputed on the server. Stock is reserved atomically and released if the order fails or is cancelled. A checkout token stops double orders from double clicks. |
| **Hosts** | Store hostnames can't reach `/dashboard`, `/admin`, login or upload APIs. Internal routing headers sent by browsers are stripped. Redirects stay on the same site. |
| **Config** | The environment is validated at startup. Production refuses a missing or short `SESSION_SECRET` or a missing `MONGODB_URI`. Demo data and demo logins are off in production by default. |

**Before launch:**

- Serve over HTTPS.
- Set `TRUST_PROXY=true` behind your load balancer.
- Add 2-factor sign-in for admin accounts.
- Add a password-reset email flow. It needs an email provider.
- Run a third-party penetration test.

## Production

```bash
npm run build
MONGODB_URI=... SESSION_SECRET=... ROOT_DOMAIN=ind2b.com APP_URL=https://ind2b.com TRUST_PROXY=true \
CLOUDINARY_CLOUD_NAME=... CLOUDINARY_API_KEY=... CLOUDINARY_API_SECRET=... npm start
```

Or with Docker. This runs the app plus MongoDB with authentication and a least-privilege app user; image files go to a volume unless Cloudinary is set:

```bash
cp .env.example .env
# in .env set: SESSION_SECRET, MONGO_ROOT_PASSWORD, MONGO_APP_PASSWORD (and CLOUDINARY_* if used)
docker compose up --build
```

Set `SEED_DEMO_DATA=true` once if you want the demo stores in a new Docker database.

For store subdomains:

- Point `*.ind2b.com` and `ind2b.com` at the app and set `ROOT_DOMAIN=ind2b.com`.
- For merchants' own domains, put the app behind a proxy that issues certificates on demand, such as Caddy on-demand TLS or Cloudflare for SaaS.

### Not connected yet (simulated so the flow works end to end)

| Feature | Now | To go live |
|---|---|---|
| Online payment | Order is marked paid | Razorpay Orders + Checkout + webhook in `src/actions/storefront.ts` |
| Plan upgrades | Switch immediately | Razorpay Subscriptions |
| Custom domain verification | Saved as "pending" | DNS check job + TLS |
| Password reset by email | Not available (change password when signed in) | Email provider + reset tokens |
| Emails / WhatsApp | Not sent | Email provider + WhatsApp Business API on order events |
#   I N D 2 B 1  
 