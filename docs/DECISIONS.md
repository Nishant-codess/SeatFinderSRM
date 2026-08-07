# Engineering Decisions — SeatFinderSRM

<!--
This file is for technical interviewers and senior engineers who want to
understand WHY the system is built the way it is. Every entry answers a
question an interviewer might ask.
-->

---

## Decision 1 — Firebase Realtime Database over Postgres / Supabase

**Context:** Seat availability needs to update live across every connected browser without polling. The options were: (a) a traditional Postgres DB with client polling, (b) Supabase with its Realtime feature, or (c) Firebase Realtime Database.

**Decision:** Firebase Realtime Database.

**Reason:** Firebase RTD is WebSocket-native — every `onValue` listener maintains a persistent connection and receives pushed diffs, not full snapshots, in under a second. This matches the core UX requirement exactly: a student looking at the seat map should see a seat turn red the moment someone else books it, with no manual refresh. Supabase Realtime could achieve similar results, but Firebase's client SDK also handles offline buffering, reconnection, and multi-path atomic writes in a single package — fewer moving parts for a small team.

**Tradeoff:** Firebase RTD is a JSON tree, not a relational model. Complex queries (filtering bookings by user, status, and date range simultaneously) require fetching the parent node and filtering in application code. This is fine at v1 scale (< 5 000 bookings/day) but would require denormalisation or a move to Firestore with composite indexes at higher volumes.

---

## Decision 2 — Admin whitelist in `NEXT_PUBLIC_` env var, not a DB role

**Context:** The admin set is a fixed, known list (library staff emails). The options were: (a) store an `isAdmin` flag in the user's Firebase database node, (b) use Firebase custom claims, or (c) configure a comma-separated email list in an environment variable.

**Decision:** Environment variable (`NEXT_PUBLIC_ADMIN_EMAILS`).

**Reason:** An env-var check is synchronous and zero-latency — the `isAdmin` decision is made from a value already in memory on every render, with no database round-trip. Custom claims would require a Cloud Function to set them, adding infrastructure. A DB flag requires an async read on every protected page load. For a list of < 10 known admin emails that changes at most a few times a year, the env-var approach is correct.

**Tradeoff:** `NEXT_PUBLIC_` variables are bundled into the client-side JavaScript — the list of admin emails is visible to anyone who inspects the bundle. This is a hygiene issue: an attacker cannot gain admin privileges from knowing the email addresses (Firebase Auth still controls identity), but it is not ideal. It also means all admin API routes in v1 rely on client-side role detection rather than server-side verification. Both issues are addressed in v2 with Firebase custom claims checked in middleware.

---

## Decision 3 — QR code check-in over NFC / manual lookup

**Context:** Students need a way to confirm their physical presence at the library after booking. Options were: (a) NFC tap at entrance, (b) admin manually searching a list by student name, or (c) QR code generated at booking time, scanned by admin's device.

**Decision:** QR code check-in via camera or image upload.

**Reason:** QR works on any smartphone without special hardware, the booking QR is downloadable as a PNG (works offline), and the admin scanner page runs in any browser with camera access — no dedicated kiosk or NFC reader needed. The implementation uses `html5-qrcode` for live camera scanning and `jsqr` as a fallback for image uploads, covering cases where camera permission is not available.

**Tradeoff:** QR codes can be screenshot and shared. The payload (`{ bookingId, userId, seatId }`) has no cryptographic signature, so a student could technically share their QR with a friend. This is mitigated by the booking status machine: the entry transition is only valid when the booking is `pending`, so the QR can only be used once for entry. Exit uses a separate scan. A proper solution would include a time-limited HMAC token in the QR payload.

---

## Decision 4 — Client-side seat expiry over a Cloud Function cron

**Context:** Reservations that are not checked in within a grace period should be automatically cancelled to prevent seat hoarding. Options were: (a) a Firebase Cloud Function running on a schedule, or (b) client-side expiry logic triggered on page load.

**Decision:** Client-side expiry on `SeatMap` mount.

**Reason:** Shipping a Cloud Function requires a Blaze (pay-as-you-go) Firebase plan and a deployment pipeline for server-side code. The client-side approach works on the free Spark plan, ships immediately with the frontend, and is effective as long as at least one browser has the app open — which is nearly always true during library hours. The expiry logic is idempotent (checks `occupiedUntil < Date.now()`) so concurrent runs from multiple clients are safe.

**Tradeoff:** If no browser is viewing the seat map (e.g., at 2 AM), expired bookings will not be released until the next page load. Seats can appear reserved for longer than the grace period in very low-traffic windows. This is acceptable for v1 but will be replaced with a Cloud Function cron in v2.

---

## Decision 5 — Multi-path Firebase writes for booking atomicity

**Context:** Creating a booking requires writing to two separate nodes: `bookings/{uid}/{bookingId}` (create the booking record) and `seats/{floor}/{seatId}` (update seat status to `reserved`). If only one write succeeds, the system is in an inconsistent state.

**Decision:** Firebase Realtime Database multi-path updates — a single `update(ref(db, '/'), { 'seats/...': ..., 'bookings/...': ... })` call.

**Reason:** Firebase RTD applies multi-path updates atomically at the server — either both paths are updated or neither is. This eliminates the partial-write inconsistency without any transaction management code on the client.

**Tradeoff:** Multi-path updates require knowing all target paths at write time and constructing a flat key-value map. The path format is more error-prone than structured Firestore transactions, and deep nesting (e.g., `seats/ground/G01/status`) must be spelled out as string keys. A small helper or stricter typing would reduce the chance of a typo causing a silent no-op.

---

## What I'd do differently in v2

- **Firebase custom claims for admin** — move admin detection server-side; remove `NEXT_PUBLIC_ADMIN_EMAILS` from the client bundle entirely; enforce in Security Rules and middleware.
- **Firebase Security Rules** — write validation currently lives in TypeScript (`validateSeatUpdate`, `validateBookingAction`). These are bypassable by anyone with Firebase credentials. Proper Security Rules would enforce role checks at the database layer, making the system secure even if API routes are bypassed.
- **HMAC-signed QR tokens** — include a time-limited signed token in the QR payload to prevent screenshot sharing.
- **Cloud Function auto-expiry** — replace client-side expiry with a scheduled Cloud Function for guaranteed cleanup regardless of browser activity.
- **Firestore over Realtime DB** — Firestore's composite indexes and structured query model would handle the analytics filtering workload more cleanly at scale, while still supporting real-time listeners.

---

## Explicit non-decisions (deferred to v2)

| Feature | Why deferred |
|---|---|
| FCM push notifications | Stubs present in booking-management service (`// TODO`); adds Cloud Functions dependency and VAPID key management; not critical for v1 where students check the app directly |
| Multi-campus / multi-library support | Single-campus scope is sufficient for v1; generalisation would require per-library seat namespacing and admin scoping |
| Advance booking (multi-day) | Same-day only reduces ghost reservations; demand pattern must be observed before opening advance booking |
| Penalty enforcement (fines) | No-show count is tracked in user stats; enforcement policy is a library management decision, not a software requirement in v1 |
| Native mobile app | Web is mobile-responsive; native requires separate build pipeline and app store review; deferred until web usage validates demand |
