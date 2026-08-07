# Local Setup — SeatFinderSRM

> **Just want to try it?** Use the live demo at [seatfinder-srm.firebaseapp.com](https://seatfinder-srm.firebaseapp.com) — no setup needed.
> This guide is for running SeatFinderSRM locally or self-hosting it.

---

## Prerequisites

- Node.js 20+
- npm 10+ (bundled with Node 20)
- A Firebase project (Spark free tier works for local dev)
- A Google account for Firebase

---

## 1. Clone and install

```bash
git clone https://github.com/tanisheesh/SeatFinderSRM
cd SeatFinderSRM
npm install
```

---

## 2. Firebase project setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a new project.
2. Enable **Authentication** → **Email/Password** sign-in method.
3. Enable **Realtime Database** → choose a region (we used `asia-southeast1`).
4. In **Project Settings → Your apps**, add a web app and copy the config object.

---

## 3. Environment variables

Create `.env.local` in the project root:

```bash
cp .env.local.example .env.local   # if an example file exists, or create manually
```

Fill in the following values:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console → Project Settings → Your apps → Web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Console → Project Settings → `<project-id>.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | Firebase Console → Realtime Database → Data tab → URL |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Console → Project Settings → Project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Console → Project Settings → `<project-id>.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Console → Project Settings → Cloud Messaging |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Console → Project Settings → Your apps → App ID |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Firebase Console → Project Settings → Measurement ID (optional) |
| `NEXT_PUBLIC_ADMIN_EMAILS` | Comma-separated list of emails that should have admin access, e.g. `you@srmist.edu.in` |

Example `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:000000000000
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_ADMIN_EMAILS=admin@srmist.edu.in
```

> **Note:** `NEXT_PUBLIC_` variables are embedded in the client bundle. Never put secrets in these vars — Firebase config values are safe to expose (they are scoped by Firebase Security Rules and Auth).

---

## 4. Database setup

SeatFinderSRM uses Firebase Realtime Database — there are no migrations. On first run, the seat structure needs to be seeded. After starting the dev server:

```bash
# Seed the seat map (4 floors × 50 seats)
curl http://localhost:3000/api/init/all
```

Or visit `http://localhost:3000/api/init/all` in your browser. This is idempotent — safe to run multiple times.

You can also seed individual parts:
```bash
curl http://localhost:3000/api/init/settings   # library operating hours and booking rules
curl http://localhost:3000/api/init/feedback   # feedback categories
curl http://localhost:3000/api/init/users      # (noop unless you add seed users)
```

---

## 5. Run locally

```bash
npm run dev
```

SeatFinderSRM will be running at `http://localhost:3000`.

- Sign up with a `@srmist.edu.in` email address.
- Verify the email (check your inbox).
- Admin accounts are those whose email appears in `NEXT_PUBLIC_ADMIN_EMAILS`.

---

## 6. Run tests

```bash
npm test              # run all tests once
npm run test:watch    # watch mode
```

Tests use Jest + Testing Library. Property-based tests use fast-check.

---

## 7. Type check

```bash
npm run typecheck
```

---

## 8. Run Genkit dev server (AI flows)

```bash
npm run genkit:dev    # start Genkit dev UI + hot reload
```

Access the Genkit developer UI at `http://localhost:4000`. Requires a `GOOGLE_GENAI_API_KEY` in your environment (obtain from [aistudio.google.com](https://aistudio.google.com)).

---

## 9. Deploy to production

SeatFinderSRM is configured for Firebase App Hosting.

```bash
npm install -g firebase-tools
firebase login
firebase deploy
```

Or connect the GitHub repo to Firebase App Hosting in the Firebase Console for automatic deploys on push to `main`.

Environment variables are set in the Firebase App Hosting backend configuration (not in the repo). Set them via:

```bash
firebase apphosting:backends:update --project your-project-id
```

---

## Known local-only limitations

- **Camera QR scanning** requires HTTPS or `localhost`; it will not work on `http://192.168.x.x` without a valid TLS cert.
- **Email verification** requires a valid Firebase Auth project configured with a real SMTP sender — Firebase's default sender works for testing.
- **Genkit flows** require a `GOOGLE_GENAI_API_KEY`; the main app runs without it since Genkit flows are not wired to production features in v1.

---

**Tanish Poddar** — [tanisheesh.in](https://tanisheesh.in) · [LinkedIn](https://linkedin.com/in/tanisheesh) · [GitHub](https://github.com/tanisheesh)
