# IND2B Super Admin Control Centre (/superadmin)

## What was added
A separate, fully responsive portal for the IND2B team's super admins.

- `/superadmin` → if not signed in as a super admin, the proxy redirects to `/superadmin/login`.
- `/superadmin/login` → sign-in (super admins only; admins are told to use /admin/login, merchants get the generic error).
- `/superadmin/forgot-password` → emailed-code reset, returns to /superadmin/login.
- `/superadmin/logout` (POST) → signs out and returns to /superadmin/login.

Dashboard sections (all require an active super admin session, checked in the proxy AND on every page/action):
| Page | Control |
|---|---|
| Dashboard | KPIs (GMV, MRR, stores, merchants, shoppers, staff, devices), GMV chart, work waiting, latest orders, recent activity |
| Stores / store detail | filters; edit details; status active/setup/suspended (reason required); plan; KYC approve/reject/reset + documents; custom domain verify/unverify/remove; install/remove any plugin; transfer ownership; permanent delete (type the subdomain to confirm) |
| Orders / order detail | every store's orders, filters + paging; override status (restocks when cancelling unfulfilled); set payment status |
| Products | all stores; publish/unpublish; delete |
| Discount codes | all stores; switch on/off; delete |
| Shoppers | enable/disable, sign out, delete |
| KYC verification | queue + all states; approve/reject/reset |
| Plugins | review queue; publish/reject/delist |
| Templates, Plans & revenue | usage, MRR/ARR, change any store's plan |
| Users & staff / user detail | create merchant/admin/super admin; edit name/email/phone; role; disable/enable; set password; sign out devices; delete (not self, not last super admin, not while owning stores) |
| Active sessions | every signed-in device; end any session; emergency sign-out of merchants/staff/shoppers/everyone (your device is kept) |
| Audit log | filter + CSV export |
| System health | DB status, collection counts, config (no secrets shown) |
| My account | profile, password, own devices |

Every mutation re-checks the role, validates input (zod), and is written to the audit log.

## Files
Changed (1 existing file): `src/proxy.ts` — adds the `/superadmin` access rule (super admins only) and blocks /superadmin on store hostnames.

New:
- `src/lib/superadmin.ts` – guard + safe redirect helpers
- `src/lib/services/platform.ts` – cross-store queries and operations
- `src/actions/superadmin-portal.ts` – sign-in and all Server Actions
- `src/components/superadmin/*` – responsive shell, nav, forms, flash messages, shared bits
- `src/app/superadmin/**` – login, forgot-password, logout, and all dashboard pages

Nothing else was modified; /admin, /dashboard, storefronts and all existing actions behave exactly as before.

## Use
No new packages or env variables. Create a super admin as before (`SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`, or `npm run superadmin`),
then open `https://<your-domain>/superadmin`. Demo (dev): root@ind2b.com / Super@Admin2026.
