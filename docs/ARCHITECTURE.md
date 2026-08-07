# SeatFinderSRM — Architecture

<!--
Companion to PRD.md.
PRD says WHAT the system does. This says HOW.
Audience: an engineer who needs to understand the system well
enough to build it, debug it, or extend it.
-->

---

## 1. Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Auth | Firebase Authentication (email/password, @srmist.edu.in domain restriction) |
| Database | Firebase Realtime Database (asia-southeast1) |
| Styling | Tailwind CSS 3 · shadcn/ui (Radix UI primitives) |
| Charts | Recharts 3 |
| QR | react-qr-code (display) · qrcode (PNG export) · html5-qrcode (camera scan) · jsqr (image scan) |
| AI | Google Genkit 1.24 · Gemini 2.0 Flash (via @genkit-ai/googleai) |
| Validation | Zod · React Hook Form · @hookform/resolvers |
| Testing | Jest 30 · Testing Library · fast-check (property testing) |
| Hosting | Firebase App Hosting (apphosting.yaml, maxInstances: 1) |

---

## 2. Components

```
src/
  app/               Next.js App Router — pages and API routes
    (main)/          Layout group for authenticated pages
      admin/         Admin-only pages (analytics, bookings, users, seats, feedback, reports, settings)
      seats/         Student seat-map page
      dashboard/     Student booking history and active booking
      scanner/       QR scanner for admin check-in / check-out
      statistics/    Student usage statistics
      feedback/      Feedback submission and ticket history
    api/             Next.js Route Handlers (server-side)
      admin/         Admin-gated API endpoints
      bookings/      Booking extension endpoint
      feedback/      Feedback submission and response
      stats/         Per-user statistics
      init/          Database seeding endpoints
    book/[seatId]/   Booking flow page
    auth/action/     Firebase email action handler
  components/        React components
    ui/              shadcn/ui primitive components
    charts/          Recharts wrappers (bar, line, circular progress)
    providers/       React context providers (auth, theme)
    seat-map.tsx     Interactive floor map with real-time Firebase listeners
    booking-client.tsx  Booking form and QR code display
    qr-scanner.tsx   Camera + image-upload QR scanner
    booking-history.tsx  User booking list
    usage-statistics.tsx  Per-user analytics display
    feedback-form.tsx   Feedback submission UI
  services/          Business logic (Firebase reads/writes)
    analytics.ts     Occupancy, peak hours, trend computation
    booking-management.ts  Admin booking CRUD and audit logging
    booking-extension.ts   Extension conflict detection and policy enforcement
    seat-management.ts     Seat status transitions and maintenance
    user-management.ts     User search and flagging
    feedback.ts            Feedback ticket CRUD
    library-settings.ts    Operating hours and booking rules
    reports.ts             CSV report generation
  lib/               Utilities and configuration
    firebase.ts      Firebase app, auth, and db initialisation
    admin-config.ts  Admin email whitelist from env var
    auth-utils.ts    Session validation helpers (used in API routes)
    user-roles.ts    Role lookup from Firebase
    validation.ts    Permission checks for seat/booking mutations
    logger.ts        Structured logging wrapper
  types/index.ts     All TypeScript interfaces (Seat, Booking, UserProfile, etc.)
  ai/
    genkit.ts        Genkit initialisation with Gemini 2.0 Flash
    dev.ts           Genkit dev server entry point
```

### Seat Map

`SeatMap` subscribes to Firebase Realtime Database paths (`seats/ground`, `seats/first`, `seats/second`, `seats/third`) via `onValue` listeners. All 200 seats stream live. Floor switching just shows a different slice of the already-subscribed state — no extra round-trip. The component also subscribes to the current user's booking node (`bookings/{uid}`) to surface their active booking in the UI. Does not own any write logic — that lives in `BookingClient`.

### Booking Client

`BookingClient` handles the full booking lifecycle for a single seat: listening to the specific seat node, presenting the time-selection form, writing the booking to `bookings/{uid}/{bookingId}` and the seat to `seats/{floor}/{seatId}` atomically via a multi-path update, and rendering the QR code on success. It also manages the countdown timer and extension flow.

### QR Scanner

`QrScanner` uses `html5-qrcode` for live camera scanning and `jsqr` for decoding images uploaded from the file system. On a successful decode, it reads `{ bookingId, userId, seatId }` from the JSON payload and performs a multi-path Firebase write to transition booking status (`pending → active` on entry, `active → completed` on exit) and seat status. Duplicate scans within the same session are debounced by storing the last decoded string.

### Analytics Service

