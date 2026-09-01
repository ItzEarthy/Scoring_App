# MatchPlay — Feature & Architecture Spec

Living reference doc. Read this first in any new session before touching product scope or
architecture — it captures decisions made in product-discovery conversations that aren't visible
from the code alone. Update it whenever a feature's status changes or a new product decision is
made; don't let it drift out of date.

Status tags used below: `DONE`, `IN PROGRESS`, `PLANNED`, `OPEN QUESTION`.

Last updated: 2026-08-31.

## 1. Product vision

A comprehensive, widespread matchmaking and stat-tracking platform for clubs and players across
many sports.

- **Players** find matches, find clubs to play at, and track their stats per sport. Stats/ratings
  for a given sport are club-scoped, but a player's overall presence (account, global dashboard)
  follows them across every club they belong to.
- **Organizations** ("orgs"/"clubs") range from small teams and school clubs up to gyms and
  dedicated sporting facilities. Orgs manage their courts/tables, roster, matchmaking rules,
  tournaments, and events.
- **The platform itself** is operated by a site admin (the app's own developer/company), who has
  global control over users and organizations — distinct from any org's own OWNER/ADMIN.

## 2. Roles & glossary

- **Site Admin** — `PLANNED`. Platform-level role, not scoped to any org. Controls all users and
  all organizations platform-wide (see §5.5). Not the same enum as org `Role`.
- **Org roles** (`Role` enum: `MEMBER`, `ADMIN`, `OWNER`) — scoped per-organization via
  `OrganizationUser`. OWNER is set automatically on org creation; promotion/demotion is
  `PLANNED` (see §5.4).
- **Sport** — a global catalog entry (e.g. Tennis, Tennis - Doubles, Basketball). Has a
  `ratingAlgorithm` (`"glicko2"` or anything else -> OpenSkill), `defaultRules` JSON (bestOf,
  pointsToWin, etc. — enforced at match completion, see §5.3), and `minTeamSize`/`maxTeamSize`
  (exact size for singles/doubles when equal, open-ended minimum when `maxTeamSize` is null).
  Racquet/individual sports that support both formats are split into two catalog rows (e.g.
  "Tennis" + "Tennis - Doubles") rather than one sport with a variable format, so each format
  gets its own matchmaking pool and rating. Glicko-2 is used only for exact-size-<=2 sports
  (doubles teammates' ratings are averaged into one virtual opponent for the match calculation,
  then the resulting delta is split equally back to both); open-ended team sports use OpenSkill,
  which natively supports per-team score and margin-of-victory weighting.
- **PlayerRating** — one row per (user, sport), global across organizations. A player's rating in
  Tennis is the same at every club they belong to (this superseded the original per-org design —
  see the `make_player_ratings_global` migration).
- **Match modes** (`platformConfig.match_mode`, see §5.2) — `free`, `queue`, `pool`, `admin`.
  Each org picks one (or a per-sport override, TBD) to define how matches get created.
- **Approval modes** (`platformConfig.approval_mode`) — `player_mutual` (both participants must
  agree, or it auto-approves after a deadline) vs `admin_forced` (only an admin can finalize a
  score).

## 3. Architecture snapshot

Stack: Next.js 16 (App Router, Server Actions), React 19, Prisma 6 + Postgres, NextAuth v5 beta
(Credentials provider, JWT sessions), `openskill` + `glicko2` npm packages, Tailwind v4.

This project's Next.js version has behavior that diverges from training data — read
`node_modules/next/dist/docs/` before writing framework-adjacent code, per `AGENTS.md`.

Key files:

- `prisma/schema.prisma` — full data model. Core models: `User`, `Organization`, `Sport`,
  `OrganizationUser` (role junction), `PlayerRating` (per user+org+sport), `Match` +
  `MatchParticipant` (immutable ledger with `muBefore/sigmaBefore/muAfter/sigmaAfter`),
  `QueueEntry`.
- `lib/auth.ts` / `lib/auth-actions.ts` — NextAuth config, `getVerifiedUserId()` helper.
- `lib/matchmaking/queue-actions.ts` — join/leave queue server actions.
- `lib/matchmaking/form-matches.ts` — pairs WAITING queue entries into 1v1 matches by
  conservative skill estimate (`mu - 3*sigma`).
- `lib/matchmaking/report-match-score.ts` / `submit-match-score.ts` — score reporting,
  approval-mode branching, and the atomic rating-update transaction.
- `lib/matchmaking/rating-engines/` — pluggable OpenSkill / Glicko-2 engines behind a common
  interface.
- `lib/matchmaking/auto-approve-matches.ts` — lazily finalizes expired
  `PENDING_CONFIRMATION` matches; currently triggered by page loads only, no background job.
- `lib/organizations/manage-organizations.ts` — create org, join org (currently open/no-gate).
- `lib/organizations/update-org-settings.ts` — validates and writes `platformConfig`.
- `app/(player)/...` — authenticated app shell: `dashboard`, `orgs`, `orgs/[orgId]`,
  `orgs/[orgId]/queue`, `matches/[matchId]`, `admin` (site-admin area, nested here rather than a
  separate route group so it reuses the shell's header/nav — see `admin/layout.tsx` for the
  `isSiteAdmin` gate).
- `app/(auth)/...` — `/login`, `/register`.
- `lib/sports/manage-sports.ts` — site-admin-only sport catalog CRUD (create/edit/deactivate).
- `lib/organizations/manage-roster.ts` — org-admin-only member role/removal actions.
- No tests exist anywhere in the repo yet.

## 4. Design decisions log

Decisions made in product-discovery conversation on 2026-08-31 that aren't obvious from code:

1. **Four match modes, each a distinct real-world workflow**, not variations of one algorithm:
   - `free` (Open Play): players self-organize in person and log a score after the fact. No
     matchmaking algorithm involved — this is really just "score reporting without a queue."
   - `queue` (Automated Skill-Based Queue): backend pairs active queued players by similarity of
     `mu`/`sigma`. This is the mode that exists today (`form-matches.ts`), but currently ignores
     skill gap entirely — needs the widening-window behavior from decision 2.
   - `pool` (Matchmaking Pool): players join a rating-tier group/division (e.g. "Tier 1:
     1500-1800"); within the pool they challenge each other or get rotated through. Think
     box leagues / seasonal flights. Not yet designed in detail.
   - `admin` (Admin-Led / Scheduled): club organizers manually create fixtures and force
     pairings — for tournaments and sanctioned events. See §5.2 admin-led match creation.
   - Each org selects its mode in settings; the actual UI a player sees on the org/queue page
     should switch based on this (e.g. "Find Match" button for `queue`, a roster/challenge list
     for `free`, tier standings for `pool`, an assignment view for `admin`).

2. **Skill-gap matching uses a widening search window**, not a hard org-set cap or mutual
   per-player negotiation. A queued player's acceptable rating gap starts narrow and widens the
   longer they wait, until a match is found. Needs an org-level (and/or per-player, TBD) starting
   gap and widen-rate setting. This replaces the originally-considered "org sets one fixed
   max_rating_gap" and "each player sets a mutual max-gap" designs — both were considered and
   rejected in favor of widening-window.

3. **Dispute resolution v1 is intentionally minimal**: admin picks "Force a winner" on a
   `DISPUTED` match; ratings are computed from that forced outcome via the normal rating engine.
   Voiding and reset-to-re-report were discussed but are not in scope for v1 — don't build them
   unless asked.

4. **Org privacy is a 2-axis setting**, not a single enum flip:
   - **Visibility/join mechanism** — `public` (anyone can self-join, today's behavior),
     `invite_only` (an org admin adds members directly, no self-serve join), `org_code` (org has
     a shareable code/QR/link that grants join access), and **`admin_approval`** which is a
     modifier that can be layered on top of *any* of the above (join request goes to a
     pending-approval queue instead of immediate membership).
   - This replaces today's single implicit "public, no gate" model.

5. **Site Admin is a new platform-level role**, analogous to the app's own operator/company
   account — not an org role. Controls all users and all organizations platform-wide: user
   moderation, org oversight, and (at minimum) the global sports catalog. Exact permission
   boundary still needs to be nailed down field-by-field when implemented (see open questions).

6. **Org roster/ACL needs a real management UI**: promote/demote member<->admin, remove a
   member (which also flips their `PlayerRating.isActive` to `false` and drops them from
   leaderboards for that org, per the "Removing a player" user story — the `OrganizationUser`
   row itself is deleted, `PlayerRating` rows are soft-deactivated, not deleted, preserving
   history).

7. **Build order**: foundational work first — site admin role + global sports catalog admin UI +
   org roster/ACL management UI — since match-mode variety and dispute/privacy work both build on
   having real roles and a real admin surface to configure them from.

## 5. Feature tracker

### 5.1 Player experience

| Feature | Status | Notes |
|---|---|---|
| Global dashboard (ratings across all org+sport combos) | `DONE` (basic) | `app/(player)/dashboard/page.tsx`. Needs verification against the "empty state -> Find a Club" user story for brand-new users. |
| Per-org leaderboards | `DONE` | `app/(player)/orgs/[orgId]/page.tsx`. |
| Match history / detail view | `DONE` | `app/(player)/matches/[matchId]/page.tsx`. |
| Score reporting (mutual + admin-forced) | `DONE` | `lib/matchmaking/report-match-score.ts`. |
| Auto-approve on timeout | `DONE`, mechanism is `IN PROGRESS` | Logic exists but is page-view-triggered, not a real job — see decision needed in §5.6. |
| Queue join/leave (`queue` mode) | `DONE` | `lib/matchmaking/queue-actions.ts`, pairing by conservative skill estimate only (no gap logic yet). |
| Skill-gap widening window | `PLANNED` | See decision log #2. |
| Free/open-play mode (self-organize + log score) | `PLANNED` | No UI yet; needs a "challenge/report against any roster member" flow distinct from the queue. |
| Matchmaking pool / tiers mode | `PLANNED` | Needs data model for tiers/divisions; not designed in detail yet. |
| Player notifications (e.g. "you have a score to confirm") | `PLANNED` | No notification system exists yet; user stories assume one ("Player B receives a notification"). |

### 5.2 Organization features

| Feature | Status | Notes |
|---|---|---|
| Create organization | `DONE` | `lib/organizations/manage-organizations.ts`. |
| Join organization | `DONE`, but open-only | Currently anyone can join anyone's org with no gate — needs the privacy model from decision #4. |
| Org settings (match_mode, approval_mode, auto_approve_hours) | `DONE` (storage), `IN PROGRESS` (enforcement) | `match_mode` is validated/stored but only `queue` behavior is actually implemented — `pool`/`admin`/`free` are stubs. |
| Org privacy tiers (public / invite_only / org_code / admin_approval) | `PLANNED` | See decision #4. |
| Org roster/ACL management UI (promote, demote, remove) | `PLANNED` | See decision #6. This is part of the "foundational" build priority. |
| Admin-led match creation (manual pairing/fixtures) | `PLANNED` | For `admin` match mode / tournament use. |
| Dispute resolution ("Force a winner") | `PLANNED` | See decision #3. |
| Per-sport org configuration (which sports an org offers) | `PARTIAL` | Org creation flow selects sports per the user story, but sport definitions themselves are seed-only — see 5.3. |
| Tournament/event hosting | `PLANNED` | Named in product vision (§1); not yet scoped into concrete stories. |

### 5.3 Sports catalog

| Feature | Status | Notes |
|---|---|---|
| Global sport list (seed-only) | `DONE` | `prisma/seed.ts`; 26 sports (racquet sports split into singles + "- Doubles" rows), 2 rating algorithms. |
| In-app sport catalog management (create/edit/deactivate) | `DONE` | Owned by Site Admin — see §5.5. Includes `minTeamSize`/`maxTeamSize`; the form rejects a Glicko-2 sport with a max team size above 2. |
| Enforcement of `Sport.defaultRules` (bestOf, pointsToWin, etc.) | `DONE` | `lib/matchmaking/scoring/` — a per-sport score validator (two shared shapes: single cumulative number, or discrete sets) derives the winner (or draw) from the reported score and blocks submission on an invalid/incomplete result. Wired into `report-match-score.ts` / `submit-match-score.ts`. |
| Glicko-2 doubles averaging | `DONE` | `lib/matchmaking/rating-engines/glicko2-engine.ts` — a doubles team's two ratings are averaged into one virtual opponent for the match, and the resulting delta is applied identically to both teammates. |
| OpenSkill score/margin-of-victory weighting | `DONE` | `lib/matchmaking/rating-engines/openskill-engine.ts` — uses the `openskill` package's native `score`/`margin` options instead of plain rank, so a blowout moves rating more than a narrow win. |
| Conservative-rating display scale | `DONE` | `lib/matchmaking/rating-engines/conservative-rating.ts` — display-only transform (never persisted/fed back into the engines) so a brand-new player reads 1000 in both Glicko-2 and OpenSkill. |
| Queue-based matchmaking for open-ended team sports (min team size > 2) | `PLANNED` | Fair N-a-side skill-balanced drafting from a queue is out of scope so far; these sports (Basketball, Soccer, Volleyball, Softball, Foosball, Air Hockey, Shuffleboard, Cornhole, Spikeball) are schedulable only via admin-created matches (`admin-create-match.ts`) today — joining the queue for them is blocked with a message. Singles and doubles sports queue normally; `form-matches.ts` also groups doubles queue entries into balanced 2v2s. |

### 5.4 Roles & permissions

| Feature | Status | Notes |
|---|---|---|
| Org role enum (MEMBER/ADMIN/OWNER) + gating on writes | `DONE` | Used in settings/score-forcing checks today. |
| Role management UI | `DONE` | `app/(player)/orgs/[orgId]/member-row-controls.tsx` + `lib/organizations/manage-roster.ts`. Org ADMIN/OWNER can promote/demote MEMBER<->ADMIN and remove a member; the OWNER row and the acting admin's own row render no controls, and the server action independently rejects both (retargeting the OWNER, or self-removal) even if a request bypassed the UI. |
| Site Admin role | `DONE` | `User.isSiteAdmin` boolean — see decision #5 and §5.5. |

### 5.5 Site administration (new, platform-level)

| Feature | Status | Notes |
|---|---|---|
| Site Admin role/flag on User | `DONE` | Resolved as a boolean (`User.isSiteAdmin`), not a separate enum/table — only one platform-admin tier exists. Re-verified from the DB on every check via `getVerifiedSiteAdminUserId()` in `lib/auth.ts` (never cached in the JWT, to avoid the same staleness problem `getVerifiedUserId()` guards against). Chloe Ramirez (`chloe@example.com`) is flagged in `prisma/seed.ts` for local testing — chosen because she holds no org-admin role anywhere, proving Site Admin is a separate axis from org role. |
| Minimal site-admin area | `DONE` | Nested at `app/(player)/admin/` (reuses the player shell's header/nav rather than a separate chrome) — gated by `app/(player)/admin/layout.tsx`. |
| Global sports catalog management | `DONE` | `lib/sports/manage-sports.ts` + `app/(player)/admin/sports/`. Create/edit a sport (name, rating algorithm, default rules JSON); "deactivate" toggles `Sport.isActive` rather than deleting, since `Sport` cascade-deletes to `PlayerRating`/`Match`/`QueueEntry`. The matchmaking queue page (`orgs/[orgId]/queue/page.tsx`) filters to `isActive: true` sports only. |
| Global user moderation (view/suspend/ban) | `PLANNED` | Not built this slice. |
| Global org oversight (view/suspend/delete any org) | `PLANNED` | Not built this slice. |
| Platform settings / analytics | `OPEN QUESTION` | Mentioned as in-scope ("controls the service") but not broken into concrete stories yet. |

### 5.6 Auth & platform plumbing

| Feature | Status | Notes |
|---|---|---|
| Credentials auth (email+password, bcrypt, JWT sessions) | `DONE` | `lib/auth.ts`. |
| `getVerifiedUserId()` re-validation on writes | `DONE` | Applied to the 4 mutating action files. |
| Same re-validation on read paths | `OPEN QUESTION` | Not yet extended to dashboard/org/match page loads — undecided whether that's needed. |
| OAuth login | `PLANNED`, deferred | Owner confirmed real auth integration happens "when it goes to prod" — don't build yet, but don't design against it either (schema already has `Account`/`emailVerified` fields ready). |
| Background job runner (for auto-approve, and any future async work) | `PLANNED` | Owner wants a real job, configurable per-org (interacts with `auto_approve_hours`). No job infra exists yet — needs a decision on mechanism (cron route, queue, etc.) before implementing. |
| `scripts/_tmp-make-throwaway.ts` | `OPEN QUESTION` | Scratch/debug script for testing the stale-session bug. Undecided: delete, keep as informal dev tooling, or formalize into a real seed/test-fixture script. |

## 6. Open questions (unresolved, revisit before building the relevant feature)

- Auto-approve background job: what mechanism (cron endpoint, external scheduler, in-process
  timer)? What per-org settings does it need beyond `auto_approve_hours`?
- Should `getVerifiedUserId()`-style re-validation extend to read paths, or is that unnecessary
  overhead for pages that don't mutate data?
- `scripts/_tmp-make-throwaway.ts`: delete, keep, or formalize?
- Site Admin permission boundary: does "controls all users and orgs" include things like
  impersonation, billing (if this ever becomes paid), or platform-wide broadcast
  announcements? Not yet asked.
- Pool/tier mode: how are tier boundaries defined (fixed rating bands set by the org, or
  auto-computed percentile buckets)? Not yet designed.
- Per-sport vs per-org match mode: can a single org run `queue` mode for Tennis but `free` mode
  for Chess, or is match mode one setting for the whole org? Current schema
  (`platformConfig` on `Organization`) implies the latter — confirm before building.

## 7. Current build priority

Per owner decision on 2026-08-31: **start foundational**, in this order:

1. ~~Site Admin role (schema + gating) and a minimal site-admin area.~~ `DONE` 2026-08-31.
2. ~~Global sports catalog management UI (site-admin-owned).~~ `DONE` 2026-08-31.
3. ~~Org roster/ACL management UI (promote/demote/remove, org-admin-owned).~~ `DONE` 2026-08-31.

The foundational slice is complete (see §5.4/§5.5) and was verified end-to-end in the browser:
site-admin nav gating, sports catalog create/edit/deactivate-reactivate (including the required
`orgs/[orgId]/queue` filter fix and the duplicate-name error path), and org roster promote/
demote/remove (including the hard-delete + soft-deactivate transaction and the OWNER/self-removal
guardrails). One pre-existing bug was found and fixed along the way: the account dropdown's
`DropdownMenuLabel` crashed on open because it wasn't wrapped in the `DropdownMenuGroup` its
underlying base-ui primitive requires — unrelated to this slice's scope but blocking every user's
account menu, so it was fixed in `app/(player)/layout.tsx`.

Next up, per the original roadmap: core-gameplay work (pool mode, admin-led match creation,
skill-gap widening window) and trust/safety work (dispute resolution, org privacy tiers). Neither
has been started.
