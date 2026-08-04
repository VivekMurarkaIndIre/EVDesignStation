# EV Charging Session Tracker

A full-stack demo: browse charging stations, start a session, stop it, and
see a cost breakdown that splits peak vs. off-peak energy and cost —
because a session that spans both bands should be billed for time actually
spent in each, not a flat rate for the whole thing.

## Tech stack

- **Frontend**: React + Vite + TypeScript, Ant Design (antd)
- **Backend**: Express + TypeScript
- **Data**: in-memory repositories behind interfaces (`StationRepository`,
  `SessionRepository`) — swappable for a real DB later with no
  controller/service changes
- **Testing**: Vitest + Supertest
- **Repo layout**: npm workspaces monorepo — `/client`, `/server`, `/shared`

## Setup & run

Requires Node 20+ (built and tested on Node 24) and npm 10+.

```bash
npm install   # installs client, server, and shared together (npm workspaces)
```

Local dev works with **zero `.env` files** — both packages fall back to
sensible localhost defaults. Copy the `.env.example`s only if you want to
override something (a different port, a deployed API URL, etc.):

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Run both dev servers (two terminals, from the repo root):

```bash
npm run dev:server   # Express on http://localhost:4000
npm run dev:client   # Vite on http://localhost:5173
```

Open http://localhost:5173.

Other useful scripts, all runnable from the repo root:

```bash
npm run test:server    # 44 tests: pricing edge cases, repositories, API integration
npm run build:server
npm run build:client
```

## Architecture, and why

```
server/src/
  routes/        HTTP layer only — no business logic
  controllers/   parse the request, call a service, shape the response
  services/      business logic (pricing calculation, session rules)
  repositories/  data access behind an interface
  models/        shared domain types (re-exported from /shared) + zod schemas
  middleware/    validation, error handling, rate limiting
```

**Dependency inversion.** `sessionService` and `stationService` are built
via factory functions that take a `StationRepository`/`SessionRepository`
*interface* as a dependency, never the concrete `InMemory...` class. Swapping
in a SQLite-backed implementation later means writing a class that satisfies
the same interface and changing one line in `app.ts` — no controller or
service code moves.

**Pricing logic is one pure function.** `calculateCost` in
`services/pricingService.ts` takes `(startTime, endTime, chargingSpeedKw,
rateSchedule)` and returns a `CostBreakdown`. No Express, no repository, no
I/O — it walks the interval boundary-by-boundary (each day's 08:00/20:00
crossing), prices each sub-interval by duration × kW × the applicable rate,
and sums. It's tested in complete isolation, covering every edge case in the
spec (entirely peak, entirely off-peak, one boundary crossing in each
direction, a multi-day session crossing several boundaries, start/end
landing exactly on a boundary, zero-duration, and rounding behavior).

**Fail-safe defaults, applied at every layer:**
- `zod` validates every request body/params shape before it reaches a
  service (`models/schemas.ts` + `middleware/validate.ts`) — a malformed
  request never gets as far as business logic.
- A centralized error handler maps typed errors (`NotFoundError`,
  `ConflictError`, `ValidationError`) to the right status code and never
  leaks a stack trace; anything unexpected becomes a generic 500.
- `config.ts` fails **at startup** if `CORS_ORIGIN` is missing while
  `NODE_ENV=production`, rather than silently falling back to `localhost`
  and quietly breaking for every real user.

**Concurrency safety on station status.** `StationRepository.tryOccupy` is a
single atomic check-and-set: it reads the station's status and flips it to
`occupied` in the same synchronous step, so two racing `POST /sessions` for
the same station can't both pass the "is it available" check before either
writes. This is verified two ways: a repository-level test that fires 20
concurrent `tryOccupy` calls at one station and asserts exactly one
succeeds, and an integration test that does the same thing through the full
HTTP stack (10 concurrent `POST /sessions`, exactly one 201).

**Security, done rather than listed:** `helmet` (with
`crossOriginResourcePolicy: cross-origin`, since the default `same-origin`
would otherwise block the deployed frontend's fetch calls to this API even
with valid CORS headers present — a real bug I hit and fixed while testing
this in an actual browser, since `curl` can't reveal a browser-enforced
header like CORP); CORS restricted to an explicit origin allowlist;
`express-rate-limit` on the two mutating endpoints (session start/stop —
the `GET` routes are unlimited); `trust proxy` enabled in production only,
since Render/Railway sit behind a reverse proxy and rate limiting would
otherwise key off the proxy's IP for every client.

**Frontend state is plain React hooks**, not a state-management library —
`useStations` polls `GET /stations` every 5s (plus an immediate refresh
after any start/stop) and `useMySessions` tracks the sessions this browser
started. The app's actual state surface is small enough that reaching for
Redux/Zustand/React Query would be adding a dependency to solve a problem
that doesn't exist yet.

## Assumptions

- **Peak/off-peak boundaries are evaluated in UTC**, not server-local or
  station-local time. There's no station-location or user-locale concept in
  this project, so one fixed reference frame is used everywhere rather than
  letting results depend on whatever timezone the host machine happens to
  be in (which would differ between a laptop and a Render container). A
  real product would tie this to the station's actual timezone.
- **Multiple concurrent sessions are allowed, one per station.** There's no
  login, so "one active session" is scoped per station rather than
  globally per user — this is also what the API surface implies (`POST
  /sessions` only rejects if *that station* is occupied).
- **"My Sessions" on the frontend is a browser-local list**, not a real
  account. There's no login in scope, so the client just remembers the ids
  of sessions it started (in `localStorage`) and treats the server as the
  source of truth for their actual state — the closest approximation of
  "your sessions" without inventing a fake auth system.
- **Session-stop has a known, narrower concurrency guarantee than
  session-start.** Starting a session is protected by an atomic
  compare-and-set (`tryOccupy`). Stopping one is a plain check-then-write —
  the spec scoped the concurrency requirement to station status
  specifically, so two simultaneous stop requests for the exact same
  session id aren't guarded against. A DB-backed implementation would
  close this with a conditional `UPDATE ... WHERE end_time IS NULL`.
- **Cost is computed once, at stop time, and stored** on the session
  record — not recomputed on every `GET`. This matches how real billing
  works: if rates changed later, what you were already charged shouldn't.
- **Rates and station data are hardcoded seed data**, per spec, held only
  in process memory — restarting the server resets everything to the
  seeded state.

## What would be added with more time

- A SQLite-backed repository implementation (the spec flagged this as
  optional). The interfaces are already designed for this swap.
- Closing the session-stop concurrency gap noted above.
- Automated frontend tests (Vitest + React Testing Library). The frontend
  was verified manually during development with a scripted
  headless-Chromium run through the full start → stop → cost-breakdown
  flow, but that isn't wired into an automated suite.
- Real-time station status via WebSockets/SSE instead of 5s polling.
- A "browse all active sessions" view — there's no list-all endpoint today
  (`GET /sessions/:id` only), matching the spec's literal API surface.

## Deploying

- **Backend** → Render or Railway. Set `CORS_ORIGIN` to the deployed
  frontend's exact origin and `NODE_ENV=production` (this makes
  `CORS_ORIGIN` required — the app won't start without it, on purpose).
- **Frontend** → Vercel or Netlify. Set `VITE_API_BASE_URL` to the deployed
  backend's URL at build time.
- **Free-tier cold starts**: if the backend is on Render's free tier, it
  spins down after a period of inactivity. The first request after that
  can take 30–60 seconds to respond while the container cold-starts — if
  the deployed demo seems stuck on load, that's why; it recovers on its
  own.
