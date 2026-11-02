# NXCO — React Native + Node.js + MongoDB

Full rewrite of the original PHP/SQLite web app into:
- **`backend/`** — Node.js + Express + MongoDB (Mongoose) REST API, JWT auth
- **`mobile/`** — React Native (Expo) app with role-based navigation for Admin, Marketing, Supervisor/Manager/Operator, and Driver

## Quick start

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env        # set MONGODB_URI (see backend/README.md re: replica set) and JWT_SECRET
npm run seed                # creates admin / admin123
npm run dev                 # http://localhost:4000

# 2. Mobile app (in a new terminal)
cd mobile
npm install
# Edit mobile/app.json -> expo.extra.apiBaseUrl to your machine's LAN IP,
# e.g. "http://192.168.1.42:4000" — "localhost" only works from an iOS simulator.
npx expo start
```

Scan the QR code with Expo Go (Android/iOS) or press `i`/`a` for a simulator.

## What changed vs. the PHP version, and why

| Concern | PHP version | This version |
|---|---|---|
| Auth | PHP session cookies | **JWT** — no shared cookie jar on mobile; token stored via AsyncStorage, sent as `Authorization: Bearer` |
| Database | SQLite (single file) | **MongoDB** — IDs are ObjectId strings, not integers |
| Order stock deduction | SQL transaction (implicit, single-file) | **Mongoose session transaction** — requires MongoDB running as a replica set (see `backend/README.md`) |
| Frontend | Server-rendered HTML + vanilla JS per dashboard | **React Native (Expo)** — one codebase, role-based tab navigators |
| File uploads | PHP `move_uploaded_file()` | **Multer**, served statically from `/uploads` |
| Live tracking / geofencing | Same Haversine formula, same 1000m Marketing / configurable office radius rules | **Identical logic**, ported and unit-tested against the same coordinates |

Every business rule from the last several iterations carried over exactly:
role-based order status permissions, Marketing's 1000m/party-required attendance
check-in, stock validation blocking over-ordering, Pending-only order
edit/delete, the driver call/directions/party-detail cards, and the
Admin Party Dashboard.

## Testing notes — please read before assuming everything "just works"

This development sandbox has **no network access to download a MongoDB server
binary**, so I could not run live end-to-end requests against a real database
here. What I *did* verify, thoroughly:

**Backend**
- Every file syntax-checked (`node --check`) and the full Express app graph loads cleanly (`require('./src/app')`), which catches broken imports, bad route wiring, and schema errors.
- Business logic unit-tested in isolation: the Haversine distance function against the exact coordinate pairs used throughout this project's earlier PHP testing (results matched to the decimal — 749.5m / 98,364m), JWT sign/verify round-trip, bcrypt hash/compare, and the order-items validation function (rejects zero-quantity, missing product_id, malformed JSON, empty arrays).

**Mobile**
- All 36 files parsed with Babel (Expo's own JSX preset) — catches real syntax errors that `node --check` can't see in JSX.
- Every relative import cross-checked against the actual file on disk.
- Every named/default import cross-checked against what its source file actually exports (catches typos like importing `{ Button }` from a file that only exports `{ Btn }`).
- Every npm package referenced in code confirmed present in `package.json`.

**What I could not do here:** actually launch the Expo app in a simulator (no
device/simulator available in this sandbox) or fire real HTTP requests at the
backend against a live MongoDB. Before you rely on this, please:
1. Get the backend running against a real MongoDB (Atlas is fastest) and hit a few endpoints with curl/Postman.
2. Run `npx expo start` and click through each role's flow on a real device or simulator.

If anything doesn't behave as expected once you do that, tell me exactly
what you tried and what happened — I'll fix it.

---

## Update (synced with the Postgres schema)

- **Payment per order** — Cash / Credit is now chosen on each *order* (Place Order and Edit Order). A Credit order needs a cheque number + cheque photo. It was removed from the party's Fill Form (Fill Form = KYC + product rates only).
  - Backend: `Order` model has `payment_mode`, `cheque_no`, `cheque_image`; `POST /api/orders` and `/api/orders/:id/update` accept multipart (`cheque_image`); the invoice PDF shows the payment line.
- **Admin can delete an order in any status** — stock is returned only while the order still holds stock (Pending / Confirmed / Ready to Dispatch / On the Way); a Completed order's payment entries are removed so the party's due is recalculated. Marketing can still delete only their own *Pending* orders.
- **Payment info on every order card** (Admin, Supervisor, Marketing, Driver) via the new `PaymentSection` component.
- **Logo** — crisp full-bleed blue icon, Android adaptive icon (blue background + safe-zone foreground), blue splash screen, bigger logo on the in-app splash and login.
- Existing Mongo data keeps working: old orders default to Cash, old party-level payment fields are simply ignored.
