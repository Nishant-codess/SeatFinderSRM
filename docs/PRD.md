# SeatFinderSRM — Product Requirements Document

**Status:** Final
**Owner:** Tanish Poddar
**One-liner:** Real-time library seat booking for SRM University students — find, book, and check in with a QR scan.

---

## 1. Problem

SRM University's library has 200+ seats across four floors. Students routinely walk to the library only to find it full, or hold seats they are not physically occupying. There is no system to check real-time availability remotely, no way for staff to detect overstays automatically, and no audit trail of who used which seat. This causes wasted commute time for students and an unmanageable workload for library staff trying to police seat usage manually.

---

## 2. Goals (v1 / MVP)

1. SRM email login only — no public sign-up; domain restriction enforced at the auth layer.
2. Interactive floor map showing live seat status (available / reserved / occupied / maintenance / out-of-service) for all four floors.
3. Students can book a seat for a chosen end time and receive a QR code immediately.
4. QR-code-based check-in and check-out — admin scanner page confirms presence without manual lookup.
5. Automatic expiry of unconfirmed reservations after a configurable grace period (anti-hoarding).
6. Booking extension if the seat remains free after the originally booked period.
7. Admin dashboard: occupancy analytics, booking management, user flagging, seat maintenance controls, CSV report export.
8. Deployed with a live demo URL on Firebase App Hosting.

---

## 3. Non-Goals (explicit scope cuts)

- **Mobile native app (iOS/Android)** — the web app is mobile-responsive; a native app is a v2 decision once usage patterns are established.
- **Push / SMS notifications** — notification hooks are scaffolded in the booking service but not wired in v1; complexity not justified for the initial rollout.
- **Payment or fine collection** — penalty tracking for repeat no-shows is tracked as a stat; enforcement is a manual admin decision in v1.
- **Multi-campus or multi-library support** — scoped to a single SRM campus library; generalisation deferred to v2.
- **Seat reservations more than one day in advance** — same-day booking only in v1 to reduce ghost reservations and wasted capacity.

---

## 4. Users

**Primary:** SRM IST students (verified `@srmist.edu.in` accounts) who want to find and reserve a library seat without walking in blind.

**Secondary:** Library administrators who need to manage seat availability, handle user issues, and pull usage reports.

---

## 5. User Stories

1. *As a student,* I want to see which seats are available on each floor right now so that I can decide whether it is worth going to the library.
2. *As a student,* I want to book a specific seat until a chosen time so that I have a guaranteed spot when I arrive.
3. *As a student,* I want to check in by scanning my QR code at the entrance so that my reservation is confirmed and the seat shows as occupied.
4. *As a student,* I want to extend my booking if the seat is still free so that I do not lose my spot mid-session.
5. *As a student,* I want to view my booking history and total study hours so that I can track my library usage.
6. *As an admin,* I want to scan a student's QR code to check them in or out so that I can manage occupancy without manually searching a list.
7. *As an admin,* I want to mark a seat as under maintenance or out of service so that students cannot book a broken seat.
8. *As an admin,* I want to see occupancy rates, peak hours, and no-show percentages so that I can report usage to the department.

---

## 6. Functional Requirements

### 6.1 Authentication

- Only `@srmist.edu.in` email addresses may register or log in.
- Email must be verified before the user can access any protected page.
- Admin access is granted to emails listed in `NEXT_PUBLIC_ADMIN_EMAILS` env var; admins are redirected to the admin dashboard on login.

### 6.2 Seat Map

- Display all seats across four floors (Ground, First, Second, Third) with 50 seats per floor.
- Seat status updates in real time via Firebase Realtime Database listeners.
- Students can filter by floor, availability, and search by seat number.
- Seats under maintenance or out-of-service are visually distinct and cannot be booked.

### 6.3 Booking

- Students select a seat and choose an end time (30-minute intervals, same day only).
- A booking record is written to `bookings/{userId}/{bookingId}`; seat status transitions to `reserved`.
- A QR code containing `{ bookingId, userId, seatId }` is generated immediately.
- QR code is downloadable as a PNG for offline use.
- Unconfirmed bookings (status `pending`) are automatically cancelled after the configured grace period.

### 6.4 QR Check-in / Check-out

