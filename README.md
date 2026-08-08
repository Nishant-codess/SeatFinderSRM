<p align="center">
  <img src="public/images/logo.png" alt="SeatFinderSRM" width="64" height="64" style="border-radius:50%">
</p>

<h1 align="center">SeatFinderSRM</h1>

<p align="center">
  <strong>Real-time library seat booking for SRM University students — find, book, and check in with a QR scan.</strong>
</p>

<p align="center">
  <a href="https://seatfinder.tanisheesh.in">
    <img src="https://img.shields.io/badge/live_demo-F97316-F97316?style=flat-square" alt="Live Demo">
  </a>
  <img src="https://img.shields.io/badge/Next.js-black?style=flat-square&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Firebase-DD2C00?style=flat-square&logo=firebase&logoColor=white" alt="Firebase">
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/license-GPL--3.0-orange?style=flat-square" alt="License">
</p>

---

## What is SeatFinderSRM?

SRM University's library has hundreds of seats across four floors and no way for students to know if a seat is free before walking in. SeatFinderSRM solves this with a real-time interactive floor map that shows live seat availability, lets students book a seat for a specific duration, and confirms their presence via a QR code scan at the entrance. The system is exclusive to `@srmist.edu.in` accounts and self-heals — expired bookings are automatically released so seats never get ghost-locked.

> **Live demo →** [seatfinder.tanisheesh.in](https://seatfinder.tanisheesh.in)

---

## What you get

- **Interactive floor map** — real-time seat status across 4 floors (200 seats) with colour-coded availability; updates in under a second across all connected clients.
- **QR code check-in** — every booking generates a scannable QR code; admins use the scanner page to check students in and out without any manual lookup.
- **Anti-hoarding system** — unconfirmed reservations are automatically cancelled after a grace period; overstays release the seat without any admin intervention.
- **Booking extension** — students can extend an active booking if the seat remains free, with conflict detection against other reservations.
- **Full admin dashboard** — analytics (occupancy rate, peak hours, no-show rate), booking management, user flagging, seat maintenance controls, and CSV report exports.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Auth | Firebase Authentication (email/password, @srmist.edu.in domain restriction) |
| Database | Firebase Realtime Database |
| Styling | Tailwind CSS · shadcn/ui (Radix UI) |
| Charts | Recharts |
| QR | react-qr-code · html5-qrcode · jsqr |
| AI | Google Genkit · Gemini 2.0 Flash |
| Validation | Zod · React Hook Form |
| Testing | Jest · Testing Library · fast-check |
| Hosting | Firebase App Hosting |

---

## Engineering Decisions

**Why Firebase Realtime Database over Postgres/Supabase?**
Seat availability needs to propagate to every connected browser in under a second — Firebase's WebSocket-native sync achieves this without any polling or server-side WebSocket infrastructure.

**Why restrict sign-up to @srmist.edu.in emails?**
The system is campus-only by design. Firebase Auth's email enumeration combined with a domain check at the client layer means zero-friction sign-up for students while completely blocking outsiders — no invite codes or manual approval needed.

**Why configure admins via an environment variable instead of a database role?**
The admin set is small and known ahead of time. An env-var check is zero-latency, cannot be manipulated through the database, and never causes a round-trip on every page load.

**What would you do differently in v2?**
Move admin detection server-side with Firebase Security Rules and custom claims, rather than relying on a `NEXT_PUBLIC_` env var that leaks the list to the client bundle. Also add push notifications (FCM) to replace the TODO comment in the booking cancellation flow.

---

## Docs

| Document | Description |
|---|---|
| [PRD](docs/PRD.md) | Product requirements — goals, user stories, non-goals |
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow, component breakdown |
| [Decisions](docs/DECISIONS.md) | Every major technical decision and why |
| [Setup](docs/SETUP.md) | Local dev setup, env vars, deployment |

---

## Author

**Tanish Poddar** — [tanisheesh.in](https://tanisheesh.in) · [LinkedIn](https://linkedin.com/in/tanisheesh) · [GitHub](https://github.com/tanisheesh)

AWS Student Builder Lead · SRM IST · Ex-NIC Govt of India