`analytics.ts` fetches all bookings from Firebase in a given date range, then computes occupancy rate (occupied hours / total available seat-hours), peak hours (top 3 start-hour buckets), average session duration (exit − entry for completed bookings), and no-show rate — all in pure TypeScript on the server. No aggregation is pre-stored in the database.

### Admin Booking Management

`booking-management.ts` exposes cancel, manual assign, manual check-in, and manual check-out operations, each of which writes a corresponding entry to `auditLogs` via `push`. Audit logging failures are swallowed so that they cannot block the primary operation.

---

## 3. Data Flow

```
[Student browser]
  → Firebase Auth login (@srmist.edu.in enforced)
  → Email verified? No → VerifyEmailMessage. Yes → /seats

[Seat Map page]
  → onValue(seats/ground, seats/first, seats/second, seats/third)
      ← Firebase RTD pushes updates to all connected clients (<1s)
  → onValue(bookings/{uid}) → surfaces active booking

[Student books a seat]
  → Select seat → BookingClient renders booking form
  → Choose end time (30-min intervals, same day)
  → multi-path update:
      seats/{floor}/{seatId}: { status: 'reserved', bookedBy, bookingId, occupiedUntil }
      bookings/{uid}/{bookingId}: { status: 'pending', seatId, startTime, endTime, ... }
  ← All other clients see seat turn yellow (reserved) instantly
  → QR code rendered with JSON payload { bookingId, userId, seatId }

[Admin QR scanner — entry]
  → Camera or image upload → html5-qrcode / jsqr decodes JSON
  → Reads booking node → validates status === 'pending'
  → multi-path update:
      bookings/{uid}/{bookingId}: { status: 'active', entryTime }
      seats/{floor}/{seatId}: { status: 'occupied' }
  ← Seat turns red on all clients

[Booking expiry — client-side]
  → On SeatMap mount: scan all seats where occupiedUntil < Date.now()
  → Release: { status: 'available', bookedBy: null, bookingId: null, occupiedUntil: null }
  → Update booking: { status: 'expired' }

[Admin analytics]
  GET /api/admin/analytics?startDate=&endDate=&granularity=
  → computeAnalytics() reads bookings/ and seats/ from Firebase
  → Returns occupancyRate, peakHours, averageDuration, noShowRate, trends
```

---

## 4. Database Schema

Firebase Realtime Database — JSON tree structure (no SQL schema):

- `seats/{floor}/{seatId}` — `{ id, status, bookedBy, bookedAt, bookingId, occupiedUntil, maintenanceInfo? }`
  - `floor` is one of: `ground`, `first`, `second`, `third`
  - `seatId` format: `G01`–`G50`, `F01`–`F50`, `S01`–`S50`, `T01`–`T50`

- `bookings/{userId}/{bookingId}` — `{ id, seatId, userId, userName, userEmail, bookingTime, startTime, endTime, entryTime?, exitTime?, status, duration, extendedFrom?, cancelledBy?, cancelReason?, createdAt, updatedAt }`

- `users/{userId}` — `{ uid, email, displayName?, photoURL?, role, currentBookingId?, restrictions?, stats, createdAt, updatedAt }`

- `feedback/{ticketId}` — `{ id, userId, userName, userEmail, category, subject, description, status, priority?, assignedTo?, responses[], createdAt, updatedAt }`

- `auditLogs/{logId}` — `{ id, timestamp, adminId, adminName, action, targetId, targetType, reason?, details? }`

- `settings/library` — `{ operatingHours, holidays[], bookingRules, updatedBy, updatedAt }`

**Hot query paths:** `seats/{floor}` is read by every connected browser via persistent listeners. `bookings/{userId}` is read per-user. No indexes are required for these access patterns given Firebase RTD's tree structure. The analytics service performs a full scan of `bookings/` — acceptable at v1 scale, but would require denormalisation or aggregation at 10k+ bookings/day.

---

## 5. AI / LLM Design

Google Genkit is initialised with `googleai/gemini-2.0-flash` in `src/ai/genkit.ts`. The Genkit dev server (`src/ai/dev.ts`) is available for local flow development via `npm run genkit:dev`. In v1, no Genkit flows are wired to production user-facing features — the integration is scaffolded for a planned v2 feature (natural-language booking summaries / admin insights). The model is `gemini-2.0-flash` (fast, low-cost) rather than a larger model, matching the expected task size.

---

