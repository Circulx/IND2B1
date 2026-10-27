# IND2B: one MongoDB database for everything

All portals use the single database set by `MONGODB_URI` + `MONGODB_DB` (src/lib/db/connect.ts).
Nothing is kept in server memory, on the server's disk, or in the browser except opaque ids in httpOnly cookies.

| What | Collection(s) | Written by | Read by |
|---|---|---|---|
| Merchant, admin, super admin accounts (bcrypt passwords) | `users` | /signup, /superadmin/users, npm run superadmin, SUPERADMIN_* env | every login, all consoles |
| Sign-in sessions (all portals, revocable) | `sessions` (TTL) | every login | every page/action/API (`getSession`, `getCustomerSession`) |
| Email codes (sign-up, password reset; HMAC only) | `emailotps` (TTL) | sign-up / forgot-password | code verification |
| Brute-force limits | `ratelimits` (TTL) | logins, sign-up, checkout, uploads | same |
| Stores, settings, theme, domains, plugins | `stores` | /start, dashboard, admin, super admin | storefront, all consoles |
| Products / orders / order numbers / discount codes | `products`, `orders`, `counters`, `discounts` | dashboard, checkout, super admin | storefront, dashboards |
| Shopper accounts (per store) | `customers` | store register | store login, super admin |
| **Shopping carts + applied discount code** (NEW) | `carts` (TTL 30 days) | add to cart, update cart, apply code | cart, checkout, header count; follows a signed-in shopper across devices |
| **Plans: name, price, fee, features** (NEW) | `plans` | seeded from catalog defaults on first use; edited in /superadmin/plans | /pricing, home, merchant settings, /admin, /superadmin |
| Images: details | `media` | /api/uploads | product pages, page builder |
| **Images: bytes when Cloudinary is not set** (NEW) | GridFS `media.files` / `media.chunks` | /api/uploads | /media/... |
| KYC documents | GridFS `kycdocs.*` | dashboard KYC | /api/kyc (owner + staff) |
| Plugin review decisions | `appreviews` | /admin/apps, /superadmin/plugins | app store, consoles |
| Newsletter, quote requests | `subscribers`, `quoterequests` | storefront | dashboard |
| Audit log | `auditlogs` | every staff action and sign-in | /admin/audit, /superadmin/audit |

With `CLOUDINARY_URL` set, image files are on Cloudinary's CDN (recommended for speed) and their details stay in `media`.
Without it, image files are stored in MongoDB; files saved on disk by older versions are still served.

Templates and plugin definitions stay in src/lib/catalog.ts because each one is tied to rendering code;
which store uses which template and plugin, and plugin approval status, are stored in MongoDB.

Cookies only hold ids that are checked against the database: the session JWT (names a `sessions` document),
the cart id, the merchant's currently selected store, and a guest's last order id.
Earlier carts kept in cookies are moved into MongoDB automatically on the shopper's next cart change.
