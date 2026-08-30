# SCHEMA.md: Database Architecture (Prisma/PostgreSQL)

## 1. Prisma Directives for Claude
*   **Database Provider:** PostgreSQL.
*   **Naming Convention:** Use `camelCase` for model fields and `PascalCase` for model names. Map to `snake_case` in the database using `@map`.
*   **JSON Fields:** Explicitly use `@db.JsonB` for all JSON configurations.
*   **Auth.js v5 Compatibility:** The `User` model must include standard NextAuth adapter fields (`Account`, `Session`, `VerificationToken` models must be present even if unused for MVP).
*   **Ledger Precision:** Use `Float` for all rating math fields (`mu`, `sigma`) to support Glicko-2/OpenSkill algorithms without rounding errors.

## 2. Enums
Define these explicitly in the Prisma schema:
*   `Role`: `MEMBER`, `ADMIN`, `OWNER`
*   `MatchStatus`: `SCHEDULED`, `IN_PROGRESS`, `PENDING_CONFIRMATION`, `COMPLETED`, `CANCELED`, `DISPUTED`
*   `MatchOutcome`: `WIN`, `LOSS`, `DRAW`

## 3. Core Models

**User (Auth.js Compatible)**
*   `id` (String, CUID, PK)
*   `name` (String?)
*   `email` (String, Unique)
*   `emailVerified` (DateTime?)
*   `passwordHash` (String) *(Required for MVP)*
*   `avatarBase64` (Text/String?) *(Constraint: Must be handled via client-side compression before DB insert)*
*   *Relations:* `accounts`, `sessions`, `organizationUsers`, `playerRatings`, `matchParticipants`

**Organization**
*   `id` (String, CUID, PK)
*   `name` (String)
*   `logoBase64` (Text/String?)
*   `platformConfig` (JsonB) *(Schema: match_mode, approval_mode, auto_approve_hours)*
*   `createdAt`, `updatedAt` (DateTime)
*   *Relations:* `organizationUsers`, `matches`, `playerRatings`

**Sport**
*   `id` (String, CUID, PK)
*   `name` (String, Unique)
*   `ratingAlgorithm` (String) *(e.g., 'glicko2', 'trueskill', 'elo')*
*   `defaultRules` (JsonB)
*   *Relations:* `playerRatings`, `matches`

## 4. Junctions & Intersections

**OrganizationUser**
*   `id` (String, CUID, PK)
*   `userId` (String, FK to User)
*   `organizationId` (String, FK to Organization)
*   `role` (Enum: `Role`, default: `MEMBER`)
*   `createdAt`, `updatedAt` (DateTime)
*   *Indexes:* `@@unique([userId, organizationId])`

**PlayerRating**
*   `id` (String, CUID, PK)
*   `userId` (String, FK to User)
*   `organizationId` (String, FK to Organization)
*   `sportId` (String, FK to Sport)
*   `mu` (Float, default: 25.0) *(Standard starting mu for TrueSkill/OpenSkill)*
*   `sigma` (Float, default: 8.333) *(Standard starting sigma for TrueSkill/OpenSkill)*
*   `isActive` (Boolean, default: true)
*   *Indexes:* `@@unique([userId, organizationId, sportId])`

## 5. Match Engine & Immutable Ledger

**Match**
*   `id` (String, CUID, PK)
*   `organizationId` (String, FK to Organization)
*   `sportId` (String, FK to Sport)
*   `status` (Enum: `MatchStatus`, default: `PENDING_CONFIRMATION`)
*   `approvalDeadline` (DateTime?) *(Calculated at creation based on Organization auto_approve_hours)*
*   `createdAt`, `finishedAt` (DateTime)
*   *Relations:* `participants` (MatchParticipant[])

**MatchParticipant**
*   `id` (String, CUID, PK)
*   `matchId` (String, FK to Match)
*   `userId` (String, FK to User)
*   `teamIdentifier` (String) *(Useful for doubles/multiplayer, e.g., 'team_a', 'team_b')*
*   `score` (Int?)
*   `outcome` (Enum: `MatchOutcome`?)
*   *Ledger Fields:* (The historical snapshot)
    *   `muBefore` (Float)
    *   `sigmaBefore` (Float)
    *   `muAfter` (Float?)
    *   `sigmaAfter` (Float?)
*   *Indexes:* `@@unique([matchId, userId])`