## 6. API Routes

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/admin/analytics` | Compute occupancy, peak hours, no-show rate for a date range; optional trend granularity |
| `POST` | `/api/admin/bookings/cancel` | Cancel a booking with admin ID and reason; releases seat |
| `POST` | `/api/admin/bookings/check-in` | Manual check-in; transitions booking to `active`, seat to `occupied` |
| `POST` | `/api/admin/bookings/check-out` | Manual check-out; transitions booking to `completed`, seat to `available` |
| `POST` | `/api/admin/bookings/assign` | Manually assign a seat to a user for a given time window |
| `POST` | `/api/admin/seats/maintenance` | Mark a seat as maintenance or out-of-service; cancels future bookings |
| `GET` | `/api/admin/users` | List/search all users with stats |
| `POST` | `/api/admin/users/flag` | Flag a user account with a reason |
| `POST` | `/api/admin/users/unflag` | Unflag a user account |
| `POST` | `/api/admin/reports/generate` | Generate and return a CSV report for a configured date range and metrics |
| `POST` | `/api/bookings/extend` | Extend an active booking by N minutes (conflict-checked) |
| `POST` | `/api/feedback/submit` | Submit a new feedback ticket |
| `GET` | `/api/feedback/user/[userId]` | Fetch all feedback tickets for a given user |
| `POST` | `/api/feedback/respond` | Admin posts a response to a feedback ticket |
| `GET` | `/api/stats/user/[userId]` | Fetch per-user statistics (total hours, no-shows, preferred slots, etc.) |
| `GET` | `/api/init/all` | Seed the database with initial seat structure (dev / first-run only) |

---

## 7. Security

- **API keys:** All Firebase config values in `.env.local` and Vercel/Firebase env vars. `.env.local` is gitignored.
- **Auth domain restriction:** Firebase Auth does not natively restrict by email domain; the restriction is enforced at the `AuthForm` component level before `createUserWithEmailAndPassword` is called. Email verification is required before any authenticated page is accessible.
- **Admin access:** Checked client-side against `NEXT_PUBLIC_ADMIN_EMAILS`. This value is visible in the client bundle — see DECISIONS.md for the tradeoff. API admin routes do not re-verify admin status server-side in v1 (relying on admin-only page routing).
- **Seat/booking mutation validation:** `validateSeatUpdate` and `validateBookingAction` in `src/lib/validation.ts` check user role before any write. Non-admin users cannot set maintenance or out-of-service status, and cannot manage other users' bookings.
- **Audit logging:** Every admin action (cancel, check-in, check-out, assign, flag, maintenance) writes to `auditLogs` with the admin's ID and reason. Logging failures are caught and do not block the primary operation.
- **QR payload:** JSON `{ bookingId, userId, seatId }` — no secret token. Replay is mitigated by booking status checks (entry only allowed when status is `pending`).

---

## 8. Error Handling & Reliability

| Failure | Behaviour |
|---|---|
| Firebase connection lost | Firebase SDK buffers writes locally and syncs on reconnect; UI shows stale data until reconnect |
| Booking write fails mid-flight | The seat node and booking node are written via a multi-path update — Firebase applies both atomically; partial write cannot leave an inconsistent state |
| Audit log write fails | Error is caught and logged to console; does not block the admin action |
| QR decode fails | Toast error shown; scanner remains active for retry |
| Booking extension conflict | API returns 400 with `{ success: false, message, alternatives? }`; client displays reason |
| Invalid admin API request | 400 returned with structured error JSON |
| Analytics fetch error | Service returns empty defaults rather than throwing; dashboard shows zero-state |

---

## 9. Deployment

1. Firebase App Hosting linked to the GitHub repo — `apphosting.yaml` sets `maxInstances: 1` for cost control on v1.
2. Firebase Realtime Database in `asia-southeast1` region (nearest to SRM IST Chennai).
3. Environment variables set in Firebase App Hosting backend configuration (not in the repo).
4. No database migration step — Firebase RTD is schema-less; the `init/all` API route seeds the initial seat structure on first run.
5. `next build` runs TypeScript type-checking (`ignoreBuildErrors: false`); build fails on type errors.
6. `removeConsole: true` in production compiler config strips all `console.*` calls from the client bundle.

---

## 10. Explicit Scope Cuts

- **Firebase Security Rules enforcement** — write validation currently lives in TypeScript utilities called from client code and API routes. Proper Security Rules that enforce these constraints at the Firebase layer are deferred to v2.
- **Server-side admin verification** — admin API routes trust client-side role detection in v1. v2 will use Firebase custom claims verified in middleware.
- **Cloud Function auto-expiry** — booking expiry is triggered on client mount. A Firebase Cloud Functions cron would guarantee cleanup regardless of client activity.
- **Push notifications** — stubs (`// TODO: Send notification`) are in place; FCM integration is v2.
- **Real-time admin booking list** — the admin bookings page does a one-time fetch; live updates require adding an `onValue` listener scoped to the admin view.
