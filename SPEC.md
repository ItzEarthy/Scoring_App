% Multi-Sport Matchmaking Platform

# Multi-Sport Matchmaking Platform (MVP)

## 1. Context & Task

Implement a multi-sport matchmaking platform MVP. The system must support dynamic, organization-level rules for matchmaking flows, sport-specific rating algorithms, and user-led match validations. Summarize what we built, state remaining blockers, and provide the exact context needed for the next session into a HANDOFF.md 

## 2. Tech Stack & Infrastructure

- **Framework:** Next.js 15 (App Router, Server Components, Server Actions)
- **Styling:** Tailwind CSS (modern, high-contrast sports theme)
- **Database & ORM:** PostgreSQL + Prisma (use JSONB for dynamic config fields)
- **Authentication:** Auth.js v5 (Prisma Adapter) — Email/Password credentials only
- **Deployment:** Dockerized Next.js + PostgreSQL (provide `Dockerfile` and `docker-compose.yml`)
- **Media Storage:** Base64 strings in PostgreSQL. Constraint: client-side resizing/compression must keep uploads < 50KB before DB insertion.

## 3. Allowed Write Scope

You may create/edit only the following paths:

- `src/app/(player)/*` and `src/app/(admin)/*`
- `src/lib/auth.ts` (Auth.js v5 configuration)
- `src/lib/matchmaking/*` (Elo, Glicko-2, TrueSkill logic)
- `prisma/schema.prisma`
- `docker-compose.yml` and `Dockerfile`

Do NOT change unrelated Next.js configuration files unless strictly required for Docker or Auth.js initialization. Do NOT modify public UI components outside the specified directories.

## 4. Data Architecture & Config (Prisma)

Define the following core entities in `prisma/schema.prisma`:

- `User`: Standard Auth.js fields plus global dashboard aggregations.
- `Organization`: Fields include `match_config` (JSONB) and `media_logo` (Text/Base64).
- `OrganizationMember`: Links `User` to `Organization` with role enum (`ADMIN`, `PLAYER`).
- `SportRating`: Tracks a user's rating per sport per organization.
- `Match`: Fields include `status` (`pending_confirmation`, `approved`, `disputed`), `score`, `sport`, and `participant_ids`.

### Organization `match_config` JSONB schema

```json
{
  "match_mode": "queue | admin | pool | free",
  "approval_mode": "admin_forced | player_mutual",
  "rating_algorithm": "elo | glicko2 | trueskill",
  "approval_deadline_hours": 24
}
```

## 5. Core User Flows & Rules

- **Global Dashboard** (`/(player)/dashboard`): Server Component that fetches via Prisma and shows aggregated ratings across sports/orgs and recent match history.
- **Organization Hub** (`/(player)/orgs/[orgId]`): Club-specific leaderboards. The matchmaking entry point should render based entirely on the org's `match_mode` config (e.g., "Join Queue" vs "Challenge Player").
- **Match Scoring & Auto-Approvals** (`/(player)/matches/[matchId]`):
  - If `approval_mode` is `player_mutual`, submitted scores enter `pending_confirmation`.
  - Critical: implement lazy-evaluation on the fetch layer or via a background job: if current time > `match.createdAt + approval_deadline_hours` without a dispute, auto-update status to `approved` and trigger rating calculation.
- **Admin Dashboard** (`/(admin)/[orgId]`): Form to edit `match_config` JSONB, resolve disputes, and manage members.

## 6. Non-Goals

- No OAuth providers — Email/Password only for MVP.
- No WebSocket real-time features — use polling or Server Actions for queues.
- No external media buckets — keep Base64 in DB and enforce the size constraint client-side.
- Do not perform unrelated refactors or rewrite public UI components.

## 7. Acceptance Criteria

- [ ] Users can register, log in, and create/join an organization.
- [ ] Admins can save a valid `match_config` JSON to their organization.
- [ ] Two players can submit a match score that enters the correct approval flow.
- [ ] The system recalculates ratings based on the org's chosen algorithm when a match is approved.
- [ ] Timeouts auto-approve pending matches when `approval_deadline_hours` is exceeded.

## 8. Evidence Before Merge

- **Test Command:**

```bash
npm run lint
npx prisma validate
```

Both commands must exit with 0 errors.

- **Manual Check:** Provide logs or CLI output demonstrating a successful rating calculation for two test users after a match is approved.

---

_Notes:_ Keep all server-side data-fetching pages as Server Components where specified. Persist user preferences and flow-mode choices in a scenario-specific config when implementing the admin flows.