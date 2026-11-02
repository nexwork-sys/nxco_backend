# NXCO — Backend (Node.js + Express + MongoDB)

Feature-for-feature rewrite of the original PHP/SQLite API for the React Native app.

## Setup

```bash
cd backend
npm install
cp .env.example .env      # then edit MONGODB_URI and JWT_SECRET
npm run seed               # creates the default Admin login
npm run dev                 # starts on http://localhost:4000 (nodemon)
```

Default login after seeding: **employee_id `admin`, password `admin123`** — change it immediately via Settings > Change Password.

### ⚠️ MongoDB must run as a replica set (even a single-node one)

Order placement/editing/cancelling uses a MongoDB **transaction** (to deduct/restock
inventory and write the order atomically). Transactions require a replica set —
a plain standalone `mongod` will reject them.

- **Easiest: MongoDB Atlas** (free M0 tier) — already a replica set, no setup needed. Just paste the connection string into `MONGODB_URI`.
- **Local MongoDB:** initialize a single-node replica set once:
  ```bash
  mongod --dbpath /your/data/dir --replSet rs0
  # in a separate shell:
  mongosh --eval "rs.initiate()"
  ```
  Then use `MONGODB_URI=mongodb://127.0.0.1:27017/nxco?replicaSet=rs0`.

## Auth model

Unlike the PHP version (PHP session cookies), this API is **stateless JWT auth** —
a better fit for a mobile app with no shared cookie jar:

1. `POST /api/auth/login` → returns `{ token, user, home }`.
2. Store `token` in the device (e.g. `expo-secure-store` / `AsyncStorage`).
3. Send it on every request: `Authorization: Bearer <token>`.
4. Token is valid for `JWT_EXPIRES_IN` (default 30 days) — no server-side session to expire early; to force a logout everywhere, rotate `JWT_SECRET`.

## Uploaded files

Shop photos, order documents, and the custom logo are saved under `/uploads/...`
and served statically at `http://<host>:<port>/uploads/...` — the same relative
path is what's stored on the document (`shop_image`, `documents[]`, `logo_path`),
so the mobile app just does:
```js
<Image source={{ uri: `${API_BASE}/${party.shop_image}` }} />
```

## API reference

All responses share one JSON envelope: `{ success, message, ...data }`.

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/api/auth/login` | public | `{employee_id, password}` |
| GET  | `/api/auth/me` | any | validate stored token |
| POST | `/api/auth/change-password` | any | |
| GET/POST | `/api/employees` | Admin | list / create |
| POST | `/api/employees/:id/update` \| `/:id/delete` | Admin | |
| GET | `/api/parties` | any | |
| POST | `/api/parties` (multipart, `shop_image`) | Admin, Marketing | |
| POST | `/api/parties/:id/update` \| `/:id/delete` | Admin, Marketing (update) / Admin (delete) | |
| GET | `/api/products` | any | |
| POST | `/api/products` \| `/:id/update` | Admin, Supervisor, Manager, Operator | |
| POST | `/api/products/:id/delete` | Admin | |
| GET | `/api/orders?status=` | any (scoped: Marketing sees own, Driver sees dispatch-ready+) | |
| POST | `/api/orders` (multipart, `documents[]`) | Marketing, Admin | validates & deducts stock |
| POST | `/api/orders/:id/update` \| `/:id/delete` | Marketing (own, Pending only), Admin | |
| POST | `/api/orders/:id/status` | role depends on target status — see `STATUS_PERMISSIONS` in `orders.routes.js` | |
| POST | `/api/attendance/mark` | any | `{type:'in'|'out', lat, lng, party_id?}` — Marketing must supply `party_id` within 1000m |
| GET | `/api/attendance/list?date=&user_id=` | any (Admin sees everyone) | |
| POST | `/api/tracking/ping` | any | periodic location update while checked in |
| GET | `/api/tracking/live` | Admin | today's checked-in staff + last location |
| GET | `/api/settings` | any | |
| POST | `/api/settings` (multipart, `logo_file`) | Admin | |

## What was verified in this environment

This sandbox has no network access to download a real MongoDB server binary, so
full request/response integration testing against a live database wasn't
possible here. What **was** verified:
- Every file syntax-checked (`node --check`) and the whole app graph loads cleanly (`require('./src/app')` — this catches broken imports/route wiring/schema errors).
- Core business logic unit-tested in isolation: the Haversine distance function against the exact same coordinate pairs used in the original PHP testing (749.5m / 98,364m — matches to the decimal), JWT sign/verify round-trip, bcrypt hash/compare, and the order-items validation function.

Run `npm run dev` against a real MongoDB (Atlas is fastest) and exercise the
endpoints with curl/Postman before wiring up the mobile app against it.