- Admin scanner page reads QR via camera (html5-qrcode) or image upload (jsqr).
- Entry scan: booking transitions to `active`, seat to `occupied`, `entryTime` recorded.
- Exit scan: booking transitions to `completed`, seat to `available`, `exitTime` recorded.
- Duplicate scans within the same session are suppressed.

### 6.5 Booking Extension

- Extension is only possible when the booking is `active` or `pending`.
- Extension is blocked if any other booking overlaps the requested extension window.
- On success, `endTime` and `occupiedUntil` are updated; `extendedFrom` stores the original end time.

### 6.6 Admin Dashboard

- **Analytics:** occupancy rate, peak hours (top 3), average session duration, no-show rate, configurable date range, daily/weekly/monthly trend charts.
- **Booking management:** list/filter/search all bookings, manual check-in, manual check-out, booking cancellation with reason, manual seat assignment.
- **User management:** search users, view stats (total bookings, no-show count, overstay count), flag/unflag accounts.
- **Seat management:** mark seats as maintenance or out-of-service (cancels future bookings), restore seats to service.
- **Feedback:** view tickets, respond to submissions, update ticket status and priority.
- **Reports:** generate CSV exports with configurable date range and metric selection.
- All admin actions are written to `auditLogs` with timestamp, admin ID, target, and reason.

### 6.7 Feedback

- Students can submit feedback with category (bug / feature-request / seat-issue / general), subject, and description.
- Ticket status (pending / in-progress / resolved / closed) and admin responses are visible to the submitter.

### 6.8 Library Settings

- Admins can configure operating hours per day of the week and mark holidays.
- Booking rules are configurable: min/max booking duration, max daily duration, extension increment, max advance booking days.

---

## 7. Non-Functional Requirements

- **Latency:** Seat status changes must propagate to all connected clients in under 1 second (Firebase Realtime Database WebSocket).
- **Scale:** System must handle 1 000+ concurrent users and 2 000–5 000 bookings per day.
- **Security:** Admin email list must never be used to grant write access — all write validation enforced via Firebase Security Rules. API keys stored in env vars, not committed.
- **Cost:** Firebase free tier (Spark) or Blaze with budget alerts; no single operation should perform unbounded reads.
- **Reliability:** Auto-expiry of bookings must run regardless of user action — handled client-side on mount with server-side cleanup routes as fallback.
- **Accessibility:** Mobile-first responsive layout; dark/light mode toggle; minimum contrast ratios on seat status colours.

---

## 8. Success Metrics

| Metric | Target |
|---|---|
| Real-time propagation latency | < 1 second for seat status change |
| Successful student login → seat booked flow | < 60 seconds end-to-end |
| No-show rate reduction vs manual system | Measurable via admin analytics dashboard |
| Admin report generation | CSV downloadable within 5 seconds for 30-day range |

---

## 9. Risks & Open Questions

- **Firebase `NEXT_PUBLIC_` env var exposure** — `NEXT_PUBLIC_ADMIN_EMAILS` is visible in the client bundle. An attacker cannot exploit this (admin actions still require the email to be in Firebase Auth), but it is a hygiene issue. Mitigated in v2 with Firebase custom claims.
- **Anti-hoarding timer accuracy** — expiry logic runs on client mount; if no client is watching a stale booking, the seat may stay reserved until the next page load. A Firebase Cloud Function cron would make this robust.
- **QR code replay attacks** — the QR payload contains only `bookingId / userId / seatId`; a screenshot could be replayed. Mitigated by booking status checks (only `pending` → `active` transition is allowed on entry scan).
- **Open question:** Should the extension window check library closing time, or is that the student's responsibility?

---

## 10. v2 Candidates

- **Firebase custom claims for admin roles** — removes `NEXT_PUBLIC_ADMIN_EMAILS` from client bundle; enforces admin checks in Security Rules.
- **FCM push notifications** — notify students on booking cancellation or seat release; infrastructure stubs already in booking-management service.
- **Cloud Function cron for auto-expiry** — replace client-side expiry with a server-side scheduled function for guaranteed cleanup.
- **Multi-floor analytics heatmap** — visual breakdown of occupancy per section, not just per floor.
- **Native mobile app** — PWA or React Native once web usage patterns are established.

---

**Tanish Poddar** — [tanisheesh.in](https://tanisheesh.in) · [LinkedIn](https://linkedin.com/in/tanisheesh) · [GitHub](https://github.com/tanisheesh)